#!/usr/bin/env python3
"""Standalone AIMS backup operator. No application imports or database writes.

Scheduled jobs use a public-only GnuPG keyring. Recovery keys stay offline.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import urlsplit, unquote, parse_qs
import uuid

from dotenv import dotenv_values

CHUNK = 1024 * 1024
NAME = re.compile(r'aims-backup-\d{8}T\d{6}Z-[0-9a-f]{8}\.tar\.gpg')
WORK = re.compile(r'\.work-[0-9a-f]{32}')


class BackupError(Exception):
    """Only fixed, nonsecret error codes leave this module."""


@dataclass
class Config:
    database_env_file: str
    expected_database: str
    expected_host: str
    assets_dir: str
    backup_dir: str
    gpg_home: str
    recipient_fingerprint: str
    writer_services: list[str] = field(default_factory=lambda: ['aims-backend.service'])
    retain_days: int = 14
    keep_minimum: int = 2
    minimum_free_mb: int = 512
    command_timeout_seconds: int = 300
    pg_bin_dir: str = ''
    gpg_binary: str = 'gpg'
    offsite_required: bool = False

    @classmethod
    def read(cls, filename):
        try:
            config = cls(**json.loads(Path(filename).read_text(encoding='utf-8-sig')))
            config.validate()
            return config
        except BackupError:
            raise
        except Exception:
            raise BackupError('invalid_configuration') from None

    def validate(self):
        for name in ('database_env_file', 'assets_dir', 'backup_dir', 'gpg_home'):
            if not Path(getattr(self, name)).is_absolute():
                raise BackupError('configuration_paths_must_be_absolute')
        if Path(self.backup_dir).is_symlink() or Path(self.gpg_home).is_symlink():
            raise BackupError('private_directory_is_symlink')
        assets, backups, keys = (Path(p).resolve() for p in (self.assets_dir, self.backup_dir, self.gpg_home))
        if assets == backups or assets in backups.parents or backups in assets.parents:
            raise BackupError('backup_and_upload_directories_must_be_separate')
        if keys == assets or assets in keys.parents:
            raise BackupError('keyring_must_be_outside_uploads')
        if not self.expected_database or self.expected_database in {'postgres', 'template0', 'template1'} or not self.expected_host:
            raise BackupError('explicit_application_database_target_required')
        if not re.fullmatch(r'(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})', self.recipient_fingerprint):
            raise BackupError('full_recipient_fingerprint_required')
        if not isinstance(self.writer_services, list) or any(not re.fullmatch(r'aims[-\w@.:]*\.service', unit) or unit == 'aims-backup.service' for unit in self.writer_services):
            raise BackupError('invalid_writer_service')
        if not 1 <= self.retain_days <= 3650 or not 2 <= self.keep_minimum <= 3650 or self.minimum_free_mb < 0 or not 10 <= self.command_timeout_seconds <= 3600:
            raise BackupError('invalid_retention_or_limits')
        if not isinstance(self.offsite_required, bool):
            raise BackupError('invalid_offsite_required')

    @property
    def root(self):
        return Path(self.backup_dir).resolve()

    @property
    def state(self):
        return self.root / '.state'

    def pg(self, program):
        name = program + ('.exe' if os.name == 'nt' else '')
        found = str(Path(self.pg_bin_dir) / name) if self.pg_bin_dir else shutil.which(program)
        if not found or not Path(found).is_file():
            raise BackupError('postgresql_client_tools_missing')
        return found


def utcnow():
    return datetime.now(timezone.utc)


def stamp(now=None):
    return (now or utcnow()).isoformat()


def private_dir(path):
    if path.is_symlink():
        raise BackupError('private_directory_is_symlink')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != 'nt':
        os.chmod(path, 0o700)


def atomic_json(path, value):
    private_dir(path.parent)
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.partial')
    try:
        with os.fdopen(os.open(tmp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), 'w', encoding='utf-8') as output:
            json.dump(value, output, indent=2)
            output.flush()
            os.fsync(output.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


@contextmanager
def exclusive_lock(root):
    private_dir(root)
    with (root / '.backup.lock').open('a+b') as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b'0'); handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise BackupError('another_backup_is_running') from None
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def execute(args, stage, *, env=None, timeout=300):
    try:
        # Files avoid waiting for inherited stdout pipes from GnuPG helper processes.
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            argv = [arg.as_posix() if isinstance(arg, Path) else str(arg) for arg in args]
            # Git's bundled Windows GnuPG uses MSYS paths; native GnuPG does not.
            if os.name == 'nt' and '/git/usr/bin/gpg' in argv[0].replace('\\', '/').lower():
                argv = [argv[0]] + [('/' + arg[0].lower() + arg[2:].replace('\\', '/')) if re.match(r'^[A-Za-z]:[/\\]', arg) else arg for arg in argv[1:]]
            result = subprocess.run(argv, env=env, stdout=output, stderr=errors, timeout=timeout, stdin=subprocess.DEVNULL, check=False)
            output.seek(0)
            result.stdout = output.read()
    except subprocess.TimeoutExpired:
        raise BackupError(stage + '_timeout') from None
    except OSError:
        raise BackupError(stage + '_unavailable') from None
    if result.returncode:
        # Raw stderr/DSNs/records must never enter application logs or status files.
        raise BackupError(stage + '_failed')
    return result.stdout


def database_environment(config):
    try:
        values = dotenv_values(config.database_env_file)
        url = urlsplit(str(values.get('DATABASE_URL') or ''))
        database = unquote(url.path.lstrip('/'))
        host = url.hostname or ''
        if url.scheme not in {'postgresql', 'postgresql+psycopg2', 'postgresql+psycopg'} or host != config.expected_host or database != config.expected_database or not url.username:
            raise BackupError('database_target_mismatch')
        expected_assets = Path(values.get('ASSET_DIR') or Path(config.database_env_file).parent / 'assets')
        if not expected_assets.is_absolute():
            expected_assets = Path(config.database_env_file).parent / expected_assets
        if expected_assets.resolve() != Path(config.assets_dir).resolve():
            raise BackupError('upload_directory_target_mismatch')
        query = parse_qs(url.query)
        if set(query) - {'sslmode'}:
            raise BackupError('unsupported_database_connection_option')
        env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        env.update(PGHOST=host, PGPORT=str(url.port or 5432), PGDATABASE=database,
                   PGUSER=unquote(url.username), PGCONNECT_TIMEOUT='10', PGSSLMODE=query.get('sslmode', ['prefer'])[0])
        if url.password is not None:
            env['PGPASSWORD'] = unquote(url.password)
        return env
    except BackupError:
        raise
    except Exception:
        raise BackupError('database_configuration_unreadable') from None


def target_identity(config, env):
    output = execute([config.pg('psql'), '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
        "SELECT json_build_object('database', current_database(), 'size', pg_database_size(current_database()), 'server_version', current_setting('server_version_num'))"],
        'database_identity', env=env, timeout=30)
    try:
        info = json.loads(output)
        if info['database'] != config.expected_database or int(info['size']) < 0:
            raise ValueError()
        return info
    except Exception:
        raise BackupError('connected_database_target_mismatch') from None


def gpg_command(config):
    found = shutil.which(config.gpg_binary) if not Path(config.gpg_binary).is_absolute() else config.gpg_binary
    if not found or not Path(found).is_file():
        raise BackupError('gnupg_missing')
    return [found, '--homedir', Path(config.gpg_home).as_posix(), '--no-options', '--batch', '--no-tty']


def check_recipient(config):
    if not Path(config.gpg_home).is_dir():
        raise BackupError('public_keyring_missing')
    base = gpg_command(config)
    secret = execute(base + ['--with-colons', '--list-secret-keys'], 'public_keyring_check')
    if any(line.startswith((b'sec:', b'ssb:')) for line in secret.splitlines()):
        raise BackupError('recovery_private_key_must_not_be_on_backup_server')
    keys = execute(base + ['--with-colons', '--fingerprint', '--list-keys', config.recipient_fingerprint], 'recipient_check')
    fingerprints = [line.split(b':')[9].decode('ascii') for line in keys.splitlines() if line.startswith(b'fpr:')]
    if config.recipient_fingerprint.upper() not in fingerprints:
        raise BackupError('recipient_fingerprint_mismatch')


def upload_paths(root):
    root = Path(root).resolve()
    if not root.is_dir():
        raise BackupError('upload_directory_missing')
    result = []
    for folder, directories, files in os.walk(root, followlinks=False):
        for name in sorted(directories + files):
            path = Path(folder) / name
            relative = path.relative_to(root)
            if path.is_symlink() or path.resolve() != root / relative:
                raise BackupError('upload_symlink_not_supported')
            if any(part in {'.', '..'} or '\\' in part or ':' in part for part in relative.parts):
                raise BackupError('upload_path_not_portable')
            if not path.is_dir() and not path.is_file():
                raise BackupError('upload_special_file_not_supported')
            result.append(path)
    return sorted(result, key=lambda path: path.relative_to(root).as_posix())


def preflight(config):
    for program in ('psql', 'pg_dump', 'pg_restore'):
        config.pg(program)
    env = database_environment(config)
    info = target_identity(config, env)
    check_recipient(config)
    paths = upload_paths(config.assets_dir)
    estimate = sum(path.stat().st_size for path in paths if path.is_file()) + int(info['size'])
    if shutil.disk_usage(config.root).free < estimate * 3 + config.minimum_free_mb * CHUNK:
        raise BackupError('insufficient_backup_disk_space')
    return env, info


def resume_writers(config):
    path = config.state / 'paused-writers.json'
    if not path.exists():
        return
    try:
        units = json.loads(path.read_text(encoding='utf-8'))['services']
        if not isinstance(units, list) or any(unit not in config.writer_services for unit in units):
            raise ValueError()
    except Exception:
        raise BackupError('invalid_paused_writer_state') from None
    failed = False
    for unit in units:
        try:
            execute(['systemctl', 'start', unit], 'writer_resume', timeout=90)
            if execute(['systemctl', 'show', unit, '--property=ActiveState', '--value'], 'writer_resume_check', timeout=30).strip() != b'active':
                failed = True
        except BackupError:
            failed = True
    if failed:
        raise BackupError('writer_resume_failed')
    path.unlink()


@contextmanager
def pause_writers(config, offline=False):
    if offline:
        if config.writer_services:
            raise BackupError('offline_mode_requires_empty_writer_services')
        yield
        return
    if not config.writer_services or not sys.platform.startswith('linux'):
        raise BackupError('scheduled_backup_requires_linux_writer_services')
    if (config.state / 'paused-writers.json').exists():
        raise BackupError('previous_writers_need_resume')
    active = []
    for unit in config.writer_services:
        if execute(['systemctl', 'show', unit, '--property=LoadState', '--value'], 'writer_lookup', timeout=30).strip() != b'loaded':
            raise BackupError('writer_service_not_loaded')
        state = execute(['systemctl', 'show', unit, '--property=ActiveState', '--value'], 'writer_state', timeout=30).strip()
        if state in {b'active', b'activating', b'reloading'}:
            active.append(unit)
        elif state not in {b'inactive', b'failed'}:
            raise BackupError('writer_service_busy')
    atomic_json(config.state / 'paused-writers.json', {'services': active})
    try:
        for unit in active:
            execute(['systemctl', 'stop', unit], 'writer_pause', timeout=90)
        for unit in config.writer_services:
            if execute(['systemctl', 'show', unit, '--property=ActiveState', '--value'], 'writer_pause_check', timeout=30).strip() not in {b'inactive', b'failed'}:
                raise BackupError('writer_not_paused')
        yield
    finally:
        resume_writers(config)


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(CHUNK), b''):
            digest.update(block)
    return digest.hexdigest()


def create_upload_archive(root, output):
    root = Path(root).resolve()
    inventory = []
    with tarfile.open(output, 'w:gz', compresslevel=6, dereference=True) as archive:
        for path in upload_paths(root):
            relative = path.relative_to(root).as_posix()
            info = archive.gettarinfo(str(path), arcname='assets/' + relative)
            if path.is_dir():
                archive.addfile(info)
                continue
            before = path.stat()
            flags = os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0)
            with os.fdopen(os.open(path, flags), 'rb') as source:
                if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                    raise BackupError('upload_changed_during_backup')
                digest = hashlib.sha256()
                class Reader:
                    def read(self, size=-1):
                        data = source.read(size); digest.update(data); return data
                archive.addfile(info, Reader())
            after = path.stat()
            if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
                raise BackupError('upload_changed_during_backup')
            inventory.append({'path': relative, 'bytes': before.st_size, 'sha256': digest.hexdigest()})
    return inventory


def cleanup_work(path, root):
    path, root = Path(path), Path(root).resolve()
    if path.is_symlink() or path.resolve().parent != root or not WORK.fullmatch(path.name):
        raise BackupError('unsafe_temporary_cleanup_path')
    if path.exists():
        shutil.rmtree(path)


def prune(config, now=None):
    now = now or utcnow()
    candidates = []
    for path in config.root.glob('aims-backup-*.tar.gpg'):
        if path.is_symlink() or not path.is_file() or not NAME.fullmatch(path.name):
            continue
        sidecar = path.with_name(path.name + '.json')
        try:
            if sidecar.is_symlink():
                continue
            meta = json.loads(sidecar.read_text(encoding='utf-8'))
            created = datetime.fromisoformat(meta['created_at'])
            if not meta.get('complete') or created.tzinfo is None or meta['sha256'] != sha256_file(path):
                continue
            candidates.append((created, path, sidecar))
        except (OSError, ValueError, KeyError):
            continue
    candidates.sort(key=lambda item: (item[0], item[1].name), reverse=True)
    removed = 0
    for created, path, sidecar in candidates[config.keep_minimum:]:
        if created < now - timedelta(days=config.retain_days):
            if config.offsite_required:
                # Preserve retryable local backups until independently verified in S3.
                receipt = config.state / 'offsite' / (path.name + '.json')
                try:
                    if receipt.is_symlink():
                        continue
                    remote = json.loads(receipt.read_text(encoding='utf-8'))
                    if remote.get('sha256') != sha256_file(path) or not remote.get('verified_at'):
                        continue
                except (OSError, ValueError):
                    continue
            # Only these exact regular files are removed; no recursive pruning.
            path.unlink(); sidecar.unlink(); removed += 1
    return removed


def run_backup(config, offline=False):
    config.validate()
    with exclusive_lock(config.root):
        private_dir(config.state)
        if (config.state / 'paused-writers.json').exists():
            raise BackupError('previous_writers_need_resume')
        for old in config.root.glob('.work-*'):
            if WORK.fullmatch(old.name) and not old.is_symlink():
                cleanup_work(old, config.root)
        work = config.root / ('.work-' + uuid.uuid4().hex)
        private_dir(work)
        started = stamp()
        atomic_json(config.state / 'last-run.json', {'state': 'running', 'started_at': started})
        try:
            env, identity = preflight(config)
            with pause_writers(config, offline):
                target_identity(config, env)
                dump = work / 'database.dump'
                execute([config.pg('pg_dump'), '-w', '--format=custom', '--lock-wait-timeout=30000', '--file', dump],
                        'database_dump', env=env, timeout=config.command_timeout_seconds)
                execute([config.pg('pg_restore'), '--list', dump], 'dump_validation', timeout=config.command_timeout_seconds)
                if not dump.is_file() or dump.stat().st_size == 0:
                    raise BackupError('database_dump_empty')
                uploads = work / 'uploads.tar.gz'
                inventory = create_upload_archive(config.assets_dir, uploads)
                manifest = {'format_version': 1, 'created_at': stamp(), 'database': config.expected_database,
                    'postgresql_server_version': identity['server_version'], 'consistency': 'operator_confirmed_offline' if offline else 'writer_services_paused',
                    'database_sha256': sha256_file(dump), 'uploads_sha256': sha256_file(uploads), 'files': inventory}
                atomic_json(work / 'manifest.json', manifest)
                bundle = work / 'bundle.tar'
                with tarfile.open(bundle, 'w') as archive:
                    for name in ('database.dump', 'uploads.tar.gz', 'manifest.json'):
                        archive.add(work / name, arcname=name, recursive=False)
            # Backend resumes before validation/encryption, reducing maintenance time.
            verify_bundle(bundle)
            final = config.root / ('aims-backup-' + utcnow().strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8] + '.tar.gpg')
            encrypted = work / 'encrypted.partial'
            execute(gpg_command(config) + ['--trust-model', 'always', '--cipher-algo', 'AES256', '--compress-algo', 'none',
                '--recipient', config.recipient_fingerprint, '--output', encrypted, '--encrypt', bundle], 'encryption', timeout=config.command_timeout_seconds)
            if not encrypted.is_file() or encrypted.stat().st_size == 0:
                raise BackupError('encrypted_backup_empty')
            with encrypted.open('rb+') as source:
                os.fsync(source.fileno())
            meta = {'complete': True, 'created_at': manifest['created_at'], 'sha256': sha256_file(encrypted), 'bytes': encrypted.stat().st_size}
            os.replace(encrypted, final)
            atomic_json(final.with_name(final.name + '.json'), meta)
            removed = prune(config)
            result = {'state': 'ok', 'started_at': started, 'completed_at': stamp(), 'backup': final.name,
                      'bytes': meta['bytes'], 'sha256': meta['sha256'], 'upload_count': len(inventory), 'pruned': removed}
            atomic_json(config.state / 'last-success.json', result)
            atomic_json(config.state / 'last-run.json', result)
            return result
        except BaseException as error:
            code = str(error) if isinstance(error, BackupError) else 'backup_' + type(error).__name__.lower()
            atomic_json(config.state / 'last-run.json', {'state': 'failed', 'started_at': started, 'completed_at': stamp(), 'error': code})
            raise BackupError(code) from None
        finally:
            cleanup_work(work, config.root)


def safe_archive_path(name):
    path = PurePosixPath(name)
    return not path.is_absolute() and bool(path.parts) and all(part not in {'..', '.'} and '\\' not in part and ':' not in part for part in path.parts)


def verify_bundle(filename):
    """Verify decrypted contents without extracting files or touching any database."""
    try:
        with tarfile.open(filename, 'r:') as bundle:
            members = bundle.getmembers()
            if len(members) != 3 or {m.name for m in members} != {'database.dump', 'uploads.tar.gz', 'manifest.json'} or any(not m.isfile() for m in members):
                raise BackupError('invalid_bundle_members')
            if bundle.getmember('manifest.json').size > 64 * CHUNK:
                raise BackupError('manifest_too_large')
            manifest = json.load(bundle.extractfile('manifest.json'))
            if manifest.get('format_version') != 1 or not isinstance(manifest.get('files'), list):
                raise BackupError('unsupported_manifest_format')
            for name, key in [('database.dump', 'database_sha256'), ('uploads.tar.gz', 'uploads_sha256')]:
                digest = hashlib.sha256()
                with bundle.extractfile(name) as source:
                    for block in iter(lambda: source.read(CHUNK), b''):
                        digest.update(block)
                if digest.hexdigest() != manifest[key]:
                    raise BackupError('bundle_checksum_mismatch')
            expected = {item['path']: item for item in manifest['files']}
            if len(expected) != len(manifest['files']):
                raise BackupError('duplicate_upload_manifest_entry')
            seen = set()
            with tarfile.open(fileobj=bundle.extractfile('uploads.tar.gz'), mode='r|gz') as uploads:
                for member in uploads:
                    if not safe_archive_path(member.name) or not member.name.startswith('assets/'):
                        raise BackupError('unsafe_upload_archive_path')
                    if member.isdir():
                        continue
                    relative = member.name[len('assets/'):]
                    if not member.isfile() or relative in seen or relative not in expected:
                        raise BackupError('invalid_upload_archive_member')
                    digest = hashlib.sha256()
                    with uploads.extractfile(member) as source:
                        for block in iter(lambda: source.read(CHUNK), b''):
                            digest.update(block)
                    if member.size != expected[relative]['bytes'] or digest.hexdigest() != expected[relative]['sha256']:
                        raise BackupError('upload_checksum_mismatch')
                    seen.add(relative)
            if seen != set(expected):
                raise BackupError('upload_missing_from_archive')
            return {'verified': True, 'upload_count': len(seen), 'format_version': manifest['format_version']}
    except BackupError:
        raise
    except Exception:
        raise BackupError('invalid_backup_bundle') from None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('run', 'check', 'resume'):
        command = sub.add_parser(name)
        command.add_argument('--config', required=True)
        if name == 'run':
            command.add_argument('--offline', action='store_true', help='Operator confirms all writers are stopped; manual/test use only')
    verify = sub.add_parser('verify-bundle'); verify.add_argument('bundle')
    args = parser.parse_args(argv)
    try:
        if args.command == 'verify-bundle':
            result = verify_bundle(args.bundle)
        else:
            config = Config.read(args.config)
            if args.command == 'run':
                result = run_backup(config, args.offline)
            elif args.command == 'resume':
                with exclusive_lock(config.root):
                    resume_writers(config)
                result = {'writers_resumed': True}
            else:
                with exclusive_lock(config.root):
                    _, identity = preflight(config)
                result = {'configuration_valid': True, 'database_target_confirmed': identity['database'], 'recovery_key_is_public_only': True}
        print(json.dumps(result))
        return 0
    except BackupError as error:
        print(json.dumps({'state': 'failed', 'error': str(error)}), file=sys.stderr)
        return 1
    except Exception:
        print(json.dumps({'state': 'failed', 'error': 'operation_failed'}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    def interrupted(_signal, _frame):
        raise BackupError('backup_interrupted')
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, interrupted)
    raise SystemExit(main())
