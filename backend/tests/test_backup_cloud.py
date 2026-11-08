"""Isolated ciphertext replication, role restrictions, health and recovery tests."""
import base64
from datetime import timedelta
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from unittest import TestCase
from unittest.mock import patch, Mock

OPS = Path(__file__).resolve().parents[1] / 'ops'
sys.path.insert(0, str(OPS))
import backup
import cloud
import recovery
try:
    from botocore.exceptions import ClientError
    from botocore.stub import Stubber
    import boto3
except ImportError:
    from unittest import SkipTest
    raise SkipTest('Install ops/requirements-cloud.txt in an isolated operations test environment')


class MemoryS3:
    def __init__(self): self.objects={}; self.fail_put=False; self.corrupt=False; self.puts=0
    def put_object(self, **args):
        self.puts+=1
        if self.fail_put: raise RuntimeError('private password student name DO NOT LOG')
        if args['Key'] in self.objects:
            raise ClientError({'Error':{'Code':'PreconditionFailed'}}, 'PutObject')
        data=args['Body'].read()
        assert args['IfNoneMatch']=='*' and args['ServerSideEncryption']=='AES256'
        assert args['ChecksumSHA256']==base64.b64encode(__import__('hashlib').sha256(data).digest()).decode()
        self.objects[args['Key']]=(data,args['ChecksumSHA256'])
    def head_object(self, **args):
        data,digest=self.objects[args['Key']]
        return {'ContentLength':len(data),'ChecksumSHA256':digest}
    def get_object(self, **args):
        data,_=self.objects[args['Key']]
        return {'Body':io.BytesIO(data+b'x' if self.corrupt else data)}


