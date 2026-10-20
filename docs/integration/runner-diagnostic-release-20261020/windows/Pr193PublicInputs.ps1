# Fixed successor pins; dot-sourcing defines data/functions only. No IO or execution.
$script:Pr193ReleasePinStatus = 'READY'
$script:Pr193UploadPinStatus = 'PENDING'
$script:Pr193SourceCommit = '2b4421f612f9fbb728d6da52927aac228d712d40'
$script:Pr193PacketCommit = '86983726ebf532955631578c07b080da1fcf2500'
$script:Pr193ReadbackCommit = '334f68728f23669d121d309b69b45a5bfc77b24b'
$script:Pr193PacketManifestSha256 = 'ebae569fdec329602ad068641f4c33599fb001f2eab9b1c1e613f88b801dfeec'
$script:Pr193ReadbackManifestSha256 = '4eeb505b63f1f6ab2756d2f694bcb446f6748124cc70b159d277337ea77e8233'
$script:Pr193RuntimeValuesSha256 = '46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d'
$script:Pr193DeploymentInputsSha256 = '4c7f8adfafc6eb3ed7b9e65b8a0ee7d940a40269f903f7127b30111b68869a54'
$script:Pr193ImageUri = '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:f5a7abc9940ef8f5092bbfa9db9c3345874d448de2d7d7712645f8aad9db5ff7'
$script:Pr193ApprovedManifestSha256 = $null
$script:Pr193PolicySha256 = 'e338c50e1f3f4eede1943466024b6eff36e9a85a527339b4c9dbe752e65d88fe'
$script:Pr193AllocationSha256 = '8caf70039edab43b1f5665c8555ef3189aa546da1fbf722c5563a82ff0788195'
$script:Pr193Label = 'FIRST_CHAT_20261020E'
$script:Pr193EvidencePath = 'docs/integration/runner-diagnostic-release-20261020'
$script:Pr193Repository = 'https://github.com/neo-capiro/meri-greenfield.git'

function Assert-Pr193ReleasePinsReady {
    param([switch]$ForUpload)
    if ($script:Pr193ReleasePinStatus -cne 'READY') { throw 'PR193_RELEASE_PINS_PENDING' }
    foreach ($pin in @($script:Pr193SourceCommit,$script:Pr193PacketCommit,$script:Pr193ReadbackCommit)) {
        if ($pin -cnotmatch '^[a-f0-9]{40}$') { throw 'PR193_RELEASE_PINS_PENDING' }
    }
    foreach ($pin in @($script:Pr193PacketManifestSha256,$script:Pr193ReadbackManifestSha256,
        $script:Pr193RuntimeValuesSha256,$script:Pr193DeploymentInputsSha256,$script:Pr193PolicySha256,$script:Pr193AllocationSha256)) {
        if ($pin -cnotmatch '^[a-f0-9]{64}$') { throw 'PR193_RELEASE_PINS_PENDING' }
    }
    if ($script:Pr193ImageUri -cnotmatch '^967807252336[.]dkr[.]ecr[.]us-east-1[.]amazonaws[.]com/meri-greenfield/qualification-worker@sha256:[a-f0-9]{64}$' -or
        $script:Pr193Label -cne 'FIRST_CHAT_20261020E') { throw 'PR193_RELEASE_PINS_PENDING' }
    if ($ForUpload -and ($script:Pr193UploadPinStatus -cne 'READY' -or $script:Pr193ApprovedManifestSha256 -cnotmatch '^[a-f0-9]{64}$')) {
        throw 'PR193_UPLOAD_PINS_PENDING'
    }
}

function Invoke-Pr193Git {
    param([string]$Git, [string]$Directory, [string[]]$Arguments, [AllowNull()][string]$InputText = $null)
    $result = Invoke-Pr193Captured -FilePath $Git -WorkingDirectory $Directory -TimeoutSeconds 600 `
        -ArgumentList (@('-c','core.autocrlf=false','-c','core.longpaths=true','-c','core.quotepath=false') + $Arguments) `
        -Environment @{ GIT_TERMINAL_PROMPT='0'; GIT_NO_LAZY_FETCH='1' } -StandardInput $InputText
    if ($result.ExitCode -ne 0) { throw 'PR193_GIT_REFUSED' }
    return $result.Stdout
}

