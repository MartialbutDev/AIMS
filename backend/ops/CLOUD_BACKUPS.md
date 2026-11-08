# Off-server backups, failure alerts and recurring recovery checks

These operations extend the existing daily encrypted backup. No student/stakeholder interface, mobile build or database migration is needed. Public-key encryption remains in place; **never import the private recovery key onto EC2 or upload it to S3**.

## What runs where

| Operation | Location | Schedule and result |
|---|---|---|
| Consistent DB + uploads snapshot | EC2 | Existing 02:00 Asia/Manila backup, 14 days locally |
| Encrypted S3 replication | EC2 | After successful/failed backup units and hourly at :20; failed copies retry |
| Independent ciphertext verification | EC2 | Hourly: read the latest S3 object and compare its actual SHA-256 |
| Backup, S3 and recovery heartbeat | CloudWatch | Hourly metrics; two bad/missing hourly periods trigger SNS alarms, including EC2 downtime |
| Immediate detected-failure alert | EC2 to SNS | Fixed error categories only, deduplicated for 24 hours |
| Full isolated restore drill | Trusted Windows PC | Every 30 days, daily noon/logon retries when due; 35-day overdue alarm |

S3 retains current encrypted backups for **90 days**, noncurrent versions for **30 days**. Lifecycle expiration is asynchronous. The bucket is private, ACLs disabled, TLS required, versioning enabled, and retained if the infrastructure stack is removed. The instance role can read/write its backup prefix and publish health/alerts; it cannot delete backup objects or change AWS permissions. Conditional creation refuses overwriting an existing backup key. Failed copies remain local and are excluded from local pruning when `offsite_required` is true. S3 objects are already GPG-encrypted, with SSE-S3 as an additional layer.

Current scope is a single-PUT ciphertext object up to **4 GiB**; larger backups fail visibly and remain local. Add a verified multipart implementation before this size is reached. Existing local disk-space checks still protect the instance; prolonged replication failure can fill local storage and is intentionally alerted, rather than silently deleting the only copy.

## One-time AWS setup

Use the AWS account that owns the AIMS instance, in **ap-southeast-2 (Sydney)**. Creating this stack incurs standard S3 storage/request, CloudWatch custom metric/alarm, and SNS charges; it creates no new EC2 instance.

