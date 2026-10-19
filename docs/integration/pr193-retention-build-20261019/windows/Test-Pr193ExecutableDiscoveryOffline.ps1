# PS5.1 fake-only executable discovery boundary; no private operator files, Git fetch or AWS.
param()
$ErrorActionPreference='Stop'
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('pr193-multimatch-fake-'+[Guid]::NewGuid().ToString('N'))
try {
    [IO.Directory]::CreateDirectory($scratch)|Out-Null
    foreach($name in @('Invoke-Pr193LocalRender.ps1','Pr193Common.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $scratch}
    $pki=Join-Path $scratch 'FAKE_PRIVATE_CANARY_PKI';[IO.Directory]::CreateDirectory($pki)|Out-Null
    $core=Join-Path $scratch 'FAKE_PRIVATE_CANARY_CORE.json';[IO.File]::WriteAllText($core,'fake only')
    $out=Join-Path $scratch 'FAKE_PRIVATE_CANARY_OUTPUT';$cache=Join-Path $scratch 'cache'
    $fake=@'
$script:Pr193ReadbackCommit='05b73a61cb4f2bbfa52eae38ea23e44598c33e9f'
function Get-Command {
[CmdletBinding()]param([string]$Name,[string]$CommandType)
if($Name-eq 'node.exe'){$script:expectedNode='C:\FAKE_FIRST_NODE\node.exe';return @([pscustomobject]@{Source=$script:expectedNode},[pscustomobject]@{Source='C:\FAKE_SECOND_NODE\node.exe'})}
if($Name-eq 'git.exe'){return @([pscustomobject]@{Source='C:\FAKE_FIRST_GIT\git.exe'},[pscustomobject]@{Source='C:\FAKE_SECOND_GIT\git.exe'},[pscustomobject]@{Source='C:\FAKE_THIRD_GIT\git.exe'})}
if($Name-eq 'C:\FAKE_EXPLICIT_NODE\node.exe'){$script:expectedNode=$Name;return [pscustomobject]@{Source=$Name}}
throw 'PR193_FAKE_UNEXPECTED_DISCOVERY'
}
function Invoke-Pr193Captured {
param([string]$FilePath,[string[]]$ArgumentList,[string]$WorkingDirectory,[int]$TimeoutSeconds,[hashtable]$Environment)
if($FilePath-cne $script:expectedNode -or $ArgumentList.Count-ne 1 -or $ArgumentList[0]-cne '--version'){throw 'PR193_FAKE_WRONG_NODE_SELECTED'}
return [pscustomobject]@{ExitCode=0;Stdout='v24.19.0'}
}
function Initialize-Pr193PublicInputs {
param([string]$PublicCacheRoot,[string]$ReadbackCommit,[string]$Git)
if($Git-cne 'C:\FAKE_FIRST_GIT\git.exe'){throw 'PR193_FAKE_WRONG_GIT_SELECTED'}
throw 'PR193_FAKE_PUBLIC_BOUNDARY'
}
'@
    [IO.File]::WriteAllText((Join-Path $scratch 'Pr193PublicInputs.ps1'),$fake)
    foreach($node in @('node.exe','C:\FAKE_EXPLICIT_NODE\node.exe')){
        $arguments=@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',(Join-Path $scratch 'Invoke-Pr193LocalRender.ps1'),'-PrivatePkiDirectory',$pki,'-CoreValuesPath',$core,'-OutputDirectory',$out,'-PublicCacheRoot',$cache,'-NodePath',$node)
        $ErrorActionPreference='Continue'
        $records=@(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @arguments 2>&1)
        $code=$LASTEXITCODE;$ErrorActionPreference='Stop'
        $text=($records|ForEach-Object{[string]$_})-join "`n"
        if($code-ne 2 -or $text-notmatch '^PR193_PUBLIC_PREPARATION\s+PR193_FAKE_PUBLIC_BOUNDARY$' -or $text.Contains('FAKE_PRIVATE_CANARY') -or (Test-Path -LiteralPath $out) -or (Test-Path -LiteralPath $cache)){throw 'MULTIMATCH_BOUNDARY_FAILED'}
    }
    'PS51_MULTIMATCH_2_PASS; first of two Node/three Git; explicit NodePath; version24 check; no private/net work'
} finally {
    $resolved=[IO.Path]::GetFullPath($scratch);$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if(-not $resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved)-notlike 'pr193-multimatch-fake-*'){throw 'MULTIMATCH_CLEANUP_REFUSED'}
    if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
