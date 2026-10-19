<#
.SYNOPSIS
Builds local canonical PR193 bindings and reviewed C-compatible templates after the separate approved upload.
.DESCRIPTION
Windows PowerShell 5.1; no AWS, fetch, upload or deployment. Requires final upload-receipt.json, complete state and exact secret-versions.tsv.
Exit 0: local-bindings-receipt.json written; exit 2: bounded refusal. Private paths/output are never printed.
#>
[CmdletBinding()]
param([string]$OutputDirectory, [string]$PublicCacheRoot,
      [string]$ReadbackCommit = '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f',
      [string]$NodePath = 'node.exe', [switch]$Help)
$ErrorActionPreference = 'Stop'
$approvedManifestSha256 = '870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50'
. (Join-Path $PSScriptRoot 'Pr193Common.ps1')
. (Join-Path $PSScriptRoot 'Pr193PublicInputs.ps1')
if ($Help) {
    Write-Output 'Invoke-Pr193LocalBindings.ps1 -OutputDirectory <successful private render> -PublicCacheRoot <same public cache> [-NodePath <Node24-exe>]. Requires five confirmed uploads. Exit 0 complete; 2 refused. No AWS or deployment.'
    exit 0
}
$lock = $null
try {
    if ($PSVersionTable.PSVersion.Major -lt 5 -or $env:OS -ne 'Windows_NT') { throw 'PR193_WINDOWS_POWERSHELL_REQUIRED' }
    if (-not $OutputDirectory -or -not $PublicCacheRoot -or -not [IO.Path]::IsPathRooted($OutputDirectory) -or
        -not [IO.Path]::IsPathRooted($PublicCacheRoot)) { throw 'PR193_ARGUMENTS_REQUIRED' }
    if ($ReadbackCommit -ne $script:Pr193ReadbackCommit) { throw 'PR193_READBACK_COMMIT_REFUSED' }
    $work = [IO.Path]::GetFullPath($OutputDirectory)
    Assert-Pr193PrivateTreeAcl $work
    $cache = [IO.Path]::GetFullPath($PublicCacheRoot)
    Assert-Pr193NoReparsePoint $cache
    $source = Join-Path $cache ('source-' + $script:Pr193SourceCommit)
    $packet = Join-Path $cache ('packet-' + $script:Pr193PacketCommit)
    $readbacks = Join-Path $cache ('readbacks-' + $ReadbackCommit)
    $null = Assert-Pr193PublicManifest $packet 'PUBLIC-FILE-MANIFEST.json' $script:Pr193PacketManifestSha256
    $null = Assert-Pr193PublicManifest $readbacks 'FILE-MANIFEST.json' $script:Pr193ReadbackManifestSha256
    $git = @(Get-Command git.exe -CommandType Application -ErrorAction Stop)[0].Source
    Assert-Pr193Source $git $source
    $node = @(Get-Command $NodePath -CommandType Application -ErrorAction Stop)[0].Source
    $nodeEnvironment = @{ NODE_OPTIONS=$null; NODE_PATH=$null }
    $version = Invoke-Pr193Captured $node @('--version') $source 30 $nodeEnvironment
    if ($version.ExitCode -ne 0 -or $version.Stdout.Trim() -notmatch '^v24\.[0-9]+\.[0-9]+$') { throw 'PR193_NODE24_REQUIRED' }
    foreach ($name in @('bindings','update-compatible-v2','local-bindings-receipt.json')) {
        if (Test-Path -LiteralPath (Join-Path $work $name)) { throw 'PR193_BINDINGS_OUTPUT_EXISTS' }
    }
    $lock = [IO.File]::Open((Join-Path $work 'upload.lock'), [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $receiptPath = Join-Path $work 'local-render-receipt.json'
    $statePath = Join-Path $work 'upload-state.json'
    $uploadReceiptPath = Join-Path $work 'upload-receipt.json'
    $versionsPath = Join-Path $work 'secret-versions.tsv'
    foreach ($path in @($receiptPath,$statePath,$uploadReceiptPath,$versionsPath)) {
        if ((Get-Item -LiteralPath $path).Length -gt 1048576) { throw 'PR193_RECEIPT_SIZE_REFUSED' }
    }
    $render = [IO.File]::ReadAllText($receiptPath) | ConvertFrom-Json
    $state = [IO.File]::ReadAllText($statePath) | ConvertFrom-Json
    $upload = [IO.File]::ReadAllText($uploadReceiptPath) | ConvertFrom-Json
    $receiptHash = Get-Pr193Sha256 $receiptPath
    $stateHash = Get-Pr193Sha256 $statePath
    $uploadHash = Get-Pr193Sha256 $uploadReceiptPath
    $versionsHash = Get-Pr193Sha256 $versionsPath
    if ($render.schemaVersion -ne 1 -or $render.sourceCommit -ne $script:Pr193SourceCommit -or
        $render.packetCommit -ne $script:Pr193PacketCommit -or $render.readbackCommit -ne $ReadbackCommit -or
        $render.packetManifestSha256 -ne $script:Pr193PacketManifestSha256 -or $render.readbackManifestSha256 -ne $script:Pr193ReadbackManifestSha256 -or
        $state.schemaVersion -ne 1 -or $state.sourceCommit -ne $script:Pr193SourceCommit -or $state.packetCommit -ne $script:Pr193PacketCommit -or
        $state.readbackCommit -ne $ReadbackCommit -or $state.renderReceiptSha256 -ne $receiptHash -or $state.label -ne 'FIRST_CHAT_20261019D' -or
        @($render.roles).Count -ne 5 -or @($state.roles).Count -ne 5 -or
        $upload.schemaVersion -ne 1 -or $upload.status -cne 'PR193_PRIVATE_UPLOAD_VERIFIED' -or
        $upload.sourceCommit -cne $script:Pr193SourceCommit -or $upload.packetCommit -cne $script:Pr193PacketCommit -or
        $upload.readbackCommit -cne $ReadbackCommit -or $upload.renderReceiptSha256 -cne $receiptHash -or
        $upload.stateSha256 -cne $stateHash -or $upload.secretVersionsSha256 -cne $versionsHash -or
        $upload.label -cne 'FIRST_CHAT_20261019D' -or @($upload.roles).Count -ne 5 -or
        $state.approvedManifestSha256 -cne $approvedManifestSha256 -or
        $upload.approvedManifestSha256 -cne $approvedManifestSha256) { throw 'PR193_UPLOAD_RENDER_JOIN_REFUSED' }
    $candidate = Join-Path $packet 'public-candidate'
    $expectedFiles = @{
        runtimeValuesSha256=(Join-Path $candidate 'runtime-values.json');deploymentInputsSha256=(Join-Path $candidate 'deployment-inputs.candidate.json')
        policySha256=(Join-Path $candidate 'policy.json');allocationSha256=(Join-Path $candidate 'allocation.json')
        stage3Sha256=(Join-Path $work 'stage3.json');summarySha256=(Join-Path $work 'rendered/summary.json')
    }
    foreach ($field in $expectedFiles.Keys) { if ($render.$field -ne (Get-Pr193Sha256 $expectedFiles[$field])) { throw 'PR193_RENDER_FILE_JOIN_REFUSED' } }
    if ($render.stage3Sha256 -ne (Get-Pr193Sha256 (Join-Path $readbacks 'stage3.observed.json'))) { throw 'PR193_STAGE3_READBACK_JOIN_REFUSED' }
    $deployment = [IO.File]::ReadAllText((Join-Path $candidate 'deployment-inputs.candidate.json')) | ConvertFrom-Json
    $roleKeys = [ordered]@{control='control/material';'temporal-worker'='worker/material';'temporal-issuer'='issuer/material';'model-owner'='owner/material';'model-proxy'='proxy/material'}
    $versionLines = @()
    foreach ($role in $roleKeys.Keys) {
        $renderedRole = @($render.roles | Where-Object { $_.role -ceq $role })
        $uploadedRole = @($state.roles | Where-Object { $_.role -ceq $role })
        $verifiedRole = @($upload.roles | Where-Object { $_.role -ceq $role })
        if ($renderedRole.Count -ne 1 -or $uploadedRole.Count -ne 1 -or $verifiedRole.Count -ne 1) { throw 'PR193_UPLOAD_ROLE_JOIN_REFUSED' }
        $r = $renderedRole[0]; $u = $uploadedRole[0]; $relative = 'rendered/' + $role + '/bundle.json'
        $v = $verifiedRole[0]
        $bundle = Join-Path $work $relative
        if ($r.bundleRelativePath -cne $relative -or $u.bundleRelativePath -cne $relative -or $u.status -cne 'COMPLETE' -or
            $u.token -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' -or $u.versionId -cne $u.token -or
            $u.arn -cne $deployment.secrets.($roleKeys[$role]) -or $u.bytes -ne $r.bytes -or $u.sha256 -cne $r.sha256 -or
            (Get-Item -LiteralPath $bundle).Length -ne $r.bytes -or (Get-Pr193Sha256 $bundle) -cne $r.sha256 -or
            $v.arn -cne $u.arn -or $v.versionId -cne $u.versionId -or $v.sha256 -cne $u.sha256 -or $v.bytes -ne $u.bytes) { throw 'PR193_UPLOAD_BUNDLE_JOIN_REFUSED' }
        $versionLines += $role + "`t" + $u.versionId
    }
    if ([IO.File]::ReadAllText($versionsPath) -cne (($versionLines -join "`n") + "`n")) { throw 'PR193_UPLOAD_VERSION_FILE_REFUSED' }
    # Canonical code validates expected.json semantics; retain the exact consumed bytes through synthesis.
    $consumedHashes = @{}
    $consumedPaths = @($expectedFiles.Values) + @(
        (Join-Path $readbacks 'app.live.template.json'), (Join-Path $readbacks 'foundation-live.json'),
        (Join-Path $readbacks 'private-edge-outputs.json'), (Join-Path $candidate 'image-scans.candidate.json'),
        (Join-Path $candidate 'build-update-compatible-v2.mjs'))
    foreach ($role in $roleKeys.Keys) { $consumedPaths += Join-Path $work ('rendered/' + $role + '/expected.json') }
    foreach ($path in $consumedPaths) { $consumedHashes[$path] = Get-Pr193Sha256 $path }
    $bindings = Join-Path $work 'bindings'
    $result = Invoke-Pr193Captured $node @((Join-Path $source 'infra/product-preview/first-chat/stage3-deploy.mjs'),'bindings',
        '--deployment-inputs',(Join-Path $candidate 'deployment-inputs.candidate.json'),'--foundation-outputs',(Join-Path $readbacks 'foundation-live.json'),
        '--private-edge-outputs',(Join-Path $readbacks 'private-edge-outputs.json'),'--rendered',(Join-Path $work 'rendered'),
        '--secret-versions',$versionsPath,'--image-scans',(Join-Path $candidate 'image-scans.candidate.json'),'--out',$bindings) $source 120 $nodeEnvironment
    if ($result.ExitCode -ne 0) { throw 'PR193_CANONICAL_BINDINGS_REFUSED' }
    $compatible = Join-Path $work 'update-compatible-v2'
    $result = Invoke-Pr193Captured $node @((Join-Path $candidate 'build-update-compatible-v2.mjs'),$readbacks,$bindings,$compatible,$source) $source 120 $nodeEnvironment
    if ($result.ExitCode -ne 0) { throw 'PR193_COMPATIBLE_TEMPLATES_REFUSED' }
    if ((Get-Pr193Sha256 $receiptPath) -ne $receiptHash -or (Get-Pr193Sha256 $statePath) -ne $stateHash -or
        (Get-Pr193Sha256 $uploadReceiptPath) -ne $uploadHash -or (Get-Pr193Sha256 $versionsPath) -ne $versionsHash) { throw 'PR193_INPUT_CHANGED_DURING_BIND' }
    foreach ($role in $render.roles) {
        $bundle = Join-Path $work $role.bundleRelativePath
        if ((Get-Item -LiteralPath $bundle).Length -ne $role.bytes -or (Get-Pr193Sha256 $bundle) -cne $role.sha256) {
            throw 'PR193_INPUT_CHANGED_DURING_BIND'
        }
    }
    foreach ($path in $consumedHashes.Keys) {
        if ((Get-Pr193Sha256 $path) -cne $consumedHashes[$path]) { throw 'PR193_INPUT_CHANGED_DURING_BIND' }
    }
    foreach ($field in $expectedFiles.Keys) {
        if ((Get-Pr193Sha256 $expectedFiles[$field]) -cne $render.$field) { throw 'PR193_INPUT_CHANGED_DURING_BIND' }
    }
    $null = Assert-Pr193PublicManifest $packet 'PUBLIC-FILE-MANIFEST.json' $script:Pr193PacketManifestSha256
    $null = Assert-Pr193PublicManifest $readbacks 'FILE-MANIFEST.json' $script:Pr193ReadbackManifestSha256
    Assert-Pr193PrivateTreeAcl $work
    Assert-Pr193Source $git $source
    $templates = @()
    foreach ($role in @('app','model','issuer')) {
        $relative = 'update-compatible-v2/' + $role + '.template.json'
        $path = Join-Path $work $relative
        $templates += [pscustomobject]@{role=$role;relativePath=$relative;bytes=(Get-Item -LiteralPath $path).Length;sha256=(Get-Pr193Sha256 $path)}
    }
    Write-Pr193JsonNew (Join-Path $work 'local-bindings-receipt.json') ([ordered]@{schemaVersion=1;sourceCommit=$script:Pr193SourceCommit;
        packetCommit=$script:Pr193PacketCommit;readbackCommit=$ReadbackCommit;renderReceiptSha256=$receiptHash;uploadStateSha256=$stateHash;uploadReceiptSha256=$uploadHash;
        secretVersionsSha256=$versionsHash;approvedManifestSha256=$approvedManifestSha256;templates=$templates})
    Write-Output 'PR193_LOCAL_BINDINGS_COMPLETE_NO_DEPLOYMENT'
    exit 0
} catch {
    Write-Pr193SafeFailure $_.Exception.Message
    exit 2
} finally {
    if ($null -ne $lock) { $lock.Dispose() }
}
