#!/usr/bin/env python3
"""Monthly recovery drill on a trusted Windows PC. Never restore a live DB.

Fetches encrypted backup from S3 via the existing EC2 SSH connection. GnuPG uses
the local keyring/agent; if locked, the drill fails safely without prompting or
storing a passphrase. No application API or notification worker is launched.
"""
from __future__ import annotations
import argparse
from datetime import timedelta
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import uuid

import backup


def command(args, work, stage, env=None, stdin=None, timeout=300, output=None):
    with tempfile.TemporaryFile() as errors, tempfile.TemporaryFile() as capture:
        result = subprocess.run([str(v) for v in args], input=stdin, stdout=output or capture, stderr=errors, env=env, timeout=timeout, check=False)
        if result.returncode:
            raise backup.BackupError(stage + '_failed')
        capture.seek(0)
        return capture.read()


def validate(config):
    if os.name != 'nt':
        raise backup.BackupError('windows_recovery_computer_required')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}@[a-zA-Z0-9.-]+', config['ssh_target']):
        raise backup.BackupError('invalid_recovery_ssh_target')
    for key in ('ssh_identity', 'pg_bin_dir', 'gpg_binary', 'gpg_home', 'state_dir'):
        if not Path(config[key]).is_absolute():
            raise backup.BackupError('recovery_paths_must_be_absolute')
    if not re.fullmatch(r'[A-Fa-f0-9]{40}|[A-Fa-f0-9]{64}', config['recipient_fingerprint']):
        raise backup.BackupError('invalid_recovery_fingerprint')


def establish_private_work():
    work = Path(tempfile.mkdtemp(prefix='aims-recovery-')).resolve()
    # Windows chmod does not restrict NTFS access: explicitly set an owner-only ACL.
    # .NET uses the current SID, not localized account-name or shell interpolation.
    acl = "$p=$args[0]; $s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $a=New-Object System.Security.AccessControl.DirectorySecurity; $a.SetOwner($s); $a.SetAccessRuleProtection($true,$false); $r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $a.AddAccessRule($r); Set-Acl -LiteralPath $p -AclObject $a"
    script = work / 'private-acl.ps1'
    script.write_text(acl, encoding='utf-8')
    command(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, work], work, 'private_recovery_directory')
    script.unlink()
    return work


def safe_cleanup(work):
    root = Path(tempfile.gettempdir()).resolve()
    if work.parent != root or work.is_symlink() or not re.fullmatch(r'aims-recovery-[a-z0-9_]+', work.name):
        raise backup.BackupError('unsafe_recovery_cleanup')
    shutil.rmtree(work)


def drill(config, force=False):
    validate(config)
    state_dir = Path(config['state_dir'])
    backup.private_dir(state_dir)
    with backup.exclusive_lock(state_dir):
        success = state_dir / 'last-recovery.json'
        if success.exists() and not force:
            value = json.loads(success.read_text())
            try:
                age = backup.utcnow() - __import__('datetime').datetime.fromisoformat(value['verified_at'])
                if timedelta() <= age < timedelta(days=30):
                    return {'state': 'not_due', 'last_verified_at': value['verified_at']}
            except (ValueError, KeyError):
                pass
        return execute_drill(config, state_dir)


