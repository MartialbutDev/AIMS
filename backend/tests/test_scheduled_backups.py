"""Standalone backup safety tests; no live databases, uploads or services."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
from datetime import timedelta
from unittest import TestCase
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'ops' / 'backup.py'
spec = importlib.util.spec_from_file_location('aims_backup_operator', MODULE)
backup = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = backup
spec.loader.exec_module(backup)


class ScheduledBackupTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='aims-backup-unit-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / 'assets'; self.assets.mkdir()
        self.destination = self.root / 'backups'; self.destination.mkdir()
        self.env = self.root / '.env'
        self.env.write_text('DATABASE_URL=postgresql://fixture:do-not-log@localhost/aims_backup_test\n', encoding='utf-8')
        self.cfg = backup.Config(str(self.env), 'aims_backup_test', 'localhost', str(self.assets), str(self.destination), str(self.root / 'public-keys'), 'A' * 40, writer_services=[])

    def test_target_mismatch_fails_before_connection_and_does_not_expose_password(self):
        self.cfg.expected_database = 'another_database'
        with patch.object(backup, 'execute') as command, self.assertRaises(backup.BackupError) as error:
            backup.database_environment(self.cfg)
        self.assertEqual(str(error.exception), 'database_target_mismatch')
        command.assert_not_called()
        self.assertNotIn('do-not-log', str(error.exception))

    def test_environment_uses_private_libpq_environment_not_password_arguments(self):
        with patch.dict(os.environ, {'PGSERVICE': 'untrusted-service', 'PGOPTIONS': 'untrusted-option'}):
            env = backup.database_environment(self.cfg)
        self.assertEqual(env['PGPASSWORD'], 'do-not-log')
        self.assertNotIn('PGSERVICE', env)
        self.assertNotIn('PGOPTIONS', env)
        self.assertEqual(env['PGDATABASE'], 'aims_backup_test')

    def test_changed_upload_directory_and_overlap_are_rejected(self):
        self.cfg.assets_dir = str(self.root / 'wrong-uploads')
        with self.assertRaisesRegex(backup.BackupError, 'upload_directory_target_mismatch'):
            backup.database_environment(self.cfg)
        self.cfg.assets_dir = str(self.destination)
        with self.assertRaisesRegex(backup.BackupError, 'directories_must_be_separate'):
            self.cfg.validate()

    def test_full_fingerprint_and_safe_writer_units_required(self):
        self.cfg.recipient_fingerprint = 'abcd'
        with self.assertRaises(backup.BackupError): self.cfg.validate()
        self.cfg.recipient_fingerprint = 'A' * 40
        self.cfg.writer_services = ['postgresql.service']
        with self.assertRaises(backup.BackupError): self.cfg.validate()

    def test_exclusive_lock_rejects_overlap_and_releases_after_exception(self):
        with backup.exclusive_lock(self.destination):
            with self.assertRaisesRegex(backup.BackupError, 'another_backup_is_running'):
                with backup.exclusive_lock(self.destination): pass
        with backup.exclusive_lock(self.destination): pass

    def test_public_keyring_must_not_contain_private_keys(self):
        Path(self.cfg.gpg_home).mkdir()
        with patch.object(backup, 'gpg_command', return_value=['gpg']), patch.object(backup, 'execute', return_value=b'sec:u:2048:1:SECRET:'):
            with self.assertRaisesRegex(backup.BackupError, 'private_key_must_not_be_on_backup_server'):
                backup.check_recipient(self.cfg)

    def test_command_failure_never_echoes_raw_stderr(self):
        result = subprocess.CompletedProcess([], 1, b'', b'password=do-not-log record=private')
        with patch.object(backup.subprocess, 'run', return_value=result):
            with self.assertRaises(backup.BackupError) as error:
                backup.execute(['fake-tool'], 'database_dump')
        self.assertEqual(str(error.exception), 'database_dump_failed')

    def make_bundle(self, bad_path=False):
        (self.assets / 'uploads').mkdir(exist_ok=True)
        (self.assets / 'uploads' / 'fixture.pdf').write_bytes(b'synthetic document')
        uploads = self.root / 'uploads.tar.gz'
        files = backup.create_upload_archive(self.assets, uploads)
        if bad_path:
            with tarfile.open(uploads, 'w:gz') as archive:
                info = tarfile.TarInfo('assets/../../outside.txt'); info.size = 1
                archive.addfile(info, io.BytesIO(b'x'))
        dump = self.root / 'database.dump'; dump.write_bytes(b'PGDMP-synthetic')
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps({'format_version': 1, 'database_sha256': backup.sha256_file(dump), 'uploads_sha256': backup.sha256_file(uploads), 'files': files}), encoding='utf-8')
        bundle = self.root / 'bundle.tar'
        with tarfile.open(bundle, 'w') as archive:
            for name in ('database.dump', 'uploads.tar.gz', 'manifest.json'):
                archive.add(self.root / name, arcname=name, recursive=False)
        return bundle

    def test_archive_hashes_and_complete_upload_inventory_verify(self):
        result = backup.verify_bundle(self.make_bundle())
        self.assertEqual(result['upload_count'], 1)
        self.assertTrue(result['verified'])

    def test_archive_path_traversal_is_rejected_without_extraction(self):
        with self.assertRaisesRegex(backup.BackupError, 'unsafe_upload_archive_path'):
            backup.verify_bundle(self.make_bundle(bad_path=True))
        self.assertFalse((self.root.parent / 'outside.txt').exists())

    def test_extra_bundle_member_is_rejected(self):
        bundle = self.make_bundle()
        with tarfile.open(bundle, 'a') as archive:
            item = tarfile.TarInfo('unrequested.env'); item.size = 1
            archive.addfile(item, io.BytesIO(b'x'))
        with self.assertRaisesRegex(backup.BackupError, 'invalid_bundle_members'):
            backup.verify_bundle(bundle)

    def test_upload_symlink_cannot_escape_source(self):
        external = self.root / 'outside'; external.write_text('not a student upload')
        try: (self.assets / 'linked.txt').symlink_to(external)
        except OSError: self.skipTest('Windows symlink permission unavailable')
        with self.assertRaisesRegex(backup.BackupError, 'upload_symlink_not_supported'):
            backup.upload_paths(self.assets)

    def test_retention_only_removes_old_complete_verified_backups_and_keeps_two(self):
        paths = []
        now = backup.utcnow()
        for number, age in enumerate((20, 30, 40)):
            created = now - timedelta(days=age)
            path = self.destination / ('aims-backup-' + created.strftime('%Y%m%dT%H%M%SZ') + '-' + f'{number:08x}' + '.tar.gpg')
            path.write_bytes(b'synthetic-encrypted-backup')
            backup.atomic_json(path.with_name(path.name + '.json'), {'complete': True, 'created_at': backup.stamp(created), 'sha256': backup.sha256_file(path)})
            paths.append(path)
        unrelated = self.destination / 'do-not-delete.tar.gpg'; unrelated.write_bytes(b'important')
        partial = self.destination / 'unfinished.partial'; partial.write_bytes(b'keep')
        self.assertEqual(backup.prune(self.cfg, now), 1)
        self.assertTrue(paths[0].exists() and paths[1].exists())
        self.assertFalse(paths[2].exists())
        self.assertTrue(unrelated.exists() and partial.exists())

    def test_failed_backup_keeps_last_success_and_cleans_plaintext_work(self):
        backup.private_dir(self.cfg.state)
        backup.atomic_json(self.cfg.state / 'last-success.json', {'backup': 'previous-good-copy'})
        with patch.object(backup, 'preflight', side_effect=ValueError('password=do-not-log')):
            with self.assertRaises(backup.BackupError): backup.run_backup(self.cfg, offline=True)
        self.assertEqual(json.loads((self.cfg.state / 'last-success.json').read_text())['backup'], 'previous-good-copy')
        failure = (self.cfg.state / 'last-run.json').read_text()
        self.assertIn('backup_valueerror', failure)
        self.assertNotIn('do-not-log', failure)
        self.assertEqual(list(self.destination.glob('.work-*')), [])

    def test_temporary_cleanup_refuses_outside_or_unrecognized_paths(self):
        for path in (self.root, self.root / '.work-' / 'outside', self.destination / 'ordinary-directory'):
            with self.assertRaises(backup.BackupError): backup.cleanup_work(path, self.destination)

    def test_active_writers_resume_after_failure_and_inactive_writers_stay_inactive(self):
        self.cfg.writer_services = ['aims-backend.service', 'aims-worker.service']
        states = {'aims-backend.service': b'active', 'aims-worker.service': b'inactive'}
        calls = []
        def command(args, _stage, **_kwargs):
            calls.append(args)
            if '--property=LoadState' in args: return b'loaded\n'
            if '--property=ActiveState' in args: return states[args[2]] + b'\n'
            if args[1] == 'stop': states[args[2]] = b'inactive'
            if args[1] == 'start': states[args[2]] = b'active'
            return b''
        with patch.object(backup.sys, 'platform', 'linux'), patch.object(backup, 'execute', side_effect=command):
            with self.assertRaisesRegex(RuntimeError, 'forced failure'):
                with backup.pause_writers(self.cfg):
                    self.assertEqual(states['aims-backend.service'], b'inactive')
                    raise RuntimeError('forced failure')
        self.assertEqual(states['aims-backend.service'], b'active')
        self.assertEqual(states['aims-worker.service'], b'inactive')
        self.assertFalse((self.cfg.state / 'paused-writers.json').exists())
        self.assertNotIn(['systemctl', 'start', 'aims-worker.service'], calls)

    def test_crash_resume_rejects_unconfigured_unit_and_retries_failures(self):
        backup.atomic_json(self.cfg.state / 'paused-writers.json', {'services': ['postgresql.service']})
        with self.assertRaisesRegex(backup.BackupError, 'invalid_paused_writer_state'):
            backup.resume_writers(self.cfg)
        self.cfg.writer_services = ['aims-backend.service']
        backup.atomic_json(self.cfg.state / 'paused-writers.json', {'services': self.cfg.writer_services})
        with patch.object(backup, 'execute', side_effect=backup.BackupError('resume-failed')):
            with self.assertRaisesRegex(backup.BackupError, 'writer_resume_failed'):
                backup.resume_writers(self.cfg)
        self.assertTrue((self.cfg.state / 'paused-writers.json').exists())

    def test_schedule_profile_has_recovery_hook_and_explicit_timezone(self):
        service = (MODULE.parent / 'aims-backup.service').read_text()
        timer = (MODULE.parent / 'aims-backup.timer').read_text()
        self.assertIn('ExecStopPost=', service)
        self.assertIn('backup.py resume --config', service)
        self.assertIn('02:00:00 Asia/Manila', timer)
        self.assertIn('Persistent=true', timer)
        self.assertIn('UMask=0077', service)

    def test_low_disk_fails_before_pausing_or_pruning(self):
        from types import SimpleNamespace
        with patch.object(self.cfg, 'pg', return_value='test-tool'), patch.object(backup, 'target_identity', return_value={'database': self.cfg.expected_database, 'size': 100}), patch.object(backup, 'check_recipient'), patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=0)):
            with self.assertRaisesRegex(backup.BackupError, 'insufficient_backup_disk_space'):
                backup.preflight(self.cfg)

    def test_encryption_failure_publishes_nothing_and_keeps_prior_success(self):
        backup.atomic_json(self.cfg.state / 'last-success.json', {'backup': 'previous-good-copy'})
        (self.assets / 'fixture.pdf').write_bytes(b'synthetic upload')
        identity = {'database': self.cfg.expected_database, 'size': 100, 'server_version': '180000'}
        def command(args, stage, **_kwargs):
            if stage == 'database_dump':
                Path(args[-1]).write_bytes(b'PGDMP-synthetic-dump')
            if stage == 'encryption':
                raise backup.BackupError('encryption_failed')
            return b''
        with patch.object(backup, 'preflight', return_value=({}, identity)), patch.object(backup, 'target_identity', return_value=identity), patch.object(self.cfg, 'pg', return_value='test-tool'), patch.object(backup, 'gpg_command', return_value=['test-gpg']), patch.object(backup, 'execute', side_effect=command), patch.object(backup, 'prune') as prune:
            with self.assertRaisesRegex(backup.BackupError, 'encryption_failed'):
                backup.run_backup(self.cfg, offline=True)
        prune.assert_not_called()
        self.assertEqual(list(self.destination.glob('*.tar.gpg')), [])
        self.assertEqual(list(self.destination.glob('.work-*')), [])
        self.assertEqual(json.loads((self.cfg.state/'last-success.json').read_text())['backup'], 'previous-good-copy')