function Assert-Pr193RelativePublicPath {
    param([string]$Path)
    if (-not $Path -or $Path -match '[\\:\x00-\x1f<>"|?*]' -or $Path.StartsWith('/') -or
        @($Path.Split('/') | Where-Object { -not $_ -or $_ -eq '.' -or $_ -eq '..' -or $_ -match '[. ]$' }).Count) {
        throw 'PR193_PUBLIC_PATH_REFUSED'
    }
}

function Assert-Pr193PublicManifest {
    param([string]$Directory, [string]$ManifestName, [string]$ExpectedSha256)
    Assert-Pr193NoReparsePoint $Directory
    $manifestPath = Join-Path $Directory $ManifestName
    if ((Get-Pr193Sha256 $manifestPath) -ne $ExpectedSha256) { throw 'PR193_MANIFEST_HASH_REFUSED' }
    $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or -not $manifest.files -or $manifest.files.Count -gt 1000) { throw 'PR193_MANIFEST_SHAPE_REFUSED' }
    $seen = @{}
    foreach ($entry in $manifest.files) {
        Assert-Pr193RelativePublicPath $entry.path
        if ($seen.ContainsKey($entry.path) -or $entry.path -eq $ManifestName -or $entry.sha256 -notmatch '^[a-f0-9]{64}$' -or
            $entry.bytes -lt 0 -or $entry.bytes -gt 10485760) { throw 'PR193_MANIFEST_ENTRY_REFUSED' }
        $seen[$entry.path] = $true
        $path = Join-Path $Directory $entry.path
        Assert-Pr193NoReparsePoint $path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -ne $entry.bytes -or
            (Get-Pr193Sha256 $path) -ne $entry.sha256) { throw 'PR193_PUBLIC_FILE_HASH_REFUSED' }
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $Directory -Recurse -File -Force)) {
        $relative = $file.FullName.Substring($Directory.TrimEnd('\').Length + 1).Replace('\','/')
        if ($relative -ne $ManifestName -and -not $seen.ContainsKey($relative)) { throw 'PR193_UNLISTED_PUBLIC_FILE' }
    }
    return $manifest
}

function Export-Pr193GitDirectory {
    param([string]$Git, [string]$Repository, [string]$Commit, [string]$TreePath, [string]$Destination)
    if (Test-Path -LiteralPath $Destination) { return }
    $archive = $Destination + '.' + [Guid]::NewGuid().ToString('N') + '.zip'
    $null = Invoke-Pr193Git $Git $Repository @('archive','--format=zip',('--output=' + $archive),($Commit + ':' + $TreePath))
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        try {
            [IO.Directory]::CreateDirectory($Destination) | Out-Null
            $seen = @{}; $total = 0L
            foreach ($entry in $zip.Entries) {
                $name = $entry.FullName.TrimEnd('/')
                Assert-Pr193RelativePublicPath $name
                if ($seen.ContainsKey($name)) { throw 'PR193_ARCHIVE_DUPLICATE' }
                $seen[$name] = $true; $total += $entry.Length
                if ($entry.Length -gt 10485760 -or $total -gt 52428800) { throw 'PR193_ARCHIVE_SIZE_REFUSED' }
                $target = Join-Path $Destination $name
                if ($entry.FullName.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
                $inputStream = $entry.Open()
                $outputStream = [IO.File]::Open($target, [IO.FileMode]::CreateNew)
                try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
            }
        } finally { $zip.Dispose() }
    } finally { if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force } }
}

