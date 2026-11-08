#!/usr/bin/env bash
# Keep existing local backups intact. Never create AWS credentials or import keys.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if systemctl is-active --quiet aims-backup.service || systemctl is-active --quiet aims-backup-cloud.service; then
  echo 'Wait for running backup jobs to finish.' >&2; exit 1
fi
install -o root -g root -m 0644 "$source_dir/backup.py" /opt/aims-backup/backup.py
install -o root -g root -m 0644 "$source_dir/cloud.py" /opt/aims-backup/cloud.py
install -o root -g root -m 0755 "$source_dir/activate-cloud-linux.sh" /opt/aims-backup/activate-cloud-linux.sh
/opt/aims-backup/venv/bin/python -m pip install --disable-pip-version-check -r "$source_dir/requirements-cloud.txt"
install -o root -g root -m 0644 "$source_dir/aims-backup-cloud.service" /etc/systemd/system/aims-backup-cloud.service
install -o root -g root -m 0644 "$source_dir/aims-backup-cloud.timer" /etc/systemd/system/aims-backup-cloud.timer
systemd-analyze verify /etc/systemd/system/aims-backup-cloud.service /etc/systemd/system/aims-backup-cloud.timer
systemctl daemon-reload
echo 'Cloud operator installed. Run activate-cloud-linux.sh with the real cloud config after AWS stack creation and role attachment.'
