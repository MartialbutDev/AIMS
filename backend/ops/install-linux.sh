#!/usr/bin/env bash
# Install only. This script never enables the timer or runs a live backup.
set -euo pipefail
if [[ ${EUID} -ne 0 || $# -ne 2 ]]; then
  echo 'Usage: sudo bash install-linux.sh /path/to/backup.json /path/to/recovery-public.asc' >&2
  exit 1
fi
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
config_file=$1
public_key=$2
for tool in python3 gpg pg_dump pg_restore psql systemctl; do
  command -v "$tool" >/dev/null || { echo "Required program missing: $tool" >&2; exit 1; }
done
if systemctl is-active --quiet aims-backup.timer || systemctl is-active --quiet aims-backup.service; then
  echo 'Stop the backup timer and wait for any running backup before updating this installation.' >&2
  exit 1
fi
# Only one ASCII-armored public block is accepted. No private key is installed.
python3 - "$config_file" "$public_key" <<'PY'
import json, pathlib, sys
config=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
text=pathlib.Path(sys.argv[2]).read_text(encoding='ascii').strip()
if not text.startswith('-----BEGIN PGP PUBLIC KEY BLOCK-----') or not text.endswith('-----END PGP PUBLIC KEY BLOCK-----') or 'PRIVATE KEY' in text or text.count('-----BEGIN') != 1:
    raise SystemExit('Use an exported ASCII public key only; keep the recovery private key offline.')
if config.get('backup_dir') != '/var/backups/aims' or config.get('gpg_home') != '/var/lib/aims-backup/gnupg':
    raise SystemExit('This service profile requires the documented backup and keyring directories.')
PY
install -d -o root -g root -m 0700 /etc/aims /var/backups/aims /var/lib/aims-backup /var/lib/aims-backup/gnupg
install -d -o root -g root -m 0755 /opt/aims-backup
install -o root -g root -m 0600 "$config_file" /etc/aims/backup.json
install -o root -g root -m 0644 "$source_dir/backup.py" /opt/aims-backup/backup.py
install -o root -g root -m 0644 "$source_dir/requirements-backup.txt" /opt/aims-backup/requirements.txt
python3 -m venv /opt/aims-backup/venv
/opt/aims-backup/venv/bin/python -m pip install --disable-pip-version-check -r /opt/aims-backup/requirements.txt
# Import into a dedicated server keyring. It is never the operator's personal keyring.
gpg --homedir /var/lib/aims-backup/gnupg --no-options --batch --quiet --import "$public_key"
/opt/aims-backup/venv/bin/python /opt/aims-backup/backup.py check --config /etc/aims/backup.json
install -o root -g root -m 0644 "$source_dir/aims-backup.service" /etc/systemd/system/aims-backup.service
install -o root -g root -m 0644 "$source_dir/aims-backup.timer" /etc/systemd/system/aims-backup.timer
systemd-analyze verify /etc/systemd/system/aims-backup.service /etc/systemd/system/aims-backup.timer
systemctl daemon-reload
echo 'Installed and preflight checked. No timer was enabled or started. Complete a manual backup and recovery check before enabling it.'