function Assert-Pr193Source {
    param([string]$Git, [string]$Directory)
    if ((Invoke-Pr193Git $Git $Directory @('rev-parse','HEAD')).Trim() -ne $script:Pr193SourceCommit) { throw 'PR193_SOURCE_COMMIT_REFUSED' }
    $null = Invoke-Pr193Git $Git $Directory @('diff','--exit-code','--no-ext-diff','HEAD','--')
    $tree = Invoke-Pr193Git $Git $Directory @('ls-tree','-r','--full-tree','--format=%(objectmode) %(objectname) %(path)','HEAD')
    $paths = New-Object 'System.Collections.Generic.List[string]'
    $expected = New-Object 'System.Collections.Generic.List[string]'
    foreach ($line in $tree.TrimEnd("`r","`n").Split("`n")) {
        if ($line.TrimEnd("`r") -notmatch '^(100644|100755) ([a-f0-9]{40}) (.+)$') { throw 'PR193_SOURCE_TREE_REFUSED' }
        $path = $Matches[3]
        if ($path -match '["\r\n\\]' -or $path.StartsWith('/') -or $path.Split('/') -contains '..') { throw 'PR193_SOURCE_PATH_REFUSED' }
        $paths.Add('"' + $path + '"'); $expected.Add($Matches[2])
    }
    $actualText = Invoke-Pr193Git $Git $Directory @('hash-object','--no-filters','--stdin-paths') (($paths -join "`n") + "`n")
    $actual = @($actualText.TrimEnd("`r","`n").Split("`n") | ForEach-Object { $_.TrimEnd("`r") })
    if ($actual.Count -ne $expected.Count) { throw 'PR193_SOURCE_RAW_BYTES_REFUSED' }
    for ($i=0; $i -lt $expected.Count; $i++) { if ($actual[$i] -ne $expected[$i]) { throw 'PR193_SOURCE_RAW_BYTES_REFUSED' } }
}

function Initialize-Pr193PublicInputs {
    param([string]$PublicCacheRoot, [string]$ReadbackCommit, [string]$Git)
    Assert-Pr193ReleasePinsReady
    if ($ReadbackCommit -ne $script:Pr193ReadbackCommit) { throw 'PR193_READBACK_COMMIT_REFUSED' }
    $cache = [IO.Path]::GetFullPath($PublicCacheRoot)
    Assert-Pr193NoReparsePoint $cache
    [IO.Directory]::CreateDirectory($cache) | Out-Null
    $source = Join-Path $cache ('source-' + $script:Pr193SourceCommit)
    if (-not (Test-Path -LiteralPath $source)) {
        [IO.Directory]::CreateDirectory($source) | Out-Null
        $null = Invoke-Pr193Git $Git $source @('init')
        $null = Invoke-Pr193Git $Git $source @('config','core.autocrlf','false')
        $null = Invoke-Pr193Git $Git $source @('config','core.longpaths','true')
        $null = Invoke-Pr193Git $Git $source @('remote','add','origin',$script:Pr193Repository)
        $null = Invoke-Pr193Git $Git $source @('fetch','--depth=1','origin',$script:Pr193SourceCommit)
        $null = Invoke-Pr193Git $Git $source @('checkout','--detach',$script:Pr193SourceCommit)
    }
    Assert-Pr193NoReparsePoint $source
    if ((Invoke-Pr193Git $Git $source @('remote','get-url','origin')).Trim() -ne $script:Pr193Repository) { throw 'PR193_GIT_ORIGIN_REFUSED' }
    Assert-Pr193Source $Git $source
    foreach ($commit in @($script:Pr193PacketCommit, $ReadbackCommit)) {
        $probe = Invoke-Pr193Captured $Git @('cat-file','-e',($commit + '^{commit}')) $source
        if ($probe.ExitCode -ne 0) { $null = Invoke-Pr193Git $Git $source @('fetch','--depth=1','origin',$commit) }
        if ((Invoke-Pr193Git $Git $source @('rev-parse',($commit + '^{commit}'))).Trim() -ne $commit) { throw 'PR193_GIT_COMMIT_REFUSED' }
    }
    $packet = Join-Path $cache ('packet-' + $script:Pr193PacketCommit)
    $readbacks = Join-Path $cache ('readbacks-' + $ReadbackCommit)
    Export-Pr193GitDirectory $Git $source $script:Pr193PacketCommit $script:Pr193EvidencePath $packet
    Export-Pr193GitDirectory $Git $source $ReadbackCommit ($script:Pr193EvidencePath + '/windows-readbacks') $readbacks
    $null = Assert-Pr193PublicManifest $packet 'PUBLIC-FILE-MANIFEST.json' $script:Pr193PacketManifestSha256
    $null = Assert-Pr193PublicManifest $readbacks 'FILE-MANIFEST.json' $script:Pr193ReadbackManifestSha256
    return [pscustomobject]@{ Source=$source; Packet=$packet; Readbacks=$readbacks; Cache=$cache }
}

