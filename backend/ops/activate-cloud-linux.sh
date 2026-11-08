#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 && $# -eq 1 ]] || { echo 'Usage: sudo bash activate-cloud-linux.sh /private/backup-cloud.json' >&2; exit 1; }
python=/opt/aims-backup/venv/bin/python
# Check the target and instance role before enabling anything.
"$python" /opt/aims-backup/cloud.py check --config "$1"
install -o root -g root -m 0600 "$1" /etc/aims/backup-cloud.json
"$python" - <<'PY'
import json,sys
from pathlib import Path
sys.path.insert(0,'/opt/aims-backup')
import backup,cloud
c=cloud.CloudConfig.read('/etc/aims/backup-cloud.json')
b=backup.Config.read(c.backup_config)
with backup.exclusive_lock(b.root):
    value=json.loads(Path(c.backup_config).read_text())
    value['offsite_required']=True
    backup.atomic_json(Path(c.backup_config),value)
PY
install -d -o root -g root -m 0755 /etc/systemd/system/aims-backup.service.d
printf '[Unit]\nOnSuccess=aims-backup-cloud.service\nOnFailure=aims-backup-cloud.service\n' > /etc/systemd/system/aims-backup.service.d/cloud.conf
systemctl daemon-reload
systemctl enable --now aims-backup-cloud.timer
# A missing recovery receipt intentionally raises attention until the first drill.
systemctl start aims-backup-cloud.service || true
"$python" - <<'PY'
import json
from pathlib import Path
value=json.loads(Path('/var/backups/aims/.state/last-cloud-run.json').read_text())
if value['health']['BackupHealthy'] != 1 or value['health']['OffsiteHealthy'] != 1:
    raise SystemExit('Cloud setup needs attention: review last-cloud-run.json before relying on offsite backups.')
print('S3 replication is verified. Complete the first local recovery check if RecoveryHealthy is zero.')
PY
