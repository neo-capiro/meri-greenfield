# Public-only regression. Never installs dependencies or accepts private inputs.
param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$SourceRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Pr193Common.ps1')
. (Join-Path $PSScriptRoot 'Pr193PublicInputs.ps1')
$originalCapture=${function:Invoke-Pr193Captured}
$originalSourceAssert=${function:Assert-Pr193Source}
function Invoke-Pr193Captured {
    param([string]$FilePath,[string[]]$ArgumentList,[string]$WorkingDirectory,[int]$TimeoutSeconds=120,[hashtable]$Environment=@{},[AllowNull()][string]$StandardInput=$null)
    if (@($ArgumentList | Where-Object { $_ -match 'npm-cli\.js$' }).Count) { throw 'TEST_NETWORK_INSTALL_FORBIDDEN' }
    & $originalCapture -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -TimeoutSeconds $TimeoutSeconds -Environment $Environment -StandardInput $StandardInput
}
$git=@(Get-Command git.exe -CommandType Application -ErrorAction Stop)[0].Source
$source=[IO.Path]::GetFullPath($SourceRoot)
$env:GIT_CONFIG_COUNT='1'; $env:GIT_CONFIG_KEY_0='safe.directory'; $env:GIT_CONFIG_VALUE_0=$source
$version=Invoke-Pr193Captured $NodePath @('--version') $source
if($version.ExitCode -ne 0 -or $version.Stdout.Trim() -notmatch '^v24\.') { throw 'TEST_NODE24_REQUIRED' }
$fixedInitializer=${function:Initialize-Pr193CanonicalDependencies}
$previousInitializer=$fixedInitializer.ToString().Replace('process.argv[2]','process.argv[1]').Replace('process.argv[3]','process.argv[2]').Replace(",'pr193-dependency-probe'",'')
try {
    Set-Item -LiteralPath Function:Initialize-Pr193CanonicalDependencies -Value ([scriptblock]::Create($previousInitializer))
    $oldRefused=$false
    try { Initialize-Pr193CanonicalDependencies -Node $NodePath -Source $source -Git $git }
    catch { if($_.Exception.Message -ne 'PR193_CANONICAL_DEPENDENCIES_REFUSED'){throw}; $oldRefused=$true }
    if(-not $oldRefused){throw 'TEST_OLD_INITIALIZER_DID_NOT_REFUSE'}
    Write-Output 'PR193_CANONICAL_PREVIOUS_INITIALIZER_REFUSAL_PASS exact prior argv behavior'
} finally { Set-Item -LiteralPath Function:Initialize-Pr193CanonicalDependencies -Value $fixedInitializer }
Initialize-Pr193CanonicalDependencies -Node $NodePath -Source $source -Git $git
Write-Output 'PR193_CANONICAL_EXPORTED_INITIALIZER_PASS exact source/raw-byte checks retained; no installs'

$fixture=Join-Path ([IO.Path]::GetTempPath()) ('pr193-dependency-guard-'+[Guid]::NewGuid().ToString('N'))
try {
    $moduleDirectory=Join-Path $fixture 'infra/product-preview/first-chat'
    [IO.Directory]::CreateDirectory($moduleDirectory) | Out-Null
    $guard='import {pathToFileURL} from "node:url";import {resolve} from "node:path";if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){process.stdout.write("TEST_CLI_GUARD_EXECUTED");process.exitCode=73;}'
    foreach($name in @('render-material.mjs','stage3-deploy.mjs')) { [IO.File]::WriteAllText((Join-Path $moduleDirectory $name),$guard,(New-Object Text.UTF8Encoding($false))) }
    $script:sourceAssertCalls=0
    function Assert-Pr193Source { param([string]$Git,[string]$Directory); if($Directory -ne $fixture){throw 'TEST_SOURCE_UNEXPECTED'}; $script:sourceAssertCalls++ }
    Initialize-Pr193CanonicalDependencies -Node $NodePath -Source $fixture -Git $git
    if($script:sourceAssertCalls -ne 1){throw 'TEST_SOURCE_GATE_MISSING'}
    Write-Output 'PR193_CANONICAL_CLI_GUARD_PASS imports never invoke CLI; source gate called'
} finally {
    Set-Item -LiteralPath Function:Assert-Pr193Source -Value $originalSourceAssert
    Set-Item -LiteralPath Function:Invoke-Pr193Captured -Value $originalCapture
    $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if([IO.Path]::GetFullPath($fixture).StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fixture)){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
