# Fake composition only: no canonical renderer, dependency installation, Git or AWS runs.
[CmdletBinding()]
param([string]$NodePath = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
$ErrorActionPreference = 'Stop'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('pr193-render-fake-' + [Guid]::NewGuid().ToString('N'))
$expectedParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
try {
    [IO.Directory]::CreateDirectory($scratch) | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Invoke-Pr193LocalRender.ps1') -Destination (Join-Path $scratch 'Invoke-Pr193LocalRender.ps1')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Pr193Common.ps1') -Destination (Join-Path $scratch 'Pr193Common.ps1')
    . (Join-Path $PSScriptRoot 'Pr193Common.ps1')
    foreach ($name in @('fake-pki','source','packet','packet/public-candidate','readbacks')) { [IO.Directory]::CreateDirectory((Join-Path $scratch $name)) | Out-Null }
    [IO.File]::WriteAllText((Join-Path $scratch 'fake-core.json'),'FAKE_PRIVATE_CANARY')
    [IO.File]::WriteAllText((Join-Path $scratch 'readbacks/stage3.observed.json'),'{"fakeStage3":true}')
    foreach($name in @('runtime-values.json','deployment-inputs.candidate.json','policy.json','allocation.json')) { [IO.File]::WriteAllText((Join-Path $scratch ('packet/public-candidate/'+$name)),'{}') }
    $fakePublic = @'
$script:Pr193SourceCommit='5b395d4ce9218b872b21c420dc00a3af31739824'
$script:Pr193PacketCommit='b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527'
$script:Pr193ReadbackCommit='05b73a61cb4f2bbfa52eae38ea23e44598c33e9f'
$script:Pr193PacketManifestSha256='2c7b60d898ce4356348d510e203ee69d5969f00176b03add3dd43d3b6c9d51f2'
$script:Pr193ReadbackManifestSha256='adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613'
$script:fakeRoot=$PSScriptRoot
$script:fakeCalls=@()
function Write-Pr193SafeFailure([string]$Code) { if($Code -notmatch '^PR193_[A-Z0-9_]+$'){$Code='PR193_REFUSED'};[Console]::WriteLine('FAKE_REFUSAL_'+$Code) }
function Get-Pr193Sha256([string]$Path) {
 if([IO.Path]::GetFileName($Path)-ceq 'runtime-values.json'){return '46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d'}
 return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Initialize-Pr193PublicInputs { return [pscustomobject]@{Source=(Join-Path $script:fakeRoot 'source');Packet=(Join-Path $script:fakeRoot 'packet');Readbacks=(Join-Path $script:fakeRoot 'readbacks')} }
function Initialize-Pr193CanonicalDependencies { }
function Assert-Pr193Source { }
function Invoke-Pr193Captured {
 param([string]$FilePath,[string[]]$ArgumentList,[string]$WorkingDirectory,[int]$TimeoutSeconds,[hashtable]$Environment)
 $script:fakeCalls += ,$ArgumentList
 [IO.File]::WriteAllText((Join-Path $script:fakeRoot 'fake-calls.json'),(ConvertTo-Json -InputObject $script:fakeCalls -Depth 8))
 if($ArgumentList[0]-ceq '--version'){return [pscustomobject]@{ExitCode=0;Stdout='v24.21.0'}}
 if($ArgumentList[1]-ceq 'stage3-input'){
  $out=$ArgumentList[[Array]::IndexOf($ArgumentList,'--out')+1]
  [IO.File]::WriteAllText($out,'{"fakeStage3":true}')
 }elseif($ArgumentList[0].EndsWith('render-material.mjs')){
  $out=$ArgumentList[[Array]::IndexOf($ArgumentList,'--out')+1]
  [IO.Directory]::CreateDirectory($out)|Out-Null
  foreach($role in @('control','temporal-worker','temporal-issuer','model-owner','model-proxy')){
   $dir=Join-Path $out $role;[IO.Directory]::CreateDirectory($dir)|Out-Null
   [IO.File]::WriteAllText((Join-Path $dir 'bundle.json'),'{"fake":"FAKE_PRIVATE_CANARY"}')
  }
  [IO.File]::WriteAllText((Join-Path $out 'summary.json'),'{"fakeSummary":true}')
 }else{throw 'PR193_FAKE_UNEXPECTED_COMMAND'}
 return [pscustomobject]@{ExitCode=0;Stdout='FAKE_PRIVATE_CANARY output must be suppressed'}
}
'@
    [IO.File]::WriteAllText((Join-Path $scratch 'Pr193PublicInputs.ps1'),$fakePublic)
    $work=Join-Path $scratch 'private-fake-output'
    $arguments=@('-NoProfile','-NonInteractive','-File',(Join-Path $scratch 'Invoke-Pr193LocalRender.ps1'),'-PrivatePkiDirectory',(Join-Path $scratch 'fake-pki'),'-CoreValuesPath',(Join-Path $scratch 'fake-core.json'),'-OutputDirectory',$work,'-PublicCacheRoot',(Join-Path $scratch 'cache'),'-NodePath',$NodePath)
    $childOutput=(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @arguments | Out-String)
    $childExit=$LASTEXITCODE
    if($childExit-ne 0 -or $childOutput -notmatch 'PR193_LOCAL_RENDER_COMPLETE' -or $childOutput.Contains('FAKE_PRIVATE_CANARY')){throw 'FAKE_RENDER_COMPOSITION_FAILED'}
    $receipt=[IO.File]::ReadAllText((Join-Path $work 'local-render-receipt.json'))|ConvertFrom-Json
    if($receipt.roles.Count-ne 5 -or $receipt.runtimeValuesSha256-cne '46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d'){throw 'FAKE_RECEIPT_BINDING_FAILED'}
    Assert-Pr193PrivateTreeAcl $work
    $calls=[IO.File]::ReadAllText((Join-Path $scratch 'fake-calls.json'))|ConvertFrom-Json
    if($calls.Count-ne 3 -or $calls[1][1]-cne 'stage3-input' -or $calls[2] -contains '--feature-secrets' -or $calls[2] -contains '--capability-profile' -or $calls[2] -contains '--active-read-operations'){throw 'FAKE_COMMAND_SCOPE_FAILED'}
    foreach($flag in @('--deployment-inputs','--private','--core','--runtime','--stage3','--out')){if($calls[2] -cnotcontains $flag){throw 'FAKE_RENDER_ARGUMENT_MISSING'}}
    $again=(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @arguments | Out-String)
    if($LASTEXITCODE-ne 2 -or $again.Contains('PUBLIC_PREPARATION') -or $again.Contains('FAKE_PRIVATE_CANARY')){throw 'FAKE_EXISTING_OUTPUT_REFUSAL_FAILED'}
    [Console]::WriteLine('PS51_FAKE_RENDER_COMPOSITION_PASS; five roles; canonical argv; inherited child ACL; no private stdout; existing-output refusal')
} finally {
    $resolved=[IO.Path]::GetFullPath($scratch)
    if(-not $resolved.StartsWith($expectedParent,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved)-notlike 'pr193-render-fake-*'){throw 'FAKE_CLEANUP_PATH_REFUSED'}
    if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
