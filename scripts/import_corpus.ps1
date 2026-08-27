<#
.SYNOPSIS
  Snapshot production (or sandbox) customizations into corpus/prod-YYYY-MM-DD/.

.DESCRIPTION
  Creates a throwaway SDF project, imports the object types the sweep greps
  (custom fields, workflows, entry forms, PDF templates, saved searches) plus the
  full /SuiteScripts File Cabinet folder, then copies the results into an
  immutable dated corpus folder in this repo. Re-run the python pipeline
  afterwards; the git diff is the drift report.

.PARAMETER AuthId
  SuiteCloud CLI auth id (see: suitecloud account:manageauth --list). Default: premier.

.PARAMETER Label
  Snapshot folder prefix. Default: prod (use 'sb1' for sandbox snapshots).

.NOTES
  Requires SuiteCloud CLI >= 4.0 (uses npx) and Java 17+. Runs from PowerShell to
  avoid Git Bash path mangling of --destinationfolder.
#>
param(
    [string]$AuthId = 'premier',
    [string]$Label = 'prod'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyy-MM-dd'
$dest = Join-Path $repo "corpus\$Label-$stamp"
if (Test-Path $dest) { throw "Snapshot folder already exists: $dest (snapshots are immutable - pick another day or label)" }

$work = Join-Path ([System.IO.Path]::GetTempPath()) "xo-snapshot-$stamp"
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $work | Out-Null
Set-Location $work
npx --yes @oracle/suitecloud-cli@latest project:create --projectname snap --type ACCOUNTCUSTOMIZATION | Out-Null
Set-Location (Join-Path $work 'snap')
Set-Content project.json "{`"defaultAuthId`": `"$AuthId`"}" -Encoding utf8

$types = @('itemcustomfield','transactioncolumncustomfield','workflow','entryform','advancedpdftemplate','savedsearch')
foreach ($t in $types) {
    Write-Host "== importing $t"
    New-Item -ItemType Directory -Force ".\src\Objects\$t" | Out-Null
    npx --yes @oracle/suitecloud-cli@latest object:import --type $t --scriptid ALL --excludefiles --destinationfolder "/Objects/$t" | Select-Object -Last 1
}

Write-Host "== listing /SuiteScripts"
$raw = npx --yes @oracle/suitecloud-cli@latest file:list --folder "/SuiteScripts"
$paths = $raw | ForEach-Object { $m = [regex]::Match($_, '/SuiteScripts.*$'); if ($m.Success) { $m.Value.TrimEnd() } } |
    Where-Object { $_ -and $_ -notmatch '\.(csv|xlsx|xls|png|jpg|jpeg|gif|zip|pdf)$' } | Select-Object -Unique
$paths | Set-Content .\suitescripts_filelist.txt -Encoding utf8
Write-Host "== importing $($paths.Count) files"
for ($i = 0; $i -lt $paths.Count; $i += 30) {
    $batch = $paths[$i..([Math]::Min($i + 29, $paths.Count - 1))]
    $quoted = ($batch | ForEach-Object { '"' + $_ + '"' }) -join ' '
    cmd /c "npx --yes @oracle/suitecloud-cli@latest file:import --excludeproperties --paths $quoted" | Out-Null
}

New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item -Recurse .\src\Objects "$dest\objects"
Copy-Item -Recurse .\src\FileCabinet "$dest\filecabinet"
Copy-Item .\suitescripts_filelist.txt "$dest\suitescripts_filelist.txt"
$n = (Get-ChildItem -Recurse -File $dest | Measure-Object).Count
Write-Host "== snapshot written: $dest ($n files). Now run the python pipeline and commit."
