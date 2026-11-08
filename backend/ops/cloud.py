#!/usr/bin/env python3
"""Replicate ciphertext, check backup health and accept independent restore evidence.

No database access, private keys, application imports or live restore operations.
AWS credentials come exclusively from the EC2 instance role, never static keys.
"""
from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile

import backup

MAX_OBJECT = 4 * 1024**3  # Single PUT; fail visibly before exceeding its 5 GB limit.
NAMESPACE = 'AIMS/Backups'


@dataclass
class CloudConfig:
    bucket: str
    account_id: str
    region: str
    instance_id: str
    topic_arn: str
    prefix: str = 'production/'
    backup_config: str = '/etc/aims/backup.json'
    freshness_hours: int = 30
    recovery_days: int = 35

    @classmethod
    def read(cls, filename):
        try:
            value = cls(**json.loads(Path(filename).read_text(encoding='utf-8-sig')))
            value.validate()
            return value
        except backup.BackupError:
            raise
        except Exception:
            raise backup.BackupError('invalid_cloud_configuration') from None

    def validate(self):
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', self.bucket):
            raise backup.BackupError('invalid_bucket')
        if not re.fullmatch(r'\d{12}', self.account_id) or not re.fullmatch(r'[a-z]{2}-[a-z]+-\d', self.region):
            raise backup.BackupError('invalid_aws_target')
        if not re.fullmatch(r'i-[0-9a-f]{8,17}', self.instance_id) or not re.fullmatch(r'[a-z0-9][a-z0-9/_-]{0,80}/', self.prefix) or '..' in self.prefix:
            raise backup.BackupError('invalid_cloud_scope')
        if not re.fullmatch(r'arn:aws:sns:' + re.escape(self.region) + ':' + self.account_id + r':[A-Za-z0-9_-]+', self.topic_arn):
            raise backup.BackupError('invalid_alert_topic')
        if not Path(self.backup_config).is_absolute() or not 24 <= self.freshness_hours <= 72 or not 7 <= self.recovery_days <= 90:
            raise backup.BackupError('invalid_cloud_limits')


def session_for_instance(config):
    # An explicit provider prevents inheriting shell AWS keys or ~/.aws profiles.
    import boto3
    import botocore.session
    from botocore.credentials import InstanceMetadataProvider, CredentialResolver
    from botocore.utils import InstanceMetadataFetcher
    from botocore.config import Config
    provider = InstanceMetadataProvider(iam_role_fetcher=InstanceMetadataFetcher(timeout=3, num_attempts=2))
    core = botocore.session.Session()
    core.register_component('credential_provider', CredentialResolver([provider]))
    session = boto3.Session(botocore_session=core, region_name=config.region)
    client_config = Config(connect_timeout=5, read_timeout=30, retries={'max_attempts': 3, 'mode': 'standard'}, ignore_configured_endpoint_urls=True)
    if session.get_credentials() is None:
        raise backup.BackupError('ec2_instance_role_required')
    sts = session.client('sts', config=client_config)
    identity = sts.get_caller_identity()
    if identity['Account'] != config.account_id or not identity['Arn'].endswith('/' + config.instance_id):
        raise backup.BackupError('unexpected_aws_identity')
    return {name: session.client(name, config=client_config) for name in ('s3', 'cloudwatch', 'sns')}


def time_value(value):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise backup.BackupError('timestamp_timezone_required')
    return parsed


def fresh(value, now, maximum):
    try:
        elapsed = now - time_value(value)
        return timedelta(minutes=-5) <= elapsed <= maximum
    except (TypeError, ValueError, backup.BackupError):
        return False


def read_json(path):
    if path.is_symlink() or path.stat().st_size > 1024 * 1024:
        raise backup.BackupError('unsafe_state_file')
    return json.loads(path.read_text(encoding='utf-8'))


def artifact(config, path):
    if path.parent != config.root or path.is_symlink() or not path.is_file() or not backup.NAME.fullmatch(path.name):
        raise backup.BackupError('invalid_encrypted_backup')
    meta = read_json(path.with_name(path.name + '.json'))
    if meta.get('complete') is not True or meta.get('bytes') != path.stat().st_size or not 0 < meta['bytes'] <= MAX_OBJECT or meta.get('sha256') != backup.sha256_file(path):
        raise backup.BackupError('local_backup_integrity_failed')
    time_value(meta['created_at'])
    return meta


def checksum_b64(digest):
    return base64.b64encode(bytes.fromhex(digest)).decode('ascii')


def head_verified(s3, cloud, key, digest, size):
    response = s3.head_object(Bucket=cloud.bucket, Key=key, ExpectedBucketOwner=cloud.account_id, ChecksumMode='ENABLED')
    if response.get('ContentLength') != size or response.get('ChecksumSHA256') != checksum_b64(digest):
        raise backup.BackupError('offsite_checksum_mismatch')
    return response


