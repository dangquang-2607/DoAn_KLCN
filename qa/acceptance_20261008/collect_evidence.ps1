param([string]$ManifestName='evidence-manifest.json', [string]$ResultsName='results-current.xml')
$ErrorActionPreference = 'Stop'
if ([IO.Path]::GetFileName($ManifestName) -ne $ManifestName -or [IO.Path]::GetFileName($ResultsName) -ne $ResultsName) { throw 'Use filenames within this QA folder.' }
$qaWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$qaFolders = @('capitalflow-api/app', 'frontend/admin-web/src', 'frontend/user-web/src', 'qa/acceptance_20261008/user-web-fixture/src')
$qaSources = foreach ($qaFolder in $qaFolders) {
    $qaAbsolute = Join-Path $qaWorkspace $qaFolder
    Get-ChildItem -LiteralPath $qaAbsolute -Recurse -File | Where-Object { $_.Extension -in '.py','.js','.jsx','.ts','.tsx','.css' } | ForEach-Object {
        [ordered]@{path=$_.FullName.Substring($qaWorkspace.Length+1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    }
}
$qaDifferences = foreach ($qaItem in ($qaSources | Where-Object { $_.path.StartsWith('frontend/user-web/src/') })) {
    $qaCopyPath = $qaItem.path.Replace('frontend/user-web/src/', 'qa/acceptance_20261008/user-web-fixture/src/')
    $qaCopy = $qaSources | Where-Object path -eq $qaCopyPath
    if (-not $qaCopy -or $qaCopy.sha256 -ne $qaItem.sha256) { $qaItem.path }
}
[xml]$qaResults = Get-Content -LiteralPath (Join-Path $PSScriptRoot $ResultsName) -Raw
$qaSummary = [ordered]@{
    captured_at=[DateTimeOffset]::Now.ToString('o')
    git_head=(& git -C $qaWorkspace rev-parse HEAD)
    working_tree_note='Dirty working tree; source hashes identify the closing snapshot, not a clean release commit.'
    tests=$qaResults.testsuites.testsuite.tests
    failures=$qaResults.testsuites.testsuite.failures
    errors=$qaResults.testsuites.testsuite.errors
    screenshots=@(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'screenshots') -File | Select-Object -ExpandProperty Name)
    user_source_differences_from_qa_copy=@($qaDifferences)
    sources=@($qaSources)
}
$qaSummary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot $ManifestName) -Encoding UTF8
[ordered]@{tests=$qaSummary.tests;failures=$qaSummary.failures;screenshots=$qaSummary.screenshots.Count;source_files=$qaSummary.sources.Count;user_copy_differences=$qaSummary.user_source_differences_from_qa_copy.Count} | ConvertTo-Json