class CloudBackupTests(TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name); self.dest=self.root/'backups'; self.dest.mkdir()
        self.cfg=backup.Config(str(self.root/'env'),'synthetic','localhost',str(self.root/'assets'),str(self.dest),str(self.root/'keys'),'A'*40,writer_services=[])
        self.cloud=cloud.CloudConfig('aims-test-bucket','123456789012','ap-southeast-2','i-0123456789abcdef0','arn:aws:sns:ap-southeast-2:123456789012:aims-alerts')
        self.s3=MemoryS3(); self.now=backup.utcnow()
        self.path=self.dest/'aims-backup-20261109T000000Z-abcdef12.tar.gpg'; self.path.write_bytes(b'encrypted synthetic bytes')
        self.meta={'complete':True,'created_at':backup.stamp(self.now),'bytes':self.path.stat().st_size,'sha256':backup.sha256_file(self.path)}
        backup.atomic_json(self.path.with_name(self.path.name+'.json'),self.meta)
        self.state={'state':'ok','backup':self.path.name,'completed_at':backup.stamp(self.now),'sha256':self.meta['sha256']}
        backup.atomic_json(self.cfg.state/'last-success.json',self.state)
        backup.atomic_json(self.cfg.state/'last-run.json',self.state)
    def evidence(self):
        return {'backup':self.path.name,'sha256':self.meta['sha256'],'verified_at':backup.stamp(),'restored_tables':2,'restored_rows':3,'upload_count':1,'isolated_restore':True,'all_upload_hashes_match':True}
    def test_ciphertext_and_sidecar_uploaded_then_retry_is_idempotent(self):
        self.assertEqual(cloud.replicate(self.cloud,self.cfg,self.s3),1)
        self.assertEqual(self.s3.puts,2)
        self.assertEqual(cloud.replicate(self.cloud,self.cfg,self.s3),0)
        self.assertEqual(self.s3.puts,2)
        self.assertEqual(set(self.s3.objects),{self.cloud.prefix+self.path.name,self.cloud.prefix+self.path.name+'.json'})
    def test_failed_upload_does_not_create_receipt_or_delete_local_backup(self):
        self.s3.fail_put=True
        with self.assertRaises(RuntimeError): cloud.replicate(self.cloud,self.cfg,self.s3)
        self.assertTrue(self.path.exists()); self.assertFalse((self.cfg.state/'offsite').exists())
    def test_retry_after_crash_does_not_overwrite_existing_object(self):
        cloud.replicate(self.cloud,self.cfg,self.s3)
        (self.cfg.state/'offsite'/(self.path.name+'.json')).unlink()
        self.assertEqual(cloud.replicate(self.cloud,self.cfg,self.s3),1)
    def test_remote_existing_object_with_wrong_checksum_is_rejected(self):
        self.s3.objects[self.cloud.prefix+self.path.name]=(b'tampered','wrong')
        with self.assertRaisesRegex(backup.BackupError,'offsite_checksum_mismatch'): cloud.replicate(self.cloud,self.cfg,self.s3)
        self.assertFalse((self.cfg.state/'offsite').exists())
    def test_unrecognized_file_and_invalid_local_sidecar_refused(self):
        self.meta['sha256']='0'*64
        backup.atomic_json(self.path.with_name(self.path.name+'.json'),self.meta)
        with self.assertRaisesRegex(backup.BackupError,'local_backup_integrity_failed'): cloud.replicate(self.cloud,self.cfg,self.s3)
        self.assertEqual(self.s3.puts,0)
    def test_full_download_detects_corruption_even_if_head_matches(self):
        cloud.replicate(self.cloud,self.cfg,self.s3); self.s3.corrupt=True
        self.assertEqual(cloud.monitor(self.cloud,self.cfg,self.s3)['OffsiteHealthy'],0)
    def test_stale_and_failed_backup_and_overdue_recovery_health(self):
        cloud.replicate(self.cloud,self.cfg,self.s3)
        health=cloud.monitor(self.cloud,self.cfg,self.s3)
        self.assertEqual(health,{'BackupHealthy':1,'OffsiteHealthy':1,'RecoveryHealthy':0})
        backup.atomic_json(self.cfg.state/'last-run.json',{'state':'failed'})
        self.assertEqual(cloud.monitor(self.cloud,self.cfg,self.s3)['BackupHealthy'],0)
        with patch.object(backup,'utcnow',return_value=self.now+timedelta(hours=31)):
            self.assertEqual(cloud.monitor(self.cloud,self.cfg,self.s3)['OffsiteHealthy'],0)
    def test_accepts_only_actual_fresh_backup_and_independent_restore_evidence(self):
        cloud.replicate(self.cloud,self.cfg,self.s3)
        self.assertTrue(cloud.accept_recovery(self.cfg,self.cloud,self.s3,self.evidence())['recovery_evidence_accepted'])
        self.assertEqual(cloud.monitor(self.cloud,self.cfg,self.s3)['RecoveryHealthy'],1)
        bad=self.evidence();bad['isolated_restore']=False
        with self.assertRaisesRegex(backup.BackupError,'recovery_not_verified'):cloud.accept_recovery(self.cfg,self.cloud,self.s3,bad)
        with patch.object(backup,'utcnow',return_value=self.now+timedelta(days=36)):
            self.assertEqual(cloud.monitor(self.cloud,self.cfg,self.s3)['RecoveryHealthy'],0)
    def test_fresh_receipt_for_stale_backup_rejected(self):
        cloud.replicate(self.cloud,self.cfg,self.s3)
        with patch.object(backup,'utcnow',return_value=self.now+timedelta(days=2)):
            value=self.evidence()
            with self.assertRaisesRegex(backup.BackupError,'recovery_backup_is_stale'):cloud.accept_recovery(self.cfg,self.cloud,self.s3,value)
    def test_retention_keeps_unreplicated_backups(self):
        self.cfg.offsite_required=True
        # Create 3 old complete backups so one would normally be expired.
        for n in range(3):
            p=self.dest/f'aims-backup-20261001T000000Z-abcdef1{n}.tar.gpg';p.write_bytes(b'synthetic')
            backup.atomic_json(p.with_name(p.name+'.json'),{'complete':True,'created_at':backup.stamp(self.now-timedelta(days=40+n)),'sha256':backup.sha256_file(p)})
        self.assertEqual(backup.prune(self.cfg),0)
        oldest=self.dest/'aims-backup-20261001T000000Z-abcdef12.tar.gpg'
        backup.atomic_json(self.cfg.state/'offsite'/(oldest.name+'.json'),{'sha256':backup.sha256_file(oldest),'verified_at':backup.stamp()})
        self.assertEqual(backup.prune(self.cfg),1)
    def test_alert_contains_only_fixed_codes_and_is_deduplicated(self):
        clients={'s3':self.s3,'cloudwatch':Mock(),'sns':Mock()};self.s3.fail_put=True
        result=cloud.run(self.cloud,self.cfg,clients)
        self.assertEqual(result['state'],'failed')
        self.assertNotIn('DO NOT LOG',json.dumps(result))
        self.assertNotIn('password',str(clients['sns'].publish.call_args))
        cloud.run(self.cloud,self.cfg,clients)
        self.assertEqual(clients['sns'].publish.call_count,1)
    def test_boto_api_accepts_checksum_conditional_write_and_owner_scope(self):
        client=boto3.client('s3',region_name='ap-southeast-2',aws_access_key_id='synthetic',aws_secret_access_key='synthetic')
        with Stubber(client) as stub:
            stub.add_response('put_object',{}, {'Bucket':self.cloud.bucket,'Key':'production/test','Body':b'test','ContentLength':4,'ExpectedBucketOwner':self.cloud.account_id,'ChecksumSHA256':cloud.checksum_b64('a'*64),'ServerSideEncryption':'AES256','IfNoneMatch':'*'})
            stub.add_response('head_object',{'ContentLength':4,'ChecksumSHA256':cloud.checksum_b64('a'*64)}, {'Bucket':self.cloud.bucket,'Key':'production/test','ExpectedBucketOwner':self.cloud.account_id,'ChecksumMode':'ENABLED'})
            cloud.put_once(client,self.cloud,'production/test',b'test','a'*64,4)
            stub.assert_no_pending_responses()
    def test_sns_failure_preserves_diagnostics_and_does_not_claim_delivery(self):
        clients={'s3':self.s3,'cloudwatch':Mock(),'sns':Mock()}
        clients['sns'].publish.side_effect=RuntimeError('secret transport detail')
        result=cloud.run(self.cloud,self.cfg,clients)
        self.assertIn('backup_alert_publish_failed',result['errors'])
        self.assertNotIn('secret',json.dumps(result))
        self.assertFalse((self.cfg.state/'last-cloud-alert.json').exists())
        self.assertTrue((self.cfg.state/'last-cloud-run.json').exists())
    def test_future_receipts_invalid_targets_and_path_escape_fail(self):
        self.assertFalse(cloud.fresh(backup.stamp(self.now+timedelta(hours=1)),self.now,timedelta(days=1)))
        self.cloud.prefix='../'
        with self.assertRaises(backup.BackupError):self.cloud.validate()
        with self.assertRaises(backup.BackupError):cloud.artifact(self.cfg,self.root/self.path.name)
    def test_shell_aws_keys_cannot_replace_required_instance_role(self):
        with patch.dict(os.environ,{'AWS_ACCESS_KEY_ID':'synthetic-shell-key','AWS_SECRET_ACCESS_KEY':'synthetic-shell-secret'}), patch('botocore.credentials.InstanceMetadataProvider.load',return_value=None):
            with self.assertRaisesRegex(backup.BackupError,'ec2_instance_role_required'):cloud.session_for_instance(self.cloud)
    def test_wrong_account_or_instance_cannot_receive_backup_data(self):
        for account,instance in [('000000000000',self.cloud.instance_id),(self.cloud.account_id,'i-00000000000000000')]:
            session=Mock();session.client.return_value.get_caller_identity.return_value={'Account':account,'Arn':f'arn:aws:sts::{account}:assumed-role/synthetic/{instance}'}
            with patch('boto3.Session',return_value=session):
                with self.assertRaisesRegex(backup.BackupError,'unexpected_aws_identity'):cloud.session_for_instance(self.cloud)
            self.assertEqual(session.client.call_count,1) # STS only, never S3.
    def test_template_preserves_bucket_and_alarms_on_missing_heartbeat(self):
        template=json.loads((OPS/'backup-cloudformation.json').read_text())
        resources=template['Resources'];bucket=resources['BackupBucket']
        self.assertEqual(bucket['DeletionPolicy'],'Retain')
        self.assertTrue(all(bucket['Properties']['PublicAccessBlockConfiguration'].values()))
        for name in ('BackupHealthy','OffsiteHealthy','RecoveryHealthy'):
            self.assertEqual(resources[name+'Alarm']['Properties']['TreatMissingData'],'breaching')
    def test_recovery_cleanup_rejects_non_temp_or_symlink_targets(self):
        with self.assertRaisesRegex(backup.BackupError,'unsafe_recovery_cleanup'):recovery.safe_cleanup(Path('C:/Users/Administrator/AIMS'))
