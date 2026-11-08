# Scheduled AIMS database and uploaded-file backups

This is an **operations feature for the EC2 Linux server**, not a button for students or stakeholders. It does not change application startup, database schema or the mobile app. The installer never enables the schedule automatically. Finish the recovery-key and manual-backup steps first.

## What gets backed up

Each successful run creates one `aims-backup-<UTC timestamp>-<random>.tar.gpg` file containing:

- A PostgreSQL custom-format dump of the configured application database.
- All regular files and directories under the backend's configured `assets` directory, including onboarding documents, requirement versions, DTR/journal attachments, avatars, approved templates and MOA files.
- An encrypted manifest with file sizes and SHA-256 hashes. Public sidecars contain only completion time, ciphertext size and checksum.

Application `.env` files, SSH keys and recovery private keys are **not** included. Keep infrastructure credentials/configuration in your separate secret-recovery process. PostgreSQL cluster-wide roles are not included; the restore example restores into a database owned by the chosen recovery role.

Schedule: daily **02:00 Asia/Manila**, with catch-up after a missed run. Retention: **14 days**, preserving at least the newest **two complete, checksum-matching backups** even when older. Retention applies only after a successful new encrypted backup and never recursively removes unrelated files. Invalid, incomplete and unrecognized files are not treated as disposable successful backups.

## Consistency and availability

The job validates its explicit database name, connection host and upload directory before pausing anything. It briefly stops the configured AIMS writer services while dumping the database and archiving uploads, then restarts only services that were previously active. The API is unavailable during this maintenance window. GnuPG encryption and archive verification happen after writers resume.

List **every process that can write this database/assets** in `writer_services` (the normal deployment runs notifications inside `aims-backend.service`). Do not schedule other imports, manual SQL writes, file cleanup, workers or deployments during the snapshot. An independently running writer not listed in the configuration cannot be paused by this job.

A persistent paused-writer record and `ExecStopPost` recovery hook handle interrupted jobs. A process lock prevents overlapping runs. Disk-space checks fail rather than deleting prior backups to make room. The `.state/last-run.json` file records sanitized failures, while `last-success.json` retains the last good result. No passwords, connection strings, OCR text or student names are logged.

## 1. Create the recovery key OFF the server

Run the recovery-key commands from a private folder **outside every Git checkout** on a trusted recovery computer using GnuPG. Do not generate or import a recovery private key on EC2. Use a dedicated key, a strong passphrase and a secure offline copy. The operator must retain the passphrase and private-key backup; an exported public key alone cannot recover data.

```text
gpg --full-generate-key
```

Choose RSA and RSA (3072 bits or stronger), or a supported encryption-capable key. Use a clear label such as `AIMS Backup Recovery`. Choose an expiry you can manage; rotate the server public key before it expires. Retain old private keys for as long as any local or off-server backup still requires them.

List the full fingerprint, then export **only the public key** for installation:

```text
gpg --list-keys --fingerprint
gpg --armor --output recovery-public.asc --export YOUR_FULL_FINGERPRINT
```

Privately export and secure the recovery secret key on the recovery computer/removable encrypted storage:

```text
gpg --armor --output recovery-private.asc --export-secret-keys YOUR_FULL_FINGERPRINT
```

GnuPG prompts locally for the passphrase. Do not paste the passphrase or private key into chat, commit them, upload them to EC2, or store them beside server backups. Check that your offline copy can be imported and decrypt a test before relying on the schedule. The server refuses a keyring containing secret keys.

## 2. Configure EC2 without copying secrets into the configuration

Requirements: Python 3 with venv, GnuPG and PostgreSQL client tools compatible with the database server. On Ubuntu, install the appropriate packages through the system package manager if missing. This operator uses a root-owned isolated Python environment, not the application-owned virtual environment.

Copy `backend/ops/backup.example.json` to a private `backup.json` outside Git and edit it on the server:

- `database_env_file`: the real backend environment file containing `DATABASE_URL`.
- `expected_database` and `expected_host`: independently confirm the intended application database and exact hostname in that URL. Defaults are `aims_db` / `localhost`; a mismatch is refused.
- `assets_dir`: the actual configured assets path. The `.env` `ASSET_DIR`, if set, must agree; otherwise the default is `<backend>/assets`.
- `recipient_fingerprint`: the full public-key fingerprint, not a short key ID.
- `writer_services`: all AIMS writer units to pause.
- `pg_bin_dir`: leave empty to use the system client tools, or use a trusted root-owned installation directory.

