param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$demoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $demoRoot
$demoCommit = (git rev-parse HEAD).Trim()
if (git status --porcelain) { throw 'Commit the reviewed source before release verification.' }
$demoOutput = Join-Path $demoRoot ('qa/release-runs/' + $demoCommit + '/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $demoOutput -Force | Out-Null
$demoResults = [ordered]@{commit=$demoCommit; started=(Get-Date).ToString('o'); checks=@(); scope='Laptop hybrid demo; no SMTP/AI workers'}
function Invoke-DemoCheck([string]$Name, [string]$Directory, [scriptblock]$Action) {
    Push-Location $Directory
    try {
        & $Action *> (Join-Path $demoOutput ($Name + '.log'))
        $demoCode = $LASTEXITCODE
    } finally { Pop-Location }
    $demoResults.checks += @{name=$Name; exit_code=$demoCode}
    $demoResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $demoOutput 'verification.json') -Encoding utf8
    Write-Output "$Name exit=$demoCode"
    if ($demoCode -ne 0) { throw "Check failed: $Name. See $demoOutput" }
}
$env:PYTHONPATH = Join-Path $demoRoot 'capitalflow-api'
$env:DEMO_VERSION = $demoCommit.Substring(0,12)
$demoPython = Join-Path $demoRoot 'capitalflow-api/.venv/Scripts/python.exe'
Invoke-DemoCheck 'backend-suite' $demoRoot { & $demoPython -m pytest qa/acceptance_20261008/tests -q --junitxml (Join-Path $demoOutput 'pytest.xml') }
Invoke-DemoCheck 'refresh-suite' $demoRoot { node --test qa/acceptance_20261008/refresh-client.test.cjs }
Invoke-DemoCheck 'user-lint' "$demoRoot/frontend/user-web" { npm run lint }
Invoke-DemoCheck 'user-typecheck' "$demoRoot/frontend/user-web" { npm run typecheck }
Invoke-DemoCheck 'admin-lint' "$demoRoot/frontend/admin-web" { npm run lint }
Invoke-DemoCheck 'user-runtime-audit' "$demoRoot/frontend/user-web" { npm audit --omit=dev --json }
Invoke-DemoCheck 'admin-audit' "$demoRoot/frontend/admin-web" { npm audit --json }
if (-not $SkipBuild) { Invoke-DemoCheck 'docker-build' $demoRoot { docker compose -f compose.demo.yml build } }
Invoke-DemoCheck 'docker-start' $demoRoot { docker compose -f compose.demo.yml up -d --no-build }
Invoke-DemoCheck 'http-smoke' $demoRoot { & $demoPython scripts/demo/smoke.py }
Invoke-DemoCheck 'image-identity' $demoRoot { docker image inspect "capitalflow-demo-user:$env:DEMO_VERSION" "capitalflow-demo-admin:$env:DEMO_VERSION" --format '{{.Id}} {{json .RepoTags}}' }
if (git status --porcelain) { throw 'Working tree changed during verification; not a clean release result.' }
$demoResults.completed = (Get-Date).ToString('o')
$demoResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $demoOutput 'verification.json') -Encoding utf8
Write-Output "Verified code commit: $demoCommit; evidence: $demoOutput"
