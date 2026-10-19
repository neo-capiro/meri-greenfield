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

    # The following fake adapter checks only initializer bounds and argv. It cannot run npm.
    $fakeNode=Join-Path $fixture 'tools/node.exe'
    $fakeNpm=Join-Path $fixture 'tools/node_modules/npm/bin/npm-cli.js'
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fakeNpm)) | Out-Null
    [IO.File]::WriteAllText($fakeNpm,'// public fixture')
    $ownerPaths=@{ROOT='.';RUNTIME='apps/runtime';CONVERSATION='apps/worker/conversation';CONTROL_CONVERSATIONS='apps/control/conversations';QUALIFICATION='apps/worker/qualification';ARTIFACT_STORAGE='apps/artifacts/storage'}
    foreach($relative in $ownerPaths.Values){$directory=Join-Path $fixture $relative;[IO.Directory]::CreateDirectory($directory)|Out-Null;[IO.File]::WriteAllText((Join-Path $directory 'package-lock.json'),'{}')}
    function Invoke-Pr193Captured {
        param([string]$FilePath,[string[]]$ArgumentList,[string]$WorkingDirectory,[int]$TimeoutSeconds=120,[hashtable]$Environment=@{},[AllowNull()][string]$StandardInput=$null)
        if($FilePath -ne $fakeNode -or $WorkingDirectory -ne $fixture){throw 'TEST_CHILD_UNEXPECTED'}
        if($ArgumentList[0] -eq $fakeNpm){
            $expected=@($fakeNpm,'ci','--prefix',$ArgumentList[3],'--ignore-scripts','--no-audit','--no-fund','--loglevel=error','--progress=false')
            if(($ArgumentList -join '|') -ne ($expected -join '|') -or $TimeoutSeconds -ne 600){throw 'TEST_INSTALL_ARGV_CHANGED'}
            $script:installCalls++;return [pscustomobject]@{ExitCode=$script:installExit;Stdout='SUPPRESSED_PUBLIC_CANARY'}
        }
        if($ArgumentList[0] -ne (Join-Path $PSScriptRoot 'Pr193DependencyProbe.mjs') -or $ArgumentList[1] -ne '--source' -or $ArgumentList[2] -ne $fixture -or $TimeoutSeconds -ne 120){throw 'TEST_PROBE_ARGV_CHANGED'}
        if($script:diagnostics.Count -eq 0){throw 'TEST_TOO_MANY_PROBES'}
        return $script:diagnostics.Dequeue()
    }
    function Add-TestDiagnostic {param([string]$Owner)
        if($Owner){$value=@{schemaVersion=1;status='MISSING';category='ESM_MODULE_MISSING';owner=$Owner;package='public-dependency'};$exitCode=1}
        else{$value=@{schemaVersion=1;status='READY'};$exitCode=0}
        $script:diagnostics.Enqueue([pscustomobject]@{ExitCode=$exitCode;Stdout=($value|ConvertTo-Json -Compress)})
    }
    $script:diagnostics=New-Object System.Collections.Queue;$script:installCalls=0;$script:installExit=0
    foreach($owner in $ownerPaths.Keys){Add-TestDiagnostic $owner};Add-TestDiagnostic ''
    $output=@(Initialize-Pr193CanonicalDependencies $fakeNode $fixture $git)
    if($script:installCalls -ne 6 -or $script:diagnostics.Count -ne 0 -or $output.Count -ne 6){throw 'TEST_OWNER_BOUND_FAILED'}
    Write-Output 'PR193_CANONICAL_SIX_OWNER_BOUND_PASS six installs maximum; seventh probe ready; locked argv'
    $script:diagnostics=New-Object System.Collections.Queue;$script:installCalls=0
    Add-TestDiagnostic 'QUALIFICATION';Add-TestDiagnostic 'QUALIFICATION'
    $refused=$false
    try{$null=Initialize-Pr193CanonicalDependencies $fakeNode $fixture $git}catch{if($_.Exception.Message -ne 'PR193_DEPENDENCY_STILL_MISSING_QUALIFICATION'){throw};$refused=$true}
    if(-not $refused -or $script:installCalls -ne 1){throw 'TEST_REPEAT_OWNER_NOT_REFUSED'}
    Write-Output 'PR193_CANONICAL_REPEAT_OWNER_PASS no reinstall within invocation'
    $script:diagnostics=New-Object System.Collections.Queue;$script:installCalls=0;$script:installExit=1
    Add-TestDiagnostic 'ROOT';$refused=$false
    try{$null=Initialize-Pr193CanonicalDependencies $fakeNode $fixture $git}catch{if($_.Exception.Message -ne 'PR193_DEPENDENCY_INSTALL_FAILED_ROOT'){throw};$refused=$true}
    if(-not $refused -or $script:installCalls -ne 1){throw 'TEST_INSTALL_FAILURE_NOT_REFUSED'}
    Write-Output 'PR193_CANONICAL_INSTALL_FAILURE_PASS fixed owner code; child output suppressed'
} finally {
    Set-Item -LiteralPath Function:Assert-Pr193Source -Value $originalSourceAssert
    Set-Item -LiteralPath Function:Invoke-Pr193Captured -Value $originalCapture
    $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if([IO.Path]::GetFullPath($fixture).StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fixture)){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