function Initialize-Pr193CanonicalDependencies {
    param([string]$Node, [string]$Source, [string]$Git)
    $nodeEnvironment = @{ NODE_OPTIONS=$null; NODE_PATH=$null }
    $probePath = Join-Path $PSScriptRoot 'Pr193DependencyProbe.mjs'
    $owners = @{ ROOT='.'; RUNTIME='apps/runtime'; CONVERSATION='apps/worker/conversation';
        CONTROL_CONVERSATIONS='apps/control/conversations'; QUALIFICATION='apps/worker/qualification'; ARTIFACT_STORAGE='apps/artifacts/storage' }
    $reasons = @('NATIVE_IMPORT_FAILURE','PACKAGE_EXPORTS_REFUSED','IMPORT_SYNTAX_REFUSED','IMPORT_OTHER_REFUSED',
        'MISSING_PACKAGE_UNATTRIBUTED','IMPORTER_UNVERIFIED','IMPORTER_OUTSIDE_SOURCE','OWNER_PATH_UNVERIFIED',
        'OWNER_LOCK_UNVERIFIED','TRANSITIVE_PACKAGE_UNDECLARED','TRANSITIVE_OWNER_UNMAPPED','MISSING_OWNER_UNMAPPED',
        'PROBE_ARGUMENTS_REFUSED','PROBE_INTERNAL_REFUSED')
    $installed = @{}
    for ($attempt=0; $attempt -le $owners.Count; $attempt++) {
        $probe = Invoke-Pr193Captured $Node @($probePath,'--source',$Source) $Source 120 $nodeEnvironment
        if ($probe.Stdout.Length -gt 2048) { throw 'PR193_DEPENDENCY_DIAGNOSTIC_REFUSED' }
        try { $diagnostic = $probe.Stdout | ConvertFrom-Json -ErrorAction Stop } catch { throw 'PR193_DEPENDENCY_DIAGNOSTIC_REFUSED' }
        $keys = @($diagnostic.PSObject.Properties.Name | Sort-Object) -join ','
        if ($diagnostic.schemaVersion -ne 1) { throw 'PR193_DEPENDENCY_DIAGNOSTIC_REFUSED' }
        if ($probe.ExitCode -eq 0 -and $diagnostic.status -eq 'READY' -and $keys -eq 'schemaVersion,status') {
            Assert-Pr193Source $Git $Source; return
        }
        if ($probe.ExitCode -eq 1 -and $diagnostic.status -eq 'REFUSED' -and $keys -eq 'reason,schemaVersion,status' -and $reasons -contains $diagnostic.reason) {
            throw ('PR193_DEPENDENCY_' + $diagnostic.reason)
        }
        if ($probe.ExitCode -ne 1 -or $diagnostic.status -ne 'MISSING' -or $keys -ne 'category,owner,package,schemaVersion,status' -or
            @('ESM_MODULE_MISSING','CJS_MODULE_MISSING') -notcontains $diagnostic.category -or
            -not $owners.ContainsKey([string]$diagnostic.owner) -or $diagnostic.package -notmatch '^(?:@[a-z0-9._-]+/)?[a-z0-9._-]+$') {
            throw 'PR193_DEPENDENCY_DIAGNOSTIC_REFUSED'
        }
        $owner = [string]$diagnostic.owner
        if ($installed.ContainsKey($owner)) { throw ('PR193_DEPENDENCY_STILL_MISSING_' + $owner) }
        $prefixPath = Join-Path $Source $owners[$owner]
        if (-not (Test-Path -LiteralPath (Join-Path $prefixPath 'package-lock.json'))) { throw 'PR193_LOCKFILE_REQUIRED' }
        $npmCli = Join-Path ([IO.Path]::GetDirectoryName($Node)) 'node_modules/npm/bin/npm-cli.js'
        if (-not (Test-Path -LiteralPath $npmCli -PathType Leaf)) { throw 'PR193_NPM_CLI_REQUIRED' }
        Write-Output ('PR193_DEPENDENCY_INSTALL_' + $owner)
        $install = Invoke-Pr193Captured $Node @($npmCli,'ci','--prefix',$prefixPath,'--ignore-scripts','--no-audit','--no-fund','--loglevel=error','--progress=false') $Source 600 $nodeEnvironment
        if ($install.ExitCode -ne 0) { throw ('PR193_DEPENDENCY_INSTALL_FAILED_' + $owner) }
        $installed[$owner] = $true
    }
    throw 'PR193_DEPENDENCY_ATTEMPT_LIMIT'
}
