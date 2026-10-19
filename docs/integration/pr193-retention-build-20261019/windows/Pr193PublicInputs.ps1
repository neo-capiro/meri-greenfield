# Fixed public pins and Git preparation; dot-sourcing performs no IO.
$script:Pr193SourceCommit = '5b395d4ce9218b872b21c420dc00a3af31739824'
$script:Pr193PacketCommit = 'b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527'
$script:Pr193ReadbackCommit = '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f'
$script:Pr193PacketManifestSha256 = '2c7b60d898ce4356348d510e203ee69d5969f00176b03add3dd43d3b6c9d51f2'
$script:Pr193ReadbackManifestSha256 = 'adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613'
$script:Pr193EvidencePath = 'docs/integration/pr193-retention-build-20261019'
$script:Pr193Repository = 'https://github.com/neo-capiro/meri-greenfield.git'

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
    $probeCode = 'import {pathToFileURL} from "node:url";try{await import(pathToFileURL(process.argv[1]).href);await import(pathToFileURL(process.argv[2]).href)}catch(e){if(e.code==="ERR_MODULE_NOT_FOUND")process.stdout.write(String(e.message));process.exit(1)}'
    $modules = @((Join-Path $Source 'infra/product-preview/first-chat/render-material.mjs'), (Join-Path $Source 'infra/product-preview/first-chat/stage3-deploy.mjs'))
    $installed = @{}
    for ($attempt=0; $attempt -lt 5; $attempt++) {
        $probe = Invoke-Pr193Captured $Node (@('--input-type=module','--eval',$probeCode) + $modules) $Source 120 $nodeEnvironment
        if ($probe.ExitCode -eq 0) { Assert-Pr193Source $Git $Source; return }
        # The missing import's source file selects only these existing lockfile owners.
        $owner = $null
        foreach ($prefix in @('apps/worker/conversation','apps/control/conversations','apps/runtime','packages/contracts')) {
            if ($probe.Stdout.Replace('\','/').Contains('/' + $prefix + '/')) { $owner = $prefix; break }
        }
        if ($owner -eq 'packages/contracts') { $owner = '.' }
        if ($null -eq $owner -or $installed.ContainsKey($owner)) { throw 'PR193_CANONICAL_DEPENDENCIES_REFUSED' }
        $prefixPath = Join-Path $Source $owner
        if (-not (Test-Path -LiteralPath (Join-Path $prefixPath 'package-lock.json'))) { throw 'PR193_LOCKFILE_REQUIRED' }
        $npmCli = Join-Path ([IO.Path]::GetDirectoryName($Node)) 'node_modules/npm/bin/npm-cli.js'
        if (-not (Test-Path -LiteralPath $npmCli -PathType Leaf)) { throw 'PR193_NPM_CLI_REQUIRED' }
        $install = Invoke-Pr193Captured $Node @($npmCli,'ci','--prefix',$prefixPath,'--ignore-scripts','--no-audit','--no-fund','--loglevel=error','--progress=false') $Source 600 $nodeEnvironment
        if ($install.ExitCode -ne 0) { throw 'PR193_LOCKED_INSTALL_REFUSED' }
        $installed[$owner] = $true
    }
    throw 'PR193_CANONICAL_DEPENDENCIES_REFUSED'
}