def put_once(s3, cloud, key, source, digest, size):
    from botocore.exceptions import ClientError
    try:
        s3.put_object(Bucket=cloud.bucket, Key=key, Body=source, ContentLength=size, ExpectedBucketOwner=cloud.account_id,
                      ChecksumSHA256=checksum_b64(digest), ServerSideEncryption='AES256', IfNoneMatch='*')
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') not in ('PreconditionFailed', '412'):
            raise
        # Retried submissions accept only an identical already uploaded object.
    head_verified(s3, cloud, key, digest, size)


def replicate(cloud, config, s3):
    paths = sorted(config.root.glob('aims-backup-*.tar.gpg'))
    count = 0
    for path in paths:
        meta = artifact(config, path)
        receipt_file = config.state / 'offsite' / (path.name + '.json')
        key = cloud.prefix + path.name
        receipt = read_json(receipt_file) if receipt_file.exists() else {}
        if receipt.get('sha256') == meta['sha256'] and receipt.get('bucket') == cloud.bucket and receipt.get('key') == key:
            continue
        with path.open('rb') as source:
            put_once(s3, cloud, key, source, meta['sha256'], meta['bytes'])
        sidecar = path.with_name(path.name + '.json')
        with sidecar.open('rb') as source:
            put_once(s3, cloud, key + '.json', source, backup.sha256_file(sidecar), sidecar.stat().st_size)
        receipt = {'backup': path.name, 'sha256': meta['sha256'], 'bytes': meta['bytes'], 'bucket': cloud.bucket, 'key': key, 'verified_at': backup.stamp()}
        backup.atomic_json(receipt_file, receipt)
        count += 1
    return count


def latest(config):
    state = read_json(config.state / 'last-success.json')
    path = config.root / state['backup']
    meta = artifact(config, path)
    if state['sha256'] != meta['sha256']:
        raise backup.BackupError('last_success_mismatch')
    return state, path, meta


def stream_object(s3, cloud, key, meta, output):
    head_verified(s3, cloud, key, meta['sha256'], meta['bytes'])
    response = s3.get_object(Bucket=cloud.bucket, Key=key, ExpectedBucketOwner=cloud.account_id, ChecksumMode='ENABLED')
    digest, size = hashlib.sha256(), 0
    body = response['Body']
    try:
        while block := body.read(backup.CHUNK):
            size += len(block)
            if size > meta['bytes']:
                raise backup.BackupError('offsite_object_size_mismatch')
            digest.update(block)
            output.write(block)
    finally:
        body.close()
    if size != meta['bytes'] or digest.hexdigest() != meta['sha256']:
        raise backup.BackupError('offsite_download_checksum_mismatch')


def accept_recovery(config, cloud, s3, value):
    if set(value) != {'backup', 'sha256', 'verified_at', 'restored_tables', 'restored_rows', 'upload_count', 'isolated_restore', 'all_upload_hashes_match'}:
        raise backup.BackupError('invalid_recovery_evidence')
    name = value['backup']
    if not backup.NAME.fullmatch(name) or not re.fullmatch(r'[0-9a-f]{64}', value['sha256']) or not fresh(value['verified_at'], backup.utcnow(), timedelta(hours=1)):
        raise backup.BackupError('invalid_recovery_evidence')
    if value['isolated_restore'] is not True or value['all_upload_hashes_match'] is not True or any(type(value[k]) is not int or value[k] < 0 for k in ('restored_tables', 'restored_rows', 'upload_count')) or value['restored_tables'] < 1:
        raise backup.BackupError('recovery_not_verified')
    # A fresh receipt for an old backup must not hide an overdue real recovery.
    meta = artifact(config, config.root / name)
    if value['sha256'] != meta['sha256'] or not fresh(meta['created_at'], backup.utcnow(), timedelta(hours=cloud.freshness_hours)):
        raise backup.BackupError('recovery_backup_is_stale')
    head_verified(s3, cloud, cloud.prefix + name, meta['sha256'], meta['bytes'])
    backup.atomic_json(config.state / 'last-recovery.json', value)
    return {'recovery_evidence_accepted': True}


