param(
    [Parameter(Mandatory=$true)][string]$PythonPath,
    [Parameter(Mandatory=$true)][string]$RecoveryScript,
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [switch]$Disabled
)
$ErrorActionPreference = 'Stop'
foreach ($file in @($PythonPath,$RecoveryScript,$ConfigPath)) {
    if (-not [IO.Path]::IsPathRooted($file) -or -not (Test-Path -LiteralPath $file -PathType Leaf) -or $file.Contains('"')) { throw 'Use existing absolute paths without quote characters.' }
}
# An interactive user token preserves the user's GPG keyring/agent and needs no
# saved Windows password. Daily retries run only when the 30-day drill is due.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $PythonPath -Argument ('"{0}" --config "{1}"' -f $RecoveryScript,$ConfigPath)
$triggers = @((New-ScheduledTaskTrigger -Daily -At '12:00'),(New-ScheduledTaskTrigger -AtLogOn -User $identity))
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$task = New-ScheduledTask -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Verify S3 backup by restoring in a disposable local PostgreSQL cluster every 30 days. Requires local unlocked GPG agent; never stores the passphrase.'
try {
    Register-ScheduledTask -TaskName 'AIMS Monthly Recovery Check' -InputObject $task -Force -ErrorAction Stop | Select-Object TaskName,State
    if ($Disabled) { Disable-ScheduledTask -TaskName 'AIMS Monthly Recovery Check' -ErrorAction Stop | Select-Object TaskName,State }
} catch {
    throw 'Windows did not allow task registration. Open PowerShell as administrator and rerun this installer; no Windows password is stored in the task.'
}
