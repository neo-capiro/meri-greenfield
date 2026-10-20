<#
.SYNOPSIS
Neo-only, explicitly approved upload of five locally rendered PR193 bundles.
.DESCRIPTION
Windows PowerShell 5.1+. No rendering, secret-value reads, stage movement or deployment.
Exit 0: all five exact versions verified and local secret-versions.tsv ready for Bind.
Exit 2: refused or uncertain; preserve private state and rerun only with the same inputs.
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$PublicCacheRoot,
    [string]$ReadbackCommit,
    [string]$AwsExecutable,
    [string]$AwsProfile,
    [switch]$NeoApprovedPrivateUpload,
    [switch]$Help
)

$script:Pr193UploadDirectory = $PSScriptRoot
. (Join-Path $PSScriptRoot 'Pr193PublicInputs.ps1')
$script:Pr193UploadPins = @{
    Source = $script:Pr193SourceCommit
    Packet = $script:Pr193PacketCommit
    Readback = $script:Pr193ReadbackCommit
    Manifest = $script:Pr193ReadbackManifestSha256
    Deployment = $script:Pr193DeploymentInputsSha256
    Runtime = $script:Pr193RuntimeValuesSha256
    ApprovedManifest = $script:Pr193ApprovedManifestSha256
    Label = $script:Pr193Label
}
$script:Pr193UploadRoleKeys = [ordered]@{
    control = 'control/material'
    'temporal-worker' = 'worker/material'
    'temporal-issuer' = 'issuer/material'
    'model-owner' = 'owner/material'
    'model-proxy' = 'proxy/material'
}

function Assert-Pr193UploadCondition([bool]$Condition, [string]$Code) {
    if (-not $Condition) { throw $Code }
}