def monitor(cloud, config, s3):
    now = backup.utcnow()
    health = {'BackupHealthy': 0, 'OffsiteHealthy': 0, 'RecoveryHealthy': 0}
    try:
        state, path, meta = latest(config)
        last_run = read_json(config.state / 'last-run.json')
        healthy_run = last_run.get('state') == 'ok' or (last_run.get('state') == 'running' and fresh(last_run.get('started_at'), now, timedelta(minutes=25)))
        health['BackupHealthy'] = int(healthy_run and fresh(state['completed_at'], now, timedelta(hours=cloud.freshness_hours)))
        # Independently read ciphertext from S3; no decryption keys on EC2.
        with tempfile.TemporaryFile() as sink:
            stream_object(s3, cloud, cloud.prefix + path.name, meta, sink)
        health['OffsiteHealthy'] = int(fresh(meta['created_at'], now, timedelta(hours=cloud.freshness_hours)))
    except Exception:
        pass
    try:
        evidence = read_json(config.state / 'last-recovery.json')
        health['RecoveryHealthy'] = int(evidence['isolated_restore'] is True and evidence['all_upload_hashes_match'] is True and fresh(evidence['verified_at'], now, timedelta(days=cloud.recovery_days)))
    except Exception:
        pass
    return health


def publish_metrics(cloud, clients, health):
    clients['cloudwatch'].put_metric_data(Namespace=NAMESPACE, MetricData=[{'MetricName': name, 'Dimensions': [{'Name': 'InstanceId', 'Value': cloud.instance_id}], 'Value': value, 'Unit': 'Count'} for name, value in health.items()])


def alert(cloud, config, clients, codes):
    codes = sorted(set(codes))
    previous = config.state / 'last-cloud-alert.json'
    if previous.exists():
        value = read_json(previous)
        if value.get('codes') == codes and fresh(value.get('sent_at'), backup.utcnow(), timedelta(hours=24)):
            return
    # Fixed codes only: never send DB credentials, paths, student data or exceptions.
    clients['sns'].publish(TopicArn=cloud.topic_arn, Subject='AIMS backup attention required', Message='AIMS backup checks need attention: ' + ', '.join(codes) + '. Review the protected backup service status on EC2.')
    backup.atomic_json(previous, {'codes': codes, 'sent_at': backup.stamp()})


def run(cloud, config, clients):
    with backup.exclusive_lock(config.root):
        errors, replicated = [], 0
        try:
            replicated = replicate(cloud, config, clients['s3'])
        except Exception:
            errors.append('offsite_replication_failed')
        health = monitor(cloud, config, clients['s3'])
        try:
            publish_metrics(cloud, clients, health)
        except Exception:
            errors.append('backup_metrics_failed')
        errors.extend(name for name, value in health.items() if not value)
        if errors:
            try:
                alert(cloud, config, clients, errors)
            except Exception:
                errors.append('backup_alert_publish_failed')
        else:
            (config.state / 'last-cloud-alert.json').unlink(missing_ok=True)
        result = {'checked_at': backup.stamp(), 'state': 'failed' if errors else 'ok', 'replicated': replicated, 'health': health, 'errors': errors}
        backup.atomic_json(config.state / 'last-cloud-run.json', result)
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['check', 'run', 'export', 'metadata', 'accept-recovery', 'test-alert'])
    parser.add_argument('--config', default='/etc/aims/backup-cloud.json')
    parser.add_argument('--backup')
    args = parser.parse_args(argv)
    try:
        cloud = CloudConfig.read(args.config)
        config = backup.Config.read(cloud.backup_config)
        clients = session_for_instance(cloud)
        if args.command == 'run':
            result = run(cloud, config, clients)
        elif args.command == 'check':
            clients['s3'].head_bucket(Bucket=cloud.bucket, ExpectedBucketOwner=cloud.account_id)
            result = {'aws_identity_verified': True, 'bucket_access_verified': True}
        elif args.command == 'test-alert':
            clients['sns'].publish(TopicArn=cloud.topic_arn, Subject='AIMS backup alert test', Message='AIMS backup alert delivery test. No application or student data is included.')
            result = {'alert_accepted_by_sns': True, 'email_delivery_requires_confirmed_subscription': True}
        elif args.command == 'accept-recovery':
            raw = sys.stdin.buffer.read(16385)
            if len(raw) > 16384:
                raise backup.BackupError('recovery_evidence_too_large')
            with backup.exclusive_lock(config.root):
                result = accept_recovery(config, cloud, clients['s3'], json.loads(raw))
        else:
            with backup.exclusive_lock(config.root):
                state, path, meta = latest(config)
                if args.command == 'metadata':
                    head_verified(clients['s3'], cloud, cloud.prefix + path.name, meta['sha256'], meta['bytes'])
                    result = {'backup': path.name, **meta}
                else:
                    # Pin to the exact filename fetched by the recovery computer.
                    if args.backup != path.name:
                        raise backup.BackupError('backup_changed_retry_metadata')
                    stream_object(clients['s3'], cloud, cloud.prefix + path.name, meta, sys.stdout.buffer)
                    return 0
        print(json.dumps(result))
        return 1 if result.get('state') == 'failed' else 0
    except Exception as error:
        code = str(error) if isinstance(error, backup.BackupError) else 'cloud_operation_failed'
        print(json.dumps({'state': 'failed', 'error': code}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