def execute_drill(config, state_dir):
    work = establish_private_work()
    started = False
    stopped = True
    pg = Path(config['pg_bin_dir'])
    cluster = work / 'pg'
    ssh = ['ssh', '-i', config['ssh_identity'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', config['ssh_target']]
    remote = 'sudo /opt/aims-backup/venv/bin/python /opt/aims-backup/cloud.py '
    try:
        meta = json.loads(command(ssh + [remote + 'metadata'], work, 'offsite_metadata'))
        if not backup.NAME.fullmatch(meta['backup']) or not re.fullmatch(r'[0-9a-f]{64}', meta['sha256']) or not 0 < meta['bytes'] <= 4 * 1024**3:
            raise backup.BackupError('invalid_recovery_metadata')
        created = __import__('datetime').datetime.fromisoformat(meta['created_at'])
        if created.tzinfo is None or not timedelta(minutes=-5) <= backup.utcnow() - created <= timedelta(hours=30):
            raise backup.BackupError('offsite_backup_is_stale')
        if shutil.disk_usage(work).free < meta['bytes'] * 20 + 512 * 1024**2:
            raise backup.BackupError('insufficient_recovery_disk_space')
        encrypted = work / meta['backup']
        with encrypted.open('wb') as output:
            command(ssh + [remote + 'export --backup ' + meta['backup']], work, 'offsite_download', output=output)
        if encrypted.stat().st_size != meta['bytes'] or backup.sha256_file(encrypted) != meta['sha256']:
            raise backup.BackupError('offsite_download_checksum_mismatch')
        bundle = work / 'bundle.tar'
        # No passphrase argument/file/environment. Locked agent means a safe failure.
        base = [config['gpg_binary'], '--homedir', Path(config['gpg_home']), '--no-options', '--batch', '--yes', '--pinentry-mode', 'error', '--try-secret-key', config['recipient_fingerprint']]
        backup.execute(base + ['--output', bundle, '--decrypt', encrypted], 'local_key_unlock_required', timeout=300)
        backup.verify_bundle(bundle)
        recovered = work / 'restored'; recovered.mkdir()
        with tarfile.open(bundle, 'r:') as archive:
            for name in ('database.dump', 'uploads.tar.gz', 'manifest.json'):
                with archive.extractfile(name) as source, (recovered / name).open('wb') as output:
                    shutil.copyfileobj(source, output)
        manifest = json.loads((recovered / 'manifest.json').read_text())
        password = secrets.token_urlsafe(32)
        password_file = work / 'init-password'; password_file.write_text(password)
        command([pg / 'initdb.exe', '-D', cluster, '-U', 'aims_restore_check', '-A', 'scram-sha-256', '--pwfile', password_file, '--encoding=UTF8', '--locale=C'], work, 'isolated_cluster_init')
        password_file.unlink()
        with socket.socket() as reserve:
            reserve.bind(('127.0.0.1', 0)); port = reserve.getsockname()[1]
        started, stopped = True, False
        command([pg / 'pg_ctl.exe', '-D', cluster, '-l', work / 'postgres.log', '-o', f'-p {port} -h 127.0.0.1', '-w', 'start'], work, 'isolated_postgres_start')
        import psycopg2
        from psycopg2 import sql
        connection = {'host': '127.0.0.1', 'port': port, 'user': 'aims_restore_check', 'password': password}
        database = 'aims_recovery_' + uuid.uuid4().hex
        admin = psycopg2.connect(dbname='postgres', **connection); admin.autocommit = True
        try:
            with admin.cursor() as cursor:
                cursor.execute("SELECT current_setting('data_directory'), host(inet_server_addr()), inet_server_port()")
                directory, host, actual_port = cursor.fetchone()
                if not os.path.samefile(directory, cluster) or host != '127.0.0.1' or actual_port != port or database == 'aims_db':
                    raise backup.BackupError('isolated_restore_target_mismatch')
                cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database)))
        finally:
            admin.close()
        env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        env.update(PGHOST='127.0.0.1', PGPORT=str(port), PGUSER='aims_restore_check', PGPASSWORD=password, PGDATABASE=database)
        command([pg / 'pg_restore.exe', '-w', '--exit-on-error', '--no-owner', '--no-privileges', '--dbname', database, recovered / 'database.dump'], work, 'isolated_database_restore', env=env)
        rows, tables = 0, 0
        restored = psycopg2.connect(dbname=database, **connection); restored.set_session(readonly=True)
        try:
            with restored.cursor() as cursor:
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
                names = [r[0] for r in cursor.fetchall()]
                if not names:
                    raise backup.BackupError('restored_database_has_no_tables')
                for name in names:
                    cursor.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(name)))
                    rows += cursor.fetchone()[0]; tables += 1
        finally:
            restored.close()
        with tarfile.open(recovered / 'uploads.tar.gz', 'r:gz') as archive:
            archive.extractall(recovered, filter='data')
        for item in manifest['files']:
            path = (recovered / 'assets' / item['path']).resolve()
            if not path.is_relative_to(recovered / 'assets') or backup.sha256_file(path) != item['sha256']:
                raise backup.BackupError('restored_upload_checksum_mismatch')
        evidence = {'backup': meta['backup'], 'sha256': meta['sha256'], 'verified_at': backup.stamp(), 'restored_tables': tables, 'restored_rows': rows,
                    'upload_count': len(manifest['files']), 'isolated_restore': True, 'all_upload_hashes_match': True}
        command([pg / 'pg_ctl.exe', '-D', cluster, '-m', 'fast', '-w', 'stop'], work, 'isolated_postgres_stop')
        stopped = True
        command(ssh + [remote + 'accept-recovery'], work, 'recovery_evidence_upload', stdin=json.dumps(evidence).encode())
        backup.atomic_json(state_dir / 'last-recovery.json', evidence)
        backup.atomic_json(state_dir / 'last-run.json', {'state': 'ok', **evidence})
        return {'state': 'ok', **evidence}
    except Exception as error:
        code = str(error) if isinstance(error, backup.BackupError) else 'recovery_check_failed'
        backup.atomic_json(state_dir / 'last-run.json', {'state': 'failed', 'checked_at': backup.stamp(), 'error': code})
        raise backup.BackupError(code) from None
    finally:
        if started and not stopped:
            try:
                command([pg / 'pg_ctl.exe', '-D', cluster, '-m', 'fast', '-w', 'stop'], work, 'isolated_postgres_stop')
                stopped = True
            except Exception:
                # Never delete data files underneath a potentially running server.
                pass
        if stopped:
            safe_cleanup(work)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    try:
        result = drill(json.loads(Path(args.config).read_text(encoding='utf-8-sig')), args.force)
        print(json.dumps(result))
        return 0
    except Exception as error:
        print(json.dumps({'state': 'failed', 'error': str(error) if isinstance(error, backup.BackupError) else 'recovery_check_failed'}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