1. Open [CloudFormation in Sydney](https://ap-southeast-2.console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/create/template). Choose **Create stack → With new resources → Upload a template file**. Upload `backend/ops/backup-cloudformation.json`.
2. Stack name: `aims-backup-protection`. Set **AlertEmail** to the approved operations email and **InstanceId** to the existing AIMS EC2 ID. Review resources, acknowledge creation of IAM resources, and create the stack. Do not supply any passwords/access keys. Wait for `CREATE_COMPLETE`.
3. Open the AWS subscription confirmation message at that email and confirm the SNS subscription. Creation alone does not prove email delivery.
4. From stack **Outputs**, retain `BucketName`, `AlertTopicArn`, `InstanceProfileName`, `AccountId`, and `Region` (these are not secrets).
5. In EC2 select the existing instance → **Actions → Security → Modify IAM role**. Attach the stack's **InstanceProfileName**. If the instance already has a role, do not replace it blindly: merge the scoped backup permissions into that existing role and validate the identity instead. No reboot is required.

The stack does not modify the existing EC2 instance automatically. A person with AWS administrator access must create the AWS resources/attach the role, or use an already authorized AWS deployment session. Static AWS access keys are neither required nor supported by the EC2 operator.

## Install and activate on EC2

Copy the reviewed `ops` files to a temporary directory on EC2, then run:

```sh
sudo bash /path/to/ops/install-cloud-linux.sh
```

This installs the cloud operator/dependencies and **inactive** service/timer definitions. It does not change the running application or enable cloud monitoring without a valid configuration.

Copy `backup-cloud.example.json` to a private file and fill its five AWS outputs/instance values. Leave `backup_config` pointing at the existing validated `/etc/aims/backup.json`, prefix `production/`, freshness 30 hours, recovery 35 days.

```sh
sudo bash /opt/aims-backup/activate-cloud-linux.sh /private/backup-cloud.json
sudo /opt/aims-backup/venv/bin/python /opt/aims-backup/cloud.py test-alert
sudo cat /var/backups/aims/.state/last-cloud-run.json
sudo systemctl list-timers aims-backup.timer aims-backup-cloud.timer --all --no-pager
```

Activation validates the account/instance identity and bucket owner, requires instance-role credentials, enables hourly checks, connects success/failure backup hooks and protects unreplicated local backups. The operator uses AWS's normal HTTPS certificates with no custom endpoint overrides. A first `RecoveryHealthy=0` is expected until the recovery computer successfully submits a real restore result. Confirm the alert email actually arrives; SNS accepting the message does not prove inbox delivery. CloudWatch independently alerts on absent heartbeat data, so an unreachable server cannot silently stop alerts.

To inspect status, use `last-cloud-run.json`, `last-cloud-alert.json`, `last-success.json`, `last-recovery.json` in `/var/backups/aims/.state`, protected service logs, and the stack's three CloudWatch alarms. Avoid printing raw database configuration files.

## Independent recovery computer

Install Python + python-dotenv + psycopg2-binary in a dedicated recovery environment, PostgreSQL client/server tools matching or newer than the dump, and GnuPG. The existing SSH identity and known-host entry must already work noninteractively. No application code/server should run against the restored production records.

Keep `backup.py` and `recovery.py` together outside the application checkout, for example in a private `Documents/AIMS-Recovery/tools` folder. A private local JSON config contains paths, not passwords:

```json
{
  "ssh_target": "ubuntu@YOUR_EC2_HOST",
  "ssh_identity": "C:/Users/YOU/.ssh/aims.pem",
  "pg_bin_dir": "C:/Program Files/PostgreSQL/18/bin",
  "gpg_binary": "C:/Program Files/Git/usr/bin/gpg.exe",
  "gpg_home": "C:/Users/YOU/.gnupg",
  "recipient_fingerprint": "YOUR_FULL_PUBLIC_KEY_FINGERPRINT",
  "state_dir": "C:/Users/YOU/Documents/AIMS-Recovery/check-state"
}
```

Run the first check interactively:

```powershell
& 'C:\path\recovery-venv\Scripts\python.exe' 'C:\path\tools\recovery.py' --config 'C:\path\recovery.json' --force
```

The drill fetches the latest **S3 copy** through SSH, verifies the downloaded ciphertext, decrypts using the **local** GPG agent, verifies every archive hash, creates a new temporary PostgreSQL cluster bound to loopback on a random port, validates the data directory/server identity before writing, restores into a new `aims_recovery_*` database, reads table/row counts, extracts and verifies uploaded-file hashes, stops that cluster, removes plaintext temporary files and sends only nonpersonal success evidence to EC2. The live `aims_db`, application assets, application API and notification workers are never used as restore targets.

If the local agent is locked, `local_key_unlock_required_failed` is recorded; no passphrase is stored and no false recovery success is submitted. Unlock locally using GnuPG and a known encrypted backup, then rerun. If cleanup cannot stop the disposable cluster, its private temporary directory is retained rather than deleting files under a live process; inspect `last-run.json` and the `aims-recovery-*` temporary folder. Remove it only after stopping that exact cluster.

After a successful first drill, register the Windows scheduled task using `install-recovery-task.ps1` with the Python/script/config absolute paths. It runs with the current logged-in user's token, without storing a Windows password; noon/logon checks skip work until 30 days after the last success. The PC must be on and signed in, and the local GPG key must be unlocked when a drill is due. Failure/offline time does not move the last-success date; EC2/CloudWatch alerts after 35 days. This is supervised recovery automation, not unattended storage of the private-key passphrase.

## Verification and limits

Run `python -m unittest discover -s backend/tests -p 'test*backup*.py' -v` with cloud test dependencies installed; use `cfn-lint backend/ops/backup-cloudformation.json` for the AWS schema. Tests cover idempotent retry, incorrect checksums, interrupted uploads, preserving unreplicated backups, stale/future evidence, alert redaction/deduplication and missing-heartbeat alarms. A separate synthetic integration drill should exercise PostgreSQL/GnuPG with no production data. Real S3 upload/email delivery remain unverified until the stack and confirmed subscription exist.

Restore evidence is an operational receipt from the trusted recovery computer, not a cryptographic signature or a comparison to current live counts. It proves that the chosen dump restores and its archived files match their recorded hashes. It does not prove every product feature works against restored data or that a future cutover is safe. Keep periodic human review of recovery access, key expiry, retention and the off-server private-key copy.

References: [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html), [CloudWatch missing-data handling](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html), [SNS subscription confirmation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Notify_Users_Alarm_Changes.html).