The provided systemd profile uses `/var/backups/aims` and `/var/lib/aims-backup/gnupg`. Do not place these under a public web directory, the repository or the upload tree. The installer imports only the supplied ASCII public-key block and pins encryption to the full configured fingerprint.

From the reviewed checkout on EC2:

```sh
sudo bash backend/ops/install-linux.sh /path/to/private/backup.json /path/to/recovery-public.asc
```

This installs the standalone operator into root-owned `/opt/aims-backup`, checks the read-only database target/public key/disk space, installs the service/timer and reloads unit definitions. **It does not run a live backup or start/enable the timer.** For updates, stop the timer and wait for the running backup to finish first; do not kill it midway.

## 3. Take and verify the first backup before scheduling

Run during an agreed maintenance window; this pauses the configured backend writer services:

```sh
sudo systemctl start aims-backup.service
sudo systemctl status aims-backup.service --no-pager
sudo cat /var/backups/aims/.state/last-success.json
sudo journalctl -u aims-backup.service -n 30 --no-pager
```

Copy the completed `.tar.gpg` file and matching `.json` checksum sidecar to your trusted recovery computer. There, compare `Get-FileHash -Algorithm SHA256` (PowerShell) or `sha256sum` with the sidecar. Decrypt with the recovery key:

```text
gpg --output recovery-bundle.tar --decrypt aims-backup-TIMESTAMP-ID.tar.gpg
python backend/ops/backup.py verify-bundle recovery-bundle.tar
```

`verify-bundle` checks the manifest, dump checksum, uploaded-file archive checksum, every upload checksum and unsafe archive paths without extracting anything or connecting to a database. Install `python-dotenv` from `backend/ops/requirements-backup.txt` in your recovery environment if needed. Do not use any decrypted output after a failed GnuPG command. Remove protected plaintext recovery copies once the drill is complete.

For a genuine recovery drill, use a new empty, isolated database and a new private directory. Never use `aims_db` or the live assets directory for a drill:

```sh
mkdir -m 700 /path/to/private/recovery-check
tar -xf recovery-bundle.tar -C /path/to/private/recovery-check
createdb -h localhost -U postgres aims_restore_review
pg_restore -h localhost -U postgres --exit-on-error --no-owner --no-privileges --dbname=aims_restore_review /path/to/private/recovery-check/database.dump
tar -xzf /path/to/private/recovery-check/uploads.tar.gz -C /path/to/private/recovery-check
```

Confirm row counts, representative document references and restored upload hashes. A production restore/cutover is a separate operation; this feature never overwrites or restores a live database automatically.

## 4. Enable the daily schedule after the manual/recovery checks

```sh
sudo systemctl enable --now aims-backup.timer
sudo systemctl list-timers aims-backup.timer --all --no-pager
```

To change the hour, use `systemctl edit aims-backup.timer`, reset `OnCalendar=` and set the desired schedule with an explicit timezone. Run `systemd-analyze calendar '...your calendar expression...'` before applying it. Catch-up runs can occur outside the normal 02:00 window after server downtime.

To disable future runs:

```sh
sudo systemctl disable --now aims-backup.timer
```

This does not terminate a backup already in progress. Let it finish. If a writer remains stopped after an interruption:

```sh
sudo /opt/aims-backup/venv/bin/python /opt/aims-backup/backup.py resume --config /etc/aims/backup.json
```

This recovery command needs no database connection and starts only the previously active configured writer units recorded by the job. It does not restart units that were already inactive.

## Off-server storage and scope

A backup on the same EC2 disk does not survive loss of that disk/instance. The optional [off-server storage, alerts and recovery extension](CLOUD_BACKUPS.md) provides a reviewed AWS stack, encrypted S3 replication with retries, health alarms that also detect missing server heartbeats, and independent monthly restore drills on a trusted PC. Complete that extension's AWS role/bucket/email activation before relying on off-server protection. Do not put AWS access keys or recovery private keys into this repository.

For a local/manual rehearsal only, set `writer_services` to `[]`, explicitly stop all writers yourself, and pass `run --offline --config ...`. The EC2 systemd service never uses this override. The automated test uses a disposable PostgreSQL cluster and temporary synthetic files/keys; it does not read the project's real `.env` or assets.

## References

- [PostgreSQL logical dumps and consistency](https://www.postgresql.org/docs/current/backup-dump.html)
- [GnuPG public-key encryption and recovery commands](https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html)
- [systemd calendar timers and catch-up behavior](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)