function Read-Pr193UploadJson([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    Assert-Pr193UploadCondition (-not $item.PSIsContainer -and -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $item.Length -gt 0 -and $item.Length -le 1048576) 'UPLOAD_FILE_REFUSED'
    return ([IO.File]::ReadAllText($item.FullName, [Text.UTF8Encoding]::new($false, $true)) | ConvertFrom-Json -ErrorAction Stop)
}

function Write-Pr193UploadJson([string]$Path, $Value, [switch]$CreateOnly) {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 30 -Compress) + "`n")
    $temporary = if ($CreateOnly) { $Path } else { $Path + '.' + [Guid]::NewGuid().ToString('N') + '.pending' }
    $stream = $null
    try {
        $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true); $stream.Dispose(); $stream = $null
        if (-not $CreateOnly) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
        if (-not $CreateOnly -and [IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Invoke-Pr193UploadAws($Context, [string[]]$OperationArguments) {
    $arguments = @('--profile', $Context.AwsProfile, '--region', 'us-east-1', '--no-cli-pager', '--cli-connect-timeout', '10', '--cli-read-timeout', '20') + $OperationArguments + @('--output', 'json')
    $result = Invoke-Pr193Captured -FilePath $Context.AwsExecutable -ArgumentList $arguments -WorkingDirectory $Context.Work -TimeoutSeconds 60 -Environment @{ AWS_MAX_ATTEMPTS = '1'; AWS_RETRY_MODE = 'standard'; AWS_PAGER = ''; AWS_CLI_AUTO_PROMPT = 'off' }
    Assert-Pr193UploadCondition ($result.ExitCode -eq 0 -and $result.Stdout.Length -le 1048576) 'UPLOAD_AWS_OUTCOME_UNCERTAIN'
    return ($result.Stdout | ConvertFrom-Json -ErrorAction Stop)
}

function ConvertTo-Pr193VersionRows($Rows, [switch]$StrictState) {
    $rowsArray = @($Rows)
    Assert-Pr193UploadCondition ($rowsArray.Count -gt 0 -and $rowsArray.Count -le 1000) 'UPLOAD_VERSION_METADATA'
    $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $labels = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $normalized = @()
    foreach ($row in $rowsArray) {
        Assert-Pr193UploadCondition ($null -ne $row -and $row.id -is [string] -and $row.id -cmatch '^[A-Za-z0-9-]{32,64}$' -and $ids.Add($row.id)) 'UPLOAD_VERSION_METADATA'
        if ($StrictState) { Assert-Pr193UploadCondition ($null -ne $row.stages -and $row.stages -is [Array] -and (@($row.PSObject.Properties.Name | Sort-Object) -join ',') -ceq 'id,stages') 'UPLOAD_STATE_BINDING' }
        $stages = @($row.stages | Where-Object { $null -ne $_ })
        Assert-Pr193UploadCondition ($stages.Count -le 20) 'UPLOAD_VERSION_METADATA'
        foreach ($stage in $stages) {
            Assert-Pr193UploadCondition ($stage -is [string] -and $stage.Length -ge 1 -and $stage.Length -le 256 -and $labels.Add($stage)) 'UPLOAD_VERSION_METADATA'
        }
        $normalized += [pscustomobject]@{ id = $row.id; stages = @($stages | Sort-Object -CaseSensitive) }
    }
    return @($normalized | Sort-Object -Property id -CaseSensitive)
}

function ConvertTo-Pr193SecretSnapshot($Description, $Listed, [string]$Arn, [switch]$HistoricalPartialList) {
    Assert-Pr193UploadCondition ($Description.arn -ceq $Arn) 'UPLOAD_SECRET_IDENTITY'
    $rows = @($Listed | Sort-Object -Property id)
    Assert-Pr193UploadCondition ($rows.Count -gt 0 -and $rows.Count -le 1000) 'UPLOAD_VERSION_METADATA'
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $normalized = @()
    foreach ($row in $rows) {
        Assert-Pr193UploadCondition ($row.id -is [string] -and $row.id -cmatch '^[A-Za-z0-9-]{32,64}$' -and $seen.Add($row.id)) 'UPLOAD_VERSION_METADATA'
        $stages = @($row.stages | Where-Object { $null -ne $_ } | Sort-Object -CaseSensitive)
        $properties = @($Description.versions.PSObject.Properties | Where-Object { $_.Name -ceq $row.id })
        # DescribeSecret omits deprecated versions; list --include-deprecated returns them without stages.
        Assert-Pr193UploadCondition ($properties.Count -eq 1 -or ($properties.Count -eq 0 -and $stages.Count -eq 0)) 'UPLOAD_METADATA_CHANGED'
        if ($properties.Count -eq 1) {
            $described = @($properties[0].Value | Where-Object { $null -ne $_ } | Sort-Object -CaseSensitive)
            Assert-Pr193UploadCondition (($stages | ConvertTo-Json -Compress) -ceq ($described | ConvertTo-Json -Compress)) 'UPLOAD_METADATA_CHANGED'
        }
        $normalized += [pscustomobject]@{ id = $row.id; stages = $stages }
    }
    foreach ($property in $Description.versions.PSObject.Properties) {
        if (-not $seen.Contains($property.Name)) {
            Assert-Pr193UploadCondition $HistoricalPartialList.IsPresent 'UPLOAD_METADATA_CHANGED'
            Assert-Pr193UploadCondition ($property.Name -cmatch '^[A-Za-z0-9-]{32,64}$') 'UPLOAD_VERSION_METADATA'
            $normalized += [pscustomobject]@{ id = $property.Name; stages = @($property.Value) }
        }
    }
    $normalized = @(ConvertTo-Pr193VersionRows $normalized)
    $current = @($normalized | Where-Object { $_.stages -ccontains 'AWSCURRENT' })
    Assert-Pr193UploadCondition ($current.Count -eq 1) 'UPLOAD_CURRENT_UNPROVEN'
    return [pscustomobject]@{ arn = $Arn; kms = $Description.kms; current = $current[0].id; versions = $normalized }
}

function Read-Pr193SecretSnapshot($Context, [string]$Arn) {
    $description = Invoke-Pr193UploadAws $Context @('secretsmanager', 'describe-secret', '--secret-id', $Arn, '--query', '{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages}')
    $versions = @(); $next = $null; $pages = 0
    $tokens = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    do {
        $arguments = @('secretsmanager', 'list-secret-version-ids', '--secret-id', $Arn, '--include-deprecated', '--no-paginate', '--max-results', '100', '--query', '{arn:ARN,versions:Versions[].{id:VersionId,stages:VersionStages},nextToken:NextToken}')
        if ($null -ne $next) { $arguments += @('--next-token', $next) }
        $listed = Invoke-Pr193UploadAws $Context $arguments
        Assert-Pr193UploadCondition ($listed.arn -ceq $Arn) 'UPLOAD_SECRET_IDENTITY'
        $versions += @($listed.versions); $pages++
        Assert-Pr193UploadCondition ($versions.Count -le 1000 -and $pages -le 20) 'UPLOAD_METADATA_BOUND'
        $next = $listed.nextToken
        if ($null -ne $next) { Assert-Pr193UploadCondition ($next -is [string] -and $next.Length -gt 0 -and $next.Length -le 4096 -and $tokens.Add($next) -and $pages -lt 20) 'UPLOAD_PAGINATION_REFUSED' }
    } while ($null -ne $next)
    return ConvertTo-Pr193SecretSnapshot $description $versions $Arn
}

function Get-Pr193UploadContext([string]$Work, [string]$Cache, [string]$Readback, [string]$Aws, [string]$Profile) {
    Assert-Pr193UploadCondition ($Readback -ceq $script:Pr193UploadPins.Readback -and $Profile -cmatch '^[A-Za-z0-9_.@-]{1,128}$' -and [IO.Path]::IsPathRooted($Aws) -and [IO.File]::Exists($Aws)) 'UPLOAD_ARGUMENTS'
    $workPath = [IO.Path]::GetFullPath($Work); $cachePath = [IO.Path]::GetFullPath($Cache)
    Assert-Pr193PrivateTreeAcl $workPath
    $packet = Join-Path $cachePath ('packet-' + $script:Pr193UploadPins.Packet)
    $readbacks = Join-Path $cachePath ('readbacks-' + $Readback)
    $manifestPath = Join-Path $readbacks 'FILE-MANIFEST.json'
    Assert-Pr193UploadCondition ((Get-Pr193Sha256 $manifestPath) -ceq $script:Pr193UploadPins.Manifest) 'UPLOAD_READBACK_PIN'
    $manifest = Read-Pr193UploadJson $manifestPath
    foreach ($name in @('secret-label-metadata.json', 'readback-summary.json')) {
        $pin = @($manifest.files | Where-Object { $_.path -ceq $name })
        $file = Join-Path $readbacks $name
        Assert-Pr193UploadCondition ($pin.Count -eq 1 -and (Get-Item -LiteralPath $file).Length -eq $pin[0].bytes -and (Get-Pr193Sha256 $file) -ceq $pin[0].sha256) 'UPLOAD_READBACK_PIN'
    }
    $summary = Read-Pr193UploadJson (Join-Path $readbacks 'readback-summary.json')
    Assert-Pr193UploadCondition ($summary.account -ceq '967807252336' -and $summary.region -ceq 'us-east-1' -and $summary.sourceCommit -ceq $script:Pr193UploadPins.Source -and $summary.proposedLabel -ceq $script:Pr193UploadPins.Label -and $summary.labelAbsentForAllFive -eq $true -and $summary.privateValuesRead -eq $false -and $summary.mutations -eq 0) 'UPLOAD_ROOT_PREFLIGHT'
    $deploymentPath = Join-Path $packet 'public-candidate/deployment-inputs.candidate.json'
    Assert-Pr193UploadCondition ((Get-Pr193Sha256 $deploymentPath) -ceq $script:Pr193UploadPins.Deployment) 'UPLOAD_PUBLIC_PIN'
    $deployment = Read-Pr193UploadJson $deploymentPath
    $receiptPath = Join-Path $workPath 'local-render-receipt.json'
    $receipt = Read-Pr193UploadJson $receiptPath
    $approvedPath = Join-Path $script:Pr193UploadDirectory 'NEO-UPLOAD-MANIFEST.json'
    Assert-Pr193UploadCondition ((Get-Pr193Sha256 $approvedPath) -ceq $script:Pr193UploadPins.ApprovedManifest) 'UPLOAD_APPROVED_MANIFEST_PIN'
    $approved = Read-Pr193UploadJson $approvedPath
    Assert-Pr193UploadCondition ($approved.schemaVersion -eq 1 -and $approved.account -ceq '967807252336' -and $approved.region -ceq 'us-east-1' -and $approved.label -ceq $script:Pr193UploadPins.Label -and @($approved.roles).Count -eq 5) 'UPLOAD_APPROVED_MANIFEST_BINDING'
    foreach ($field in @('sourceCommit','packetCommit','readbackCommit','packetManifestSha256','readbackManifestSha256','runtimeValuesSha256','deploymentInputsSha256','policySha256','allocationSha256','stage3Sha256','summarySha256')) {
        Assert-Pr193UploadCondition ($receipt.$field -ceq $approved.$field) 'UPLOAD_APPROVED_MANIFEST_BINDING'
    }
    Assert-Pr193UploadCondition ($receipt.schemaVersion -eq 1 -and $receipt.sourceCommit -ceq $script:Pr193UploadPins.Source -and $receipt.packetCommit -ceq $script:Pr193UploadPins.Packet -and $receipt.readbackCommit -ceq $Readback -and $receipt.runtimeValuesSha256 -ceq $script:Pr193UploadPins.Runtime -and $receipt.readbackManifestSha256 -ceq $script:Pr193UploadPins.Manifest -and $receipt.deploymentInputsSha256 -ceq $script:Pr193UploadPins.Deployment -and $receipt.packetManifestSha256 -ceq $script:Pr193PacketManifestSha256 -and $receipt.policySha256 -ceq $script:Pr193PolicySha256 -and $receipt.allocationSha256 -ceq $script:Pr193AllocationSha256) 'UPLOAD_RENDER_RECEIPT'
    Assert-Pr193UploadCondition ((Get-Pr193Sha256 (Join-Path $workPath 'stage3.json')) -ceq $receipt.stage3Sha256 -and (Get-Pr193Sha256 (Join-Path $workPath 'rendered/summary.json')) -ceq $receipt.summarySha256) 'UPLOAD_RENDER_CHANGED'
    $rootMetadata = @(Read-Pr193UploadJson (Join-Path $readbacks 'secret-label-metadata.json'))
    Assert-Pr193UploadCondition ($rootMetadata.Count -eq 5 -and @($receipt.roles).Count -eq 5) 'UPLOAD_EXACT_FIVE_ROLES'
    $roles = @()
    foreach ($role in $script:Pr193UploadRoleKeys.Keys) {
        $relative = 'rendered/' + $role + '/bundle.json'
        $row = @($receipt.roles | Where-Object { $_.role -ceq $role })
        $arn = $deployment.secrets.($script:Pr193UploadRoleKeys[$role])
        $rootRow = @($rootMetadata | Where-Object { $_.role -ceq $role })
        $approvedRole = @($approved.roles | Where-Object { $_.role -ceq $role })
        Assert-Pr193UploadCondition ($row.Count -eq 1 -and $approvedRole.Count -eq 1 -and $approvedRole[0].arn -ceq $arn -and $approvedRole[0].bundleRelativePath -ceq $relative -and $approvedRole[0].bytes -eq $row[0].bytes -and $approvedRole[0].sha256 -ceq $row[0].sha256) 'UPLOAD_APPROVED_ROLE_BINDING'
        Assert-Pr193UploadCondition ($row.Count -eq 1 -and $rootRow.Count -eq 1 -and $row[0].bundleRelativePath -ceq $relative -and $rootRow[0].arn -ceq $arn -and $rootRow[0].proposedLabel -ceq $script:Pr193UploadPins.Label -and $rootRow[0].labelPresent -eq $false) 'UPLOAD_ROLE_BINDING'
        $bundle = Join-Path $workPath $relative
        $item = Get-Item -LiteralPath $bundle -Force
        Assert-Pr193UploadCondition (-not $item.PSIsContainer -and -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $item.Length -gt 0 -and $item.Length -le 65536 -and $item.Length -eq $row[0].bytes -and (Get-Pr193Sha256 $bundle) -ceq $row[0].sha256) 'UPLOAD_BUNDLE_CHANGED'
        # The pinned historical list is explicitly partial. DescribeSecret's complete staged map establishes label/current pins.
        $rootSnapshot = ConvertTo-Pr193SecretSnapshot $rootRow[0].metadata @($rootRow[0].listedVersions) $arn -HistoricalPartialList
        Assert-Pr193UploadCondition (@($rootSnapshot.versions | Where-Object { $_.stages -ccontains $script:Pr193UploadPins.Label }).Count -eq 0) 'UPLOAD_LABEL_COLLISION'
        $roles += [pscustomobject]@{ role = $role; arn = $arn; bundleRelativePath = $relative; bytes = $item.Length; sha256 = $row[0].sha256; originalCurrent = $rootSnapshot.current; kms = $rootSnapshot.kms }
    }
    return [pscustomobject]@{ Work = $workPath; AwsExecutable = $Aws; AwsProfile = $Profile; ReadbackCommit = $Readback; ReceiptSha256 = Get-Pr193Sha256 $receiptPath; ApprovedManifestSha256 = $script:Pr193UploadPins.ApprovedManifest; Roles = $roles }
}

function Assert-Pr193UploadSnapshot($Snapshot, $Role, $StateRole) {
    Assert-Pr193UploadCondition ($Snapshot.arn -ceq $Role.arn -and $Snapshot.current -ceq $Role.originalCurrent -and $Snapshot.kms -ceq $Role.kms) 'UPLOAD_CURRENT_OR_KEY_CHANGED'
    $labelled = @($Snapshot.versions | Where-Object { $_.stages -ccontains $script:Pr193UploadPins.Label })
    if ($null -eq $StateRole) {
        Assert-Pr193UploadCondition ($labelled.Count -eq 0) 'UPLOAD_LABEL_COLLISION'
        Assert-Pr193UploadCondition (@($Snapshot.versions).Count -lt 100) 'UPLOAD_VERSION_CAPACITY_REFUSED'
        return $false
    }
    foreach ($original in $StateRole.originalVersions) {
        $observed = @($Snapshot.versions | Where-Object { $_.id -ceq $original.id })
        Assert-Pr193UploadCondition ($observed.Count -eq 1 -and (ConvertTo-Json -InputObject @($observed[0].stages) -Compress) -ceq (ConvertTo-Json -InputObject @($original.stages) -Compress)) 'UPLOAD_ORIGINAL_VERSION_CHANGED'
    }
    $originalIds = @($StateRole.originalVersions | ForEach-Object { $_.id })
    Assert-Pr193UploadCondition (@($Snapshot.versions | Where-Object { $originalIds -cnotcontains $_.id -and $_.id -cne $StateRole.token }).Count -eq 0) 'UPLOAD_UNEXPECTED_VERSION'
    Assert-Pr193UploadCondition ($labelled.Count -le 1 -and ($labelled.Count -eq 0 -or $labelled[0].id -ceq $StateRole.token)) 'UPLOAD_LABEL_COLLISION'
    $tokenRows = @($Snapshot.versions | Where-Object { $_.id -ceq $StateRole.token })
    if ($tokenRows.Count -eq 1) {
        Assert-Pr193UploadCondition ($labelled.Count -eq 1 -and @($tokenRows[0].stages).Count -eq 1 -and $tokenRows[0].stages[0] -ceq $script:Pr193UploadPins.Label) 'UPLOAD_TOKEN_STAGE_UNCERTAIN'
        return $true
    }
    Assert-Pr193UploadCondition ($StateRole.status -cne 'COMPLETE') 'UPLOAD_COMPLETED_VERSION_MISSING'
    Assert-Pr193UploadCondition (@($Snapshot.versions).Count -lt 100) 'UPLOAD_VERSION_CAPACITY_REFUSED'
    return $false
}

function Invoke-Pr193UploadWorkflow($Context) {
    $lock = $null
    try {
        $lock = [IO.File]::Open((Join-Path $Context.Work 'upload.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $caller = Invoke-Pr193UploadAws $Context @('sts', 'get-caller-identity', '--query', '{account:Account}')
        Assert-Pr193UploadCondition ($caller.account -ceq '967807252336') 'UPLOAD_ACCOUNT_REFUSED'
        $statePath = Join-Path $Context.Work 'upload-state.json'
        if ([IO.File]::Exists($statePath)) {
            $state = Read-Pr193UploadJson $statePath
            Assert-Pr193UploadCondition ($state.approvedManifestSha256 -ceq $Context.ApprovedManifestSha256) 'UPLOAD_STATE_BINDING'
            Assert-Pr193UploadCondition ($state.schemaVersion -eq 1 -and $state.label -ceq $script:Pr193UploadPins.Label -and $state.sourceCommit -ceq $script:Pr193UploadPins.Source -and $state.packetCommit -ceq $script:Pr193UploadPins.Packet -and $state.readbackCommit -ceq $Context.ReadbackCommit -and $state.renderReceiptSha256 -ceq $Context.ReceiptSha256 -and @($state.roles).Count -eq 5) 'UPLOAD_STATE_BINDING'
            foreach ($role in $Context.Roles) {
                $saved = @($state.roles | Where-Object { $_.role -ceq $role.role })
                Assert-Pr193UploadCondition ($saved.Count -eq 1) 'UPLOAD_STATE_BINDING'
                foreach ($field in @('arn','bundleRelativePath','bytes','sha256','originalCurrent','kms')) { Assert-Pr193UploadCondition ($saved[0].$field -ceq $role.$field) 'UPLOAD_STATE_BINDING' }
                Assert-Pr193UploadCondition ($saved[0].token -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' -and @('PENDING','SUBMITTING','COMPLETE') -ccontains $saved[0].status) 'UPLOAD_STATE_BINDING'
            }
            foreach ($role in $Context.Roles) {
                $saved = @($state.roles | Where-Object { $_.role -ceq $role.role })[0]
                Assert-Pr193UploadCondition ($null -ne $saved.originalVersions -and $saved.originalVersions -is [Array] -and @($saved.originalVersions).Count -lt 100) 'UPLOAD_STATE_BINDING'
                $original = @(ConvertTo-Pr193VersionRows $saved.originalVersions -StrictState)
                $originalCurrent = @($original | Where-Object { $_.stages -ccontains 'AWSCURRENT' })
                Assert-Pr193UploadCondition ($originalCurrent.Count -eq 1 -and $originalCurrent[0].id -ceq $role.originalCurrent -and @($original | Where-Object { $_.id -ceq $saved.token -or $_.stages -ccontains $script:Pr193UploadPins.Label }).Count -eq 0 -and (ConvertTo-Json -InputObject @($saved.originalVersions) -Depth 5 -Compress) -ceq (ConvertTo-Json -InputObject $original -Depth 5 -Compress)) 'UPLOAD_STATE_BINDING'
            }
            Assert-Pr193UploadCondition (@($state.roles.token | Select-Object -Unique).Count -eq 5) 'UPLOAD_TOKEN_COLLISION'
        } else {
            $initial = @{}
            foreach ($role in $Context.Roles) {
                $snapshot = Read-Pr193SecretSnapshot $Context $role.arn
                $null = Assert-Pr193UploadSnapshot $snapshot $role $null
                $initial[$role.role] = @($snapshot.versions)
            }
            $stateRoles = @($Context.Roles | ForEach-Object { [ordered]@{ role = $_.role; arn = $_.arn; bundleRelativePath = $_.bundleRelativePath; bytes = $_.bytes; sha256 = $_.sha256; originalCurrent = $_.originalCurrent; kms = $_.kms; originalVersions = $initial[$_.role]; token = [Guid]::NewGuid().ToString(); status = 'PENDING'; versionId = $null } })
            $state = [ordered]@{ schemaVersion = 1; label = $script:Pr193UploadPins.Label; sourceCommit = $script:Pr193UploadPins.Source; packetCommit = $script:Pr193UploadPins.Packet; readbackCommit = $Context.ReadbackCommit; renderReceiptSha256 = $Context.ReceiptSha256; approvedManifestSha256 = $Context.ApprovedManifestSha256; roles = $stateRoles }
            Write-Pr193UploadJson $statePath $state -CreateOnly
            $state = Read-Pr193UploadJson $statePath
        }
        foreach ($role in $Context.Roles) {
            $saved = @($state.roles | Where-Object { $_.role -ceq $role.role })[0]
            $alreadyPresent = Assert-Pr193UploadSnapshot (Read-Pr193SecretSnapshot $Context $role.arn) $role $saved
            if (-not $alreadyPresent) {
                $bundlePath = Join-Path $Context.Work $role.bundleRelativePath
                $bundleLock = [IO.File]::Open($bundlePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
                try {
                    Assert-Pr193UploadCondition ($bundleLock.Length -eq $role.bytes -and (Get-Pr193Sha256 $bundlePath) -ceq $role.sha256) 'UPLOAD_BUNDLE_CHANGED'
                    $saved.status = 'SUBMITTING'; Write-Pr193UploadJson $statePath $state
                    $put = Invoke-Pr193UploadAws $Context @('secretsmanager', 'put-secret-value', '--secret-id', $role.arn, '--client-request-token', $saved.token, '--version-stages', $script:Pr193UploadPins.Label, '--secret-string', ('file://' + $bundlePath), '--query', '{arn:ARN,versionId:VersionId,stages:VersionStages}')
                    Assert-Pr193UploadCondition ($put.arn -ceq $role.arn -and $put.versionId -ceq $saved.token -and @($put.stages).Count -eq 1 -and $put.stages[0] -ceq $script:Pr193UploadPins.Label) 'UPLOAD_PUT_OUTCOME_UNCERTAIN'
                } finally { $bundleLock.Dispose() }
                Assert-Pr193UploadCondition (Assert-Pr193UploadSnapshot (Read-Pr193SecretSnapshot $Context $role.arn) $role $saved) 'UPLOAD_POSTCHECK_UNCERTAIN'
            }
            $saved.versionId = $saved.token; $saved.status = 'COMPLETE'; Write-Pr193UploadJson $statePath $state
        }
        foreach ($role in $Context.Roles) {
            $saved = @($state.roles | Where-Object { $_.role -ceq $role.role })[0]
            Assert-Pr193UploadCondition (Assert-Pr193UploadSnapshot (Read-Pr193SecretSnapshot $Context $role.arn) $role $saved) 'UPLOAD_FINAL_POSTCHECK'
        }
        $tsv = (@($state.roles | ForEach-Object { $_.role + "`t" + $_.versionId }) -join "`n") + "`n"
        $tsvPath = Join-Path $Context.Work 'secret-versions.tsv'
        if ([IO.File]::Exists($tsvPath)) { Assert-Pr193UploadCondition ([IO.File]::ReadAllText($tsvPath) -ceq $tsv) 'UPLOAD_VERSION_FILE_CHANGED' }
        else {
            $stream = [IO.File]::Open($tsvPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes($tsv); $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        }
        $receipt = [ordered]@{
            schemaVersion = 1; status = 'PR193_PRIVATE_UPLOAD_VERIFIED'; sourceCommit = $script:Pr193UploadPins.Source
            packetCommit = $script:Pr193UploadPins.Packet; readbackCommit = $Context.ReadbackCommit
            renderReceiptSha256 = $Context.ReceiptSha256; stateSha256 = Get-Pr193Sha256 $statePath
            approvedManifestSha256 = $Context.ApprovedManifestSha256
            secretVersionsSha256 = Get-Pr193Sha256 $tsvPath; label = $script:Pr193UploadPins.Label
            roles = @($state.roles | ForEach-Object { [ordered]@{ role = $_.role; arn = $_.arn; versionId = $_.versionId; sha256 = $_.sha256; bytes = $_.bytes } })
        }
        $receiptPath = Join-Path $Context.Work 'upload-receipt.json'
        if ([IO.File]::Exists($receiptPath)) {
            $prior = Read-Pr193UploadJson $receiptPath
            Assert-Pr193UploadCondition (($prior | ConvertTo-Json -Depth 30 -Compress) -ceq ($receipt | ConvertTo-Json -Depth 30 -Compress)) 'UPLOAD_RECEIPT_CHANGED'
        } else { Write-Pr193UploadJson $receiptPath $receipt -CreateOnly }
        return 'PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY'
    } finally { if ($null -ne $lock) { $lock.Dispose() } }
}

function Invoke-Pr193PrivateUploadMain {
    param([string]$OutputDirectory,[string]$PublicCacheRoot,[string]$ReadbackCommit,[string]$AwsExecutable,[string]$AwsProfile,[switch]$NeoApprovedPrivateUpload)
    try { Assert-Pr193ReleasePinsReady -ForUpload } catch { throw 'UPLOAD_RELEASE_PINS_PENDING' }
    Assert-Pr193UploadCondition $NeoApprovedPrivateUpload.IsPresent 'UPLOAD_NEO_APPROVAL_REQUIRED'
    $ErrorActionPreference = 'Stop'
    Assert-Pr193UploadCondition ($PSVersionTable.PSVersion.Major -ge 5 -and [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) 'UPLOAD_WINDOWS_REQUIRED'
    foreach ($value in @($OutputDirectory,$PublicCacheRoot,$ReadbackCommit,$AwsExecutable,$AwsProfile)) { Assert-Pr193UploadCondition (-not [string]::IsNullOrWhiteSpace($value)) 'UPLOAD_ARGUMENTS' }
    . (Join-Path $script:Pr193UploadDirectory 'Pr193Common.ps1')
    $context = Get-Pr193UploadContext $OutputDirectory $PublicCacheRoot $ReadbackCommit $AwsExecutable $AwsProfile
    return Invoke-Pr193UploadWorkflow $context
}

if ($MyInvocation.InvocationName -ne '.') {
    if ($Help) {
        [Console]::WriteLine('Invoke-Pr193PrivateUpload.ps1 -OutputDirectory <private work directory> -PublicCacheRoot <public cache> -ReadbackCommit <reviewed exact successor pin> -AwsExecutable <absolute aws.exe> -AwsProfile <Neo existing profile> -NeoApprovedPrivateUpload')
        [Console]::WriteLine('Exit 0: five versions verified; run Invoke-Pr193LocalBindings.ps1. Exit 2: refused/uncertain; keep state and the same bytes/tokens. No deployment.')
        exit 0
    }
    try {
        $result = Invoke-Pr193PrivateUploadMain @PSBoundParameters
        [Console]::WriteLine($result); exit 0
    } catch {
        $code = if ($_.Exception.Message -cmatch '^UPLOAD_[A-Z_]+$') { $_.Exception.Message } else { 'UPLOAD_REFUSED_OR_UNCERTAIN' }
        [Console]::Error.WriteLine('PR193_PRIVATE_UPLOAD_REFUSED: ' + $code); exit 2
    }
}
