<#
.SYNOPSIS
Verifies pinned public Git inputs and renders PR193 material locally on Windows PowerShell 5.1.
.DESCRIPTION
No AWS calls. Private paths are local parameters and are never printed. Existing output is refused.
Exit 0: local render receipt written; exit 2: bounded refusal, no successful receipt.
.EXAMPLE
.\Invoke-Pr193LocalRender.ps1 -PrivatePkiDirectory '<EXISTING_PRIVATE_PKI>' -CoreValuesPath '<EXISTING_PRIVATE_CORE_JSON>' -OutputDirectory '<NEW_PRIVATE_DIRECTORY>' -PublicCacheRoot '<PUBLIC_CACHE>'
#>
[CmdletBinding()]
param(
    [string]$PrivatePkiDirectory,
    [string]$CoreValuesPath,
    [string]$OutputDirectory,
    [string]$PublicCacheRoot = (Join-Path $env:LOCALAPPDATA 'Meri\pr193-public'),
    [string]$ReadbackCommit = '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f',
    [string]$NodePath = 'node.exe',
    [switch]$Help
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Pr193Common.ps1')
. (Join-Path $PSScriptRoot 'Pr193PublicInputs.ps1')
if ($Help) {
    Write-Output 'PR193 local render: -PrivatePkiDirectory <existing> -CoreValuesPath <existing> -OutputDirectory <new> [-PublicCacheRoot <public-cache>] [-NodePath <Node24-exe>] [-ReadbackCommit <reviewed-exact-pin>]. Exit 0 success; 2 refused. No AWS.'
    exit 0
}
$phase = 'ARGUMENTS'
try {
    if ($PSVersionTable.PSVersion.Major -lt 5 -or $env:OS -ne 'Windows_NT') { throw 'PR193_WINDOWS_POWERSHELL_REQUIRED' }
    if (-not $PrivatePkiDirectory -or -not $CoreValuesPath -or -not $OutputDirectory -or -not $PublicCacheRoot) { throw 'PR193_ARGUMENTS_REQUIRED' }
    if ($ReadbackCommit -ne $script:Pr193ReadbackCommit) { throw 'PR193_READBACK_COMMIT_REFUSED' }
    $phase = 'PATH_VALIDATION'
    foreach ($path in @($PrivatePkiDirectory,$CoreValuesPath,$OutputDirectory,$PublicCacheRoot)) {
        if (-not [IO.Path]::IsPathRooted($path)) { throw 'PR193_ABSOLUTE_PATH_REQUIRED' }
        Assert-Pr193NoReparsePoint $path
    }
    $phase = 'OUTPUT_CHECK'
    $work = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
    if (Test-Path -LiteralPath $work) { throw 'PR193_OUTPUT_EXISTS' }
    $phase = 'PRIVATE_INPUT_METADATA'
    if (-not (Test-Path -LiteralPath $PrivatePkiDirectory -PathType Container) -or
        -not (Test-Path -LiteralPath $CoreValuesPath -PathType Leaf)) { throw 'PR193_EXISTING_PRIVATE_INPUTS_REQUIRED' }
    # The work directory must be outside every Git checkout and outside the reusable public cache.
    $phase = 'OUTPUT_LOCATION'
    $cursor = [IO.Path]::GetDirectoryName($work)
    while ($cursor) {
        if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { throw 'PR193_OUTPUT_INSIDE_REPOSITORY' }
        $cursor = [IO.Path]::GetDirectoryName($cursor.TrimEnd('\'))
    }
    $cacheFull = [IO.Path]::GetFullPath($PublicCacheRoot).TrimEnd('\')
    if (($work + '\').StartsWith($cacheFull + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'PR193_OUTPUT_INSIDE_PUBLIC_CACHE' }
    $phase = 'NODE_DISCOVERY'
    try { $node = @(Get-Command $NodePath -CommandType Application -ErrorAction Stop)[0].Source }
    catch { throw 'PR193_NODE_COMMAND_UNAVAILABLE' }
    $phase = 'GIT_DISCOVERY'
    try { $git = @(Get-Command git.exe -CommandType Application -ErrorAction Stop)[0].Source }
    catch { throw 'PR193_GIT_COMMAND_UNAVAILABLE' }
    $nodeEnvironment = @{ NODE_OPTIONS=$null; NODE_PATH=$null }
    $phase = 'NODE_VERSION_CAPTURE'
    $version = Invoke-Pr193Captured $node @('--version') ([IO.Path]::GetDirectoryName($node)) 30 $nodeEnvironment
    if ($version.ExitCode -ne 0 -or $version.Stdout.Trim() -notmatch '^v24\.[0-9]+\.[0-9]+$') { throw 'PR193_NODE24_REQUIRED' }
    Write-Output 'PR193_PUBLIC_PREPARATION'
    $phase = 'PUBLIC_PREPARATION'
    $public = Initialize-Pr193PublicInputs $PublicCacheRoot $ReadbackCommit $git
    $phase = 'CANONICAL_DEPENDENCIES'
    Initialize-Pr193CanonicalDependencies $node $public.Source $git
    $phase = 'RUNTIME_PIN'
    $candidate = Join-Path $public.Packet 'public-candidate'
    $runtime = Join-Path $candidate 'runtime-values.json'
    if ((Get-Pr193Sha256 $runtime) -ne '46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d') { throw 'PR193_RUNTIME_PIN_REFUSED' }
    # No private material has been read by a child process before this protected-directory boundary.
    $phase = 'PRIVATE_OUTPUT_ACL'
    New-Pr193PrivateDirectory $work
    $stage3 = Join-Path $work 'stage3.json'
    $stageTool = Join-Path $public.Source 'infra/product-preview/first-chat/stage3-deploy.mjs'
    $phase = 'CANONICAL_STAGE3'
    $stage = Invoke-Pr193Captured $node @($stageTool,'stage3-input','--deployment-inputs',(Join-Path $candidate 'deployment-inputs.candidate.json'),
        '--foundation-outputs',(Join-Path $public.Readbacks 'foundation-live.json'),'--latest',(Join-Path $public.Readbacks 'latest.tsv'),'--out',$stage3) $public.Source 120 $nodeEnvironment
    if ($stage.ExitCode -ne 0) { throw 'PR193_CANONICAL_STAGE3_REFUSED' }
    $phase = 'STAGE3_READBACK_JOIN'
    if ((Get-Pr193Sha256 $stage3) -ne (Get-Pr193Sha256 (Join-Path $public.Readbacks 'stage3.observed.json'))) { throw 'PR193_STAGE3_READBACK_JOIN_REFUSED' }
    $rendered = Join-Path $work 'rendered'
    $renderTool = Join-Path $public.Source 'infra/product-preview/first-chat/render-material.mjs'
    $phase = 'CANONICAL_RENDER'
    $render = Invoke-Pr193Captured $node @($renderTool,'--deployment-inputs',(Join-Path $candidate 'deployment-inputs.candidate.json'),
        '--private',$PrivatePkiDirectory,'--core',$CoreValuesPath,'--runtime',$runtime,'--stage3',$stage3,'--out',$rendered) $public.Source 180 $nodeEnvironment
    if ($render.ExitCode -ne 0) { throw 'PR193_CANONICAL_RENDER_REFUSED' }
    $phase = 'PRIVATE_TREE_ACL'
    Assert-Pr193PrivateTreeAcl $work
    $phase = 'SOURCE_RECHECK'
    Assert-Pr193Source $git $public.Source
    $phase = 'RENDER_RECEIPT'
    $roles = @()
    foreach ($role in @('control','temporal-worker','temporal-issuer','model-owner','model-proxy')) {
        $relative = 'rendered/' + $role + '/bundle.json'
        $bundle = Join-Path $work $relative
        $roles += [pscustomobject]@{role=$role;bundleRelativePath=$relative;bytes=(Get-Item -LiteralPath $bundle).Length;sha256=(Get-Pr193Sha256 $bundle)}
    }
    $receipt = [ordered]@{
        schemaVersion=1;sourceCommit=$script:Pr193SourceCommit;packetCommit=$script:Pr193PacketCommit;readbackCommit=$ReadbackCommit
        packetManifestSha256=$script:Pr193PacketManifestSha256;readbackManifestSha256=$script:Pr193ReadbackManifestSha256
        runtimeValuesSha256=(Get-Pr193Sha256 $runtime);deploymentInputsSha256=(Get-Pr193Sha256 (Join-Path $candidate 'deployment-inputs.candidate.json'))
        policySha256=(Get-Pr193Sha256 (Join-Path $candidate 'policy.json'));allocationSha256=(Get-Pr193Sha256 (Join-Path $candidate 'allocation.json'))
        stage3Sha256=(Get-Pr193Sha256 $stage3);summarySha256=(Get-Pr193Sha256 (Join-Path $rendered 'summary.json'));roles=$roles
    }
    Write-Pr193JsonNew (Join-Path $work 'local-render-receipt.json') $receipt
    Assert-Pr193PrivateTreeAcl $work
    Write-Output 'PR193_LOCAL_RENDER_COMPLETE'
    exit 0
} catch {
    $code = $_.Exception.Message
    if ($code -notmatch '^PR193_[A-Z0-9_]+$') { $code = 'PR193_REFUSED_AT_' + $phase }
    Write-Pr193SafeFailure $code
    exit 2
}
