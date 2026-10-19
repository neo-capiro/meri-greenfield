# Fake local composition only. No Git, AWS, dependency install or private operator files.
[CmdletBinding()]
param([string]$NodePath = 'node.exe')
$ErrorActionPreference = 'Stop'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('pr193-bind-fake-' + [Guid]::NewGuid().ToString('N'))
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
try {
    [IO.Directory]::CreateDirectory($scratch) | Out-Null
    . (Join-Path $PSScriptRoot 'Pr193Common.ps1')
    . (Join-Path $PSScriptRoot 'Pr193PublicInputs.ps1')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Invoke-Pr193LocalBindings.ps1') -Destination $scratch
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Pr193Common.ps1') -Destination $scratch
    $fakePublic = @'
$script:Pr193SourceCommit='5b395d4ce9218b872b21c420dc00a3af31739824'
$script:Pr193PacketCommit='b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527'
$script:Pr193ReadbackCommit='05b73a61cb4f2bbfa52eae38ea23e44598c33e9f'
$script:Pr193PacketManifestSha256='2c7b60d898ce4356348d510e203ee69d5969f00176b03add3dd43d3b6c9d51f2'
$script:Pr193ReadbackManifestSha256='adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613'
$script:fakeRoot=$PSScriptRoot
$script:fakeCalls=@()
function Assert-Pr193PublicManifest { }
function Assert-Pr193Source { }
function Write-Pr193SafeFailure([string]$Code) { if($Code -notmatch '^PR193_[A-Z0-9_]+$'){$Code='PR193_REFUSED'};[Console]::WriteLine($Code) }
function Invoke-Pr193Captured {
 param([string]$FilePath,[string[]]$ArgumentList,[string]$WorkingDirectory,[int]$TimeoutSeconds,[hashtable]$Environment)
 $script:fakeCalls += ,$ArgumentList
 [IO.File]::WriteAllText((Join-Path $script:fakeRoot 'fake-calls.json'),(ConvertTo-Json -InputObject $script:fakeCalls -Depth 8))
 if($ArgumentList[0]-ceq '--version'){return [pscustomobject]@{ExitCode=0;Stdout='v24.21.0'}}
 if($ArgumentList[1]-ceq 'bindings'){$out=$ArgumentList[[Array]::IndexOf($ArgumentList,'--out')+1]}
 elseif($ArgumentList[0].EndsWith('build-update-compatible-v2.mjs')){$out=$ArgumentList[3]}
 else{throw 'PR193_FAKE_UNEXPECTED_COMMAND'}
 [IO.Directory]::CreateDirectory($out)|Out-Null
 foreach($role in @('app','model','issuer')){[IO.File]::WriteAllText((Join-Path $out ($role+'.template.json')),'{}')}
 if($ArgumentList[0].EndsWith('build-update-compatible-v2.mjs') -and (Test-Path -LiteralPath (Join-Path $script:fakeRoot 'tamper-target'))){
  $target=[IO.File]::ReadAllText((Join-Path $script:fakeRoot 'tamper-target'))
  if(-not [IO.Path]::GetFullPath($target).StartsWith(($script:fakeRoot.TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)){throw 'PR193_FAKE_TAMPER_PATH_REFUSED'}
  [IO.File]::AppendAllText($target,'FAKE_TAMPER')
 }
 return [pscustomobject]@{ExitCode=0;Stdout='FAKE_PRIVATE_CANARY'}
}
'@
    [IO.File]::WriteAllText((Join-Path $scratch 'Pr193PublicInputs.ps1'),$fakePublic)
    $cache = Join-Path $scratch 'cache'
    $source = Join-Path $cache ('source-' + $script:Pr193SourceCommit)
    $candidate = Join-Path $cache ('packet-' + $script:Pr193PacketCommit + '/public-candidate')
    $readbacks = Join-Path $cache ('readbacks-' + $script:Pr193ReadbackCommit)
    foreach ($path in @($source,$candidate,$readbacks)) { [IO.Directory]::CreateDirectory($path) | Out-Null }
    foreach ($name in @('runtime-values.json','policy.json','allocation.json','image-scans.candidate.json','build-update-compatible-v2.mjs')) {
        [IO.File]::WriteAllText((Join-Path $candidate $name),'{}')
    }
    foreach ($name in @('stage3.observed.json','app.live.template.json','foundation-live.json','private-edge-outputs.json')) {
        [IO.File]::WriteAllText((Join-Path $readbacks $name),'{}')
    }
    $roleKeys = [ordered]@{control='control/material';'temporal-worker'='worker/material';'temporal-issuer'='issuer/material';'model-owner'='owner/material';'model-proxy'='proxy/material'}
    $secrets = @{}; foreach ($role in $roleKeys.Keys) { $secrets[$roleKeys[$role]] = 'arn:fake:' + $role }
    Write-Pr193JsonNew (Join-Path $candidate 'deployment-inputs.candidate.json') @{secrets=$secrets}
    $work = Join-Path $scratch 'private-fake-output'
    New-Pr193PrivateDirectory $work
    [IO.Directory]::CreateDirectory((Join-Path $work 'rendered')) | Out-Null
    [IO.File]::WriteAllText((Join-Path $work 'stage3.json'),'{}')
    [IO.File]::WriteAllText((Join-Path $work 'rendered/summary.json'),'{}')
    [IO.File]::WriteAllText((Join-Path $work 'upload.lock'),'')
    $roles=@();$stateRoles=@();$verifiedRoles=@();$lines=@()
    foreach ($role in $roleKeys.Keys) {
        $relative='rendered/'+$role+'/bundle.json';$path=Join-Path $work $relative
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path))|Out-Null
        [IO.File]::WriteAllText($path,'FAKE_PRIVATE_CANARY')
        [IO.File]::WriteAllText((Join-Path ([IO.Path]::GetDirectoryName($path)) 'expected.json'),'{}')
        $sha=Get-Pr193Sha256 $path;$size=(Get-Item -LiteralPath $path).Length;$version=[Guid]::NewGuid().ToString()
        $roles += @{role=$role;bundleRelativePath=$relative;bytes=$size;sha256=$sha}
        $stateRoles += @{role=$role;arn=$secrets[$roleKeys[$role]];bundleRelativePath=$relative;bytes=$size;sha256=$sha;token=$version;versionId=$version;status='COMPLETE'}
        $verifiedRoles += @{role=$role;arn=$secrets[$roleKeys[$role]];versionId=$version;sha256=$sha;bytes=$size}
        $lines += $role+"`t"+$version
    }
    $render=@{schemaVersion=1;sourceCommit=$script:Pr193SourceCommit;packetCommit=$script:Pr193PacketCommit;readbackCommit=$script:Pr193ReadbackCommit;
        packetManifestSha256=$script:Pr193PacketManifestSha256;readbackManifestSha256=$script:Pr193ReadbackManifestSha256;roles=$roles;
        stage3Sha256=(Get-Pr193Sha256 (Join-Path $work 'stage3.json'));summarySha256=(Get-Pr193Sha256 (Join-Path $work 'rendered/summary.json'))}
    foreach($pair in @(@('runtimeValuesSha256','runtime-values.json'),@('deploymentInputsSha256','deployment-inputs.candidate.json'),@('policySha256','policy.json'),@('allocationSha256','allocation.json'))){$render[$pair[0]]=Get-Pr193Sha256 (Join-Path $candidate $pair[1])}
    Write-Pr193JsonNew (Join-Path $work 'local-render-receipt.json') $render
    $renderHash=Get-Pr193Sha256 (Join-Path $work 'local-render-receipt.json')
    $approvedManifest='870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50'
    $state=@{schemaVersion=1;sourceCommit=$script:Pr193SourceCommit;packetCommit=$script:Pr193PacketCommit;readbackCommit=$script:Pr193ReadbackCommit;renderReceiptSha256=$renderHash;approvedManifestSha256=$approvedManifest;label='FIRST_CHAT_20261019D';roles=$stateRoles}
    Write-Pr193JsonNew (Join-Path $work 'upload-state.json') $state
    [IO.File]::WriteAllText((Join-Path $work 'secret-versions.tsv'),(($lines-join "`n")+"`n"),(New-Object Text.UTF8Encoding($false)))
    $arguments=@('-NoProfile','-NonInteractive','-File',(Join-Path $scratch 'Invoke-Pr193LocalBindings.ps1'),'-OutputDirectory',$work,'-PublicCacheRoot',$cache,'-NodePath',$NodePath)
    function Invoke-FakeBinding {
        $childOutput=(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @arguments | Out-String)
        $childExit=$LASTEXITCODE
        if($childOutput.Contains('FAKE_PRIVATE_CANARY')){throw 'BIND_PRIVATE_STDOUT_REFUSAL_FAILED'}
        return [pscustomobject]@{ExitCode=$childExit;Output=$childOutput}
    }
    function Reset-FakeBindingOutputs {
        foreach($name in @('bindings','update-compatible-v2','local-bindings-receipt.json')){
            $owned=[IO.Path]::GetFullPath((Join-Path $work $name))
            if(-not $owned.StartsWith(([IO.Path]::GetFullPath($scratch).TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)){throw 'BIND_FAKE_CLEANUP_PATH_REFUSED'}
            if(Test-Path -LiteralPath $owned){Remove-Item -LiteralPath $owned -Recurse -Force}
        }
    }
    $result=Invoke-FakeBinding
    if($result.ExitCode-ne 2 -or (Test-Path -LiteralPath (Join-Path $work 'bindings'))){throw 'BIND_MISSING_UPLOAD_RECEIPT_REFUSAL_FAILED'}
    $upload=@{schemaVersion=1;status='PR193_PRIVATE_UPLOAD_VERIFIED';sourceCommit=$script:Pr193SourceCommit;packetCommit=$script:Pr193PacketCommit;readbackCommit=$script:Pr193ReadbackCommit;
        renderReceiptSha256=$renderHash;stateSha256=(Get-Pr193Sha256 (Join-Path $work 'upload-state.json'));secretVersionsSha256=(Get-Pr193Sha256 (Join-Path $work 'secret-versions.tsv'));approvedManifestSha256=$approvedManifest;label='FIRST_CHAT_20261019D';roles=$verifiedRoles}
    Write-Pr193JsonNew (Join-Path $work 'upload-receipt.json') $upload
    $utf8=New-Object Text.UTF8Encoding($false)
    foreach($owner in @('state','upload')){
        foreach($mode in @('missing','wrong')){
            $state.approvedManifestSha256=$approvedManifest;$upload.approvedManifestSha256=$approvedManifest
            $target=if($owner-ceq 'state'){$state}else{$upload}
            if($mode-ceq 'missing'){$target.Remove('approvedManifestSha256')}else{$target.approvedManifestSha256=('0'*64)}
            [IO.File]::WriteAllText((Join-Path $work 'upload-state.json'),(ConvertTo-Json -InputObject $state -Depth 16),$utf8)
            $upload.stateSha256=Get-Pr193Sha256 (Join-Path $work 'upload-state.json')
            [IO.File]::WriteAllText((Join-Path $work 'upload-receipt.json'),(ConvertTo-Json -InputObject $upload -Depth 16),$utf8)
            $result=Invoke-FakeBinding
            $calls=[IO.File]::ReadAllText((Join-Path $scratch 'fake-calls.json'))|ConvertFrom-Json
            if($result.ExitCode-ne 2 -or $result.Output-notmatch 'PR193_UPLOAD_RENDER_JOIN_REFUSED' -or
                $calls.Count-ne 1 -or $calls[0][0]-cne '--version' -or (Test-Path -LiteralPath (Join-Path $work 'bindings')) -or
                (Test-Path -LiteralPath (Join-Path $work 'local-bindings-receipt.json'))){throw ('BIND_APPROVED_MANIFEST_'+$owner+'_'+$mode+'_REFUSAL_FAILED')}
        }
    }
    $state.approvedManifestSha256=$approvedManifest;$upload.approvedManifestSha256=$approvedManifest
    [IO.File]::WriteAllText((Join-Path $work 'upload-state.json'),(ConvertTo-Json -InputObject $state -Depth 16),$utf8)
    $upload.stateSha256=Get-Pr193Sha256 (Join-Path $work 'upload-state.json')
    [IO.File]::WriteAllText((Join-Path $work 'upload-receipt.json'),(ConvertTo-Json -InputObject $upload -Depth 16),$utf8)
    $result=Invoke-FakeBinding
    if($result.ExitCode-ne 0 -or $result.Output-notmatch 'PR193_LOCAL_BINDINGS_COMPLETE_NO_DEPLOYMENT'){throw 'BIND_COMPOSITION_FAILED'}
    $receipt=[IO.File]::ReadAllText((Join-Path $work 'local-bindings-receipt.json'))|ConvertFrom-Json
    if($receipt.templates.Count-ne 3 -or $receipt.uploadReceiptSha256-cne (Get-Pr193Sha256 (Join-Path $work 'upload-receipt.json')) -or
        $receipt.approvedManifestSha256-cne $approvedManifest){throw 'BIND_RECEIPT_FAILED'}
    $calls=[IO.File]::ReadAllText((Join-Path $scratch 'fake-calls.json'))|ConvertFrom-Json
    if($calls.Count-ne 3 -or $calls[1][1]-cne 'bindings' -or -not $calls[2][0].EndsWith('build-update-compatible-v2.mjs')){throw 'BIND_ARGV_FAILED'}
    Assert-Pr193PrivateTreeAcl $work
    $tamperPaths=@((Join-Path $work 'secret-versions.tsv'),(Join-Path $work 'rendered/summary.json'),(Join-Path $work 'stage3.json'))
    foreach($role in $roleKeys.Keys){$tamperPaths+=Join-Path $work ('rendered/'+$role+'/expected.json')}
    foreach($name in @('runtime-values.json','deployment-inputs.candidate.json','policy.json','allocation.json','image-scans.candidate.json','build-update-compatible-v2.mjs')){$tamperPaths+=Join-Path $candidate $name}
    foreach($name in @('app.live.template.json','foundation-live.json','private-edge-outputs.json')){$tamperPaths+=Join-Path $readbacks $name}
    foreach($targetPath in $tamperPaths){
        Reset-FakeBindingOutputs
        $original=[IO.File]::ReadAllBytes($targetPath)
        [IO.File]::WriteAllText((Join-Path $scratch 'tamper-target'),$targetPath)
        $result=Invoke-FakeBinding
        if($result.ExitCode-ne 2 -or $result.Output-notmatch 'PR193_INPUT_CHANGED_DURING_BIND' -or
            (Test-Path -LiteralPath (Join-Path $work 'local-bindings-receipt.json'))){throw ('BIND_CHANGED_INPUT_REFUSAL_FAILED: '+[IO.Path]::GetFileName($targetPath))}
        [IO.File]::WriteAllBytes($targetPath,$original)
    }
    ('PS51_FAKE_BIND_COMPOSITION_PASS; missing upload refusal; 4 approved-manifest refusals before composition; approved manifest receipt; '+$tamperPaths.Count+' mid-command input tamper refusals; three templates; canonical argv; no private stdout; private ACL')
} finally {
    $resolved=[IO.Path]::GetFullPath($scratch)
    if(-not $resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved)-notlike 'pr193-bind-fake-*'){throw 'BIND_FAKE_CLEANUP_PATH_REFUSED'}
    if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
