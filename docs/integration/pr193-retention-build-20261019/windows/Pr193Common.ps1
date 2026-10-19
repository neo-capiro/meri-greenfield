# Shared Windows-only process, byte-hash and private-output boundaries. Dot-sourcing performs no IO.
function Write-Pr193SafeFailure {
    param([string]$Code = 'PR193_REFUSED')
    if ($Code -notmatch '^PR193_[A-Z0-9_]+$') { $Code = 'PR193_REFUSED' }
    [Console]::Error.WriteLine($Code)
}

function Get-Pr193Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
}

function ConvertTo-Pr193WindowsArgument {
    param([AllowEmptyString()][string]$Value)
    # CommandLineToArgvW / CRT quoting: double backslashes before quotes and the closing quote.
    if ($Value.IndexOf([char]0) -ge 0) { throw 'PR193_ARGUMENT_REFUSED' }
    return '"' + ([regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1')) + '"'
}

function Invoke-Pr193Captured {
    param([string]$FilePath, [string[]]$ArgumentList = @(), [string]$WorkingDirectory,
          [int]$TimeoutSeconds = 120, [hashtable]$Environment = @{},
          [AllowNull()][string]$StandardInput = $null)
    if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 900) { throw 'PR193_TIMEOUT_ARGUMENT' }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $FilePath
    $info.Arguments = (($ArgumentList | ForEach-Object { ConvertTo-Pr193WindowsArgument ([string]$_) }) -join ' ')
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $info.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
    foreach ($key in $Environment.Keys) {
        if ($null -eq $Environment[$key]) { $info.EnvironmentVariables.Remove($key) }
        else { $info.EnvironmentVariables[$key] = [string]$Environment[$key] }
    }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    $started = $false
    try {
        if (-not $process.Start()) { throw 'PR193_PROCESS_START_REFUSED' }
        $started = $true
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if ($null -ne $StandardInput) { $process.StandardInput.Write($StandardInput) }
        $process.StandardInput.Close()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            # This is the one process tree owned by this call; never target a process name.
            & "$env:SystemRoot\System32\taskkill.exe" /PID ([string]$process.Id) /T /F 2>&1 | Out-Null
            if (-not $process.WaitForExit(10000)) { throw 'PR193_PROCESS_CLEANUP_UNCONFIRMED' }
            throw 'PR193_PROCESS_TIMEOUT'
        }
        $out = $stdout.GetAwaiter().GetResult()
        $err = $stderr.GetAwaiter().GetResult()
        if ($out.Length -gt 16777216 -or $err.Length -gt 16777216) { throw 'PR193_PROCESS_OUTPUT_LIMIT' }
        return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $out }
    } finally {
        if ($started -and -not $process.HasExited) {
            & "$env:SystemRoot\System32\taskkill.exe" /PID ([string]$process.Id) /T /F 2>&1 | Out-Null
            if (-not $process.WaitForExit(10000)) { throw 'PR193_PROCESS_CLEANUP_UNCONFIRMED' }
        }
        $process.Dispose()
    }
}

function Assert-Pr193NoReparsePoint {
    param([string]$Path)
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PR193_REPARSE_POINT_REFUSED' }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor.TrimEnd('\'))
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}

function Assert-Pr193PrivateDirectoryAcl {
    param([string]$Path)
    Assert-Pr193NoReparsePoint $Path
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw 'PR193_PRIVATE_DIRECTORY_REQUIRED' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid) {
        throw 'PR193_PRIVATE_ACL_REFUSED'
    }
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid -or
        $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
        $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) {
        throw 'PR193_PRIVATE_ACL_REFUSED'
    }
}

function New-Pr193PrivateDirectory {
    param([string]$Path)
    Assert-Pr193NoReparsePoint $Path
    if (Test-Path -LiteralPath $Path) { throw 'PR193_OUTPUT_EXISTS' }
    if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) -PathType Container)) {
        throw 'PR193_OUTPUT_PARENT_REQUIRED'
    }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    # Windows PowerShell/.NET Framework applies the protected ACL as the directory is created.
    [IO.Directory]::CreateDirectory([IO.Path]::GetFullPath($Path), $acl) | Out-Null
    Assert-Pr193PrivateDirectoryAcl $Path
}

function Assert-Pr193PrivateTreeAcl {
    param([string]$Path)
    Assert-Pr193PrivateDirectoryAcl $Path
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    foreach ($item in @(Get-ChildItem -LiteralPath $Path -Force -Recurse -ErrorAction Stop)) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PR193_REPARSE_POINT_REFUSED' }
        $acl = Get-Acl -LiteralPath $item.FullName -ErrorAction Stop
        if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid) { throw 'PR193_PRIVATE_ACL_REFUSED' }
        foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
            if ($rule.IdentityReference.Value -ne $sid -or $rule.AccessControlType -ne 'Allow') { throw 'PR193_PRIVATE_ACL_REFUSED' }
        }
    }
}

function Write-Pr193JsonNew {
    param([string]$Path, [object]$Value)
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes(($Value | ConvertTo-Json -Depth 30) + "`n")
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
