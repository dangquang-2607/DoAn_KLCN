param(
    [string]$DeviceId,
    [ValidateRange(1, 65535)][int]$Port = 8000,
    [string]$AdbPath
)
$ErrorActionPreference = 'Stop'
if (-not $AdbPath) {
    $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
    if ($adbCommand) { $AdbPath = $adbCommand.Source }
    else { $AdbPath = Join-Path $env:LOCALAPPDATA 'Android\sdk\platform-tools\adb.exe' }
}
if (-not (Test-Path -LiteralPath $AdbPath)) {
    throw 'ADB not found. Pass -AdbPath with the path to platform-tools/adb.exe.'
}
$deviceOutput = & $AdbPath devices
if ($LASTEXITCODE -ne 0) { throw 'Cannot list Android devices.' }
$readyDevices = @($deviceOutput | ForEach-Object {
    if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
})
if (-not $DeviceId) {
    if ($readyDevices.Count -ne 1) {
        throw 'Connect and authorize one phone, or pass -DeviceId from adb devices.'
    }
    $DeviceId = $readyDevices[0]
}
if ($DeviceId -notin $readyDevices) { throw 'Selected phone is offline or not authorized.' }
$health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 8
if ($health.StatusCode -ne 200) { throw 'Backend health check failed.' }
& $AdbPath -s $DeviceId reverse "tcp:$Port" "tcp:$Port"
if ($LASTEXITCODE -ne 0) { throw 'Cannot establish USB reverse forwarding.' }
& $AdbPath -s $DeviceId reverse --list
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify USB reverse forwarding.' }
Write-Host "Backend OK. USB forwarding ready for $DeviceId."
Write-Host "In the app, select server http://127.0.0.1:$Port and tap Retry."
Write-Host 'Run this script again after USB/ADB reconnects or the phone restarts.'
