param([string]$SourceRoot,[string]$OperatorsRoot,[string]$NodePath)
$ErrorActionPreference='Stop'
. (Join-Path $OperatorsRoot 'Pr193Common.ps1')
. (Join-Path $OperatorsRoot 'Pr193PublicInputs.ps1')
$git=@(Get-Command git.exe -CommandType Application)[0].Source
$env:GIT_CONFIG_COUNT='1';$env:GIT_CONFIG_KEY_0='safe.directory';$env:GIT_CONFIG_VALUE_0=[IO.Path]::GetFullPath($SourceRoot).Replace('\','/')
Assert-Pr193Source $git $SourceRoot
if (@(Get-ChildItem -LiteralPath $SourceRoot -Directory -Filter node_modules -Recurse -Force).Count) {throw 'COLD_CHECKOUT_HAS_DEPENDENCIES'}
$cursor=$SourceRoot
while ($cursor) {
 if (Test-Path -LiteralPath (Join-Path $cursor 'node_modules')) {throw 'COLD_ANCESTOR_HAS_DEPENDENCIES'}
 $cursor=[IO.Path]::GetDirectoryName($cursor.TrimEnd('\'))
}
$version=Invoke-Pr193Captured $NodePath @('--version') $SourceRoot 30 @{NODE_OPTIONS=$null;NODE_PATH=$null}
if($version.ExitCode -ne 0 -or $version.Stdout.Trim() -ne 'v24.19.0'){throw 'COLD_NODE_VERSION_REFUSED'}
'PR193_COLD_START PS='+$PSVersionTable.PSVersion+' NODE='+$version.Stdout.Trim()+' SOURCE=5b395d4ce9218b872b21c420dc00a3af31739824'
Initialize-Pr193CanonicalDependencies $NodePath $SourceRoot $git
'PR193_COLD_CANONICAL_DEPENDENCIES_COMPLETE'
