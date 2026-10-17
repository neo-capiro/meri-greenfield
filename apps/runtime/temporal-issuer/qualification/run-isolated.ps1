# Prepared only: running this creates credentials, a new PostgreSQL 16 cluster,
# two roles and the source migration. It requires separate exact execution approval.
param(
  [switch] $ExecuteApprovedLocalQualification,
  [string] $ApprovedSourceHead
)
$ErrorActionPreference = 'Stop'
if (-not $ExecuteApprovedLocalQualification) {
  throw 'EXPLICIT_LOCAL_POSTGRES_QUALIFICATION_APPROVAL_REQUIRED'
}
if ($ApprovedSourceHead -cnotmatch '^[a-f0-9]{40}$') {
  throw 'Exact reviewed and committed qualification source HEAD is required'
}

$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))
$taskRoot = [IO.Path]::GetFullPath((Join-Path $repo '..'))
$clusterRoot = [IO.Path]::GetFullPath((Join-Path $taskRoot 'issuer-pg16-qualification-20261017'))
$dataDir = Join-Path $clusterRoot 'data'
$pgLog = Join-Path $clusterRoot 'server.log'
$pwFile = Join-Path $clusterRoot 'bootstrap.pw'
$roleSql = Join-Path $clusterRoot 'role.sql'
$grantSql = Join-Path $clusterRoot 'grants.sql'
$nodeOutput = Join-Path $clusterRoot 'runner.stdout'
$nodeError = Join-Path $clusterRoot 'runner.stderr'
$evidenceRoot = Join-Path $taskRoot 'issuer-pg16-qualification-evidence'
$port = 56457
$database = 'meri_issuer_native_qual'
$runtimeRole = 'meri_issuer_native'
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
$node24 = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$migration = Join-Path $repo 'apps\runtime\temporal-issuer\migrations\0001_service_task_registrations.sql'
$adapter = Join-Path $repo 'apps\runtime\temporal-issuer\service-task-registration-pg.mjs'
$runtimePackage = Join-Path $repo 'apps\runtime\package.json'
$runtimeLock = Join-Path $repo 'apps\runtime\package-lock.json'
$qualifier = Join-Path $PSScriptRoot 'qualify.mjs'
$runner = Join-Path $PSScriptRoot 'run-isolated.ps1'
$readme = Join-Path $PSScriptRoot 'README.md'
$runId = [Guid]::NewGuid().ToString('N')
$watch = [Diagnostics.Stopwatch]::StartNew()
$created = $false; $initialized = $false; $child = $null; $receipt = $null
$ownedPostmasterPid = $null; $startAttempted = $false
$adminPassword = $null; $runtimePassword = $null; $cleanupProblem = $null; $evidenceProblem = $null
$oldEnv = @{}
foreach ($name in @('PGPASSWORD','MERI_ISSUER_PG_QUALIFY',
  'MERI_ISSUER_PG_QUALIFY_PORT','MERI_ISSUER_PG_QUALIFY_DATABASE',
  'MERI_ISSUER_PG_QUALIFY_RUN_ID','MERI_ISSUER_PG_OWNER_PASSWORD',
  'MERI_ISSUER_PG_RUNTIME_PASSWORD')) {
  $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
}

function Assert-PathChainNotReparse([string] $path) {
  $full = [IO.Path]::GetFullPath($path)
  $cursor = [IO.Path]::GetPathRoot($full)
  $segments = [regex]::Split($full.Substring($cursor.Length),'[\\/]')
  foreach ($segment in @('') + $segments) {
    if ($segment) { $cursor = Join-Path $cursor $segment }
    try { $attributes = [IO.File]::GetAttributes($cursor) }
    catch [IO.FileNotFoundException] { continue }
    catch [IO.DirectoryNotFoundException] { continue }
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Refusing a path whose ancestor is a reparse point'
    }
  }
  return $full
}

function Assert-OwnerPath([string] $path) {
  $actual = [IO.Path]::GetFullPath($path)
  $expected = [IO.Path]::GetFullPath($clusterRoot)
  $parent = [IO.Path]::GetFullPath($taskRoot)
  if ($actual -cne $expected -and -not $actual.StartsWith($expected + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Cleanup target is outside exact isolated cluster root'
  }
  if (-not $expected.StartsWith($parent + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Isolated cluster root is outside task-owned workspace'
  }
  foreach ($itemPath in @($taskRoot,$clusterRoot,$actual)) {
    Assert-PathChainNotReparse $itemPath | Out-Null
  }
  return $actual
}

function Assert-NoReparseTree([string] $root) {
  foreach ($child in [IO.Directory]::EnumerateFileSystemEntries($root)) {
    $attributes = [IO.File]::GetAttributes($child)
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Refusing recursive cleanup beneath a reparse point'
    }
    if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) {
      Assert-NoReparseTree $child
    }
  }
}

function New-Secret {
  $bytes = New-Object byte[] 48
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function Assert-Budget([string] $step) {
  if ($watch.Elapsed.TotalSeconds -ge 480) { throw ('Eight-minute qualification budget exhausted at ' + $step) }
  if ((Get-ChildItem -LiteralPath $clusterRoot -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum -gt 400MB) {
    throw ('400 MiB owned cluster budget exceeded at ' + $step)
  }
}

function Record-CleanupProblem([string] $reason) {
  if (-not $script:cleanupProblem) { $script:cleanupProblem = $reason }
}

function Invoke-Pg([string] $program,[string[]] $arguments,[string] $step,
  [switch] $ReturnOutput) {
  $spec = New-Object Diagnostics.ProcessStartInfo
  $spec.FileName = Join-Path $pgBin $program
  $spec.Arguments = (($arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ')
  $spec.UseShellExecute = $false
  $spec.CreateNoWindow = $true
  $spec.RedirectStandardOutput = $true
  $spec.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($spec)
  try {
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $remainingMs = [Math]::Max(1000,[int]((480-$watch.Elapsed.TotalSeconds)*1000))
    if (-not $process.WaitForExit($remainingMs)) {
      try {
        $process.Kill()
        if (-not $process.WaitForExit(5000)) {
          Record-CleanupProblem ('PostgreSQL step process exit unconfirmed: ' + $step)
        }
      } catch { Record-CleanupProblem ('PostgreSQL step process kill unconfirmed: ' + $step) }
      throw ('Owned PostgreSQL step timed out: ' + $step)
    }
    # Capture both streams without echoing a command or a credential-bearing SQL
    # line. Any failure remains a generic phase name in the outer receipt.
    $body = $stdout.GetAwaiter().GetResult()
    $stderr.GetAwaiter().GetResult() | Out-Null
    if ($process.ExitCode -ne 0) { throw ('Owned PostgreSQL step failed: ' + $step) }
  } finally { $process.Dispose() }
  Assert-Budget $step
  if ($ReturnOutput) { return $body }
}

try {
  if ($repo -cne 'C:\Users\Administrator\Documents\Codex\2026-10-16\task-3\meri-temporal-issuer-20261017') {
    throw 'Unexpected source repository path'
  }
  foreach ($path in @($repo,$taskRoot,$clusterRoot,$dataDir,$evidenceRoot)) {
    Assert-PathChainNotReparse $path | Out-Null
  }
  if (Test-Path -LiteralPath $clusterRoot) { throw 'Fresh exact cluster root already exists' }
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw 'Owned loopback port already has a listener'
  }
  if ((Get-PSDrive -Name C).Free -lt 2GB) { throw 'Less than 2 GiB free before isolated cluster creation' }
  foreach ($program in @('initdb.exe','pg_ctl.exe','postgres.exe','psql.exe','createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $pgBin $program))) { throw ('Missing PostgreSQL 16 binary: ' + $program) }
  }
  foreach ($path in @($node24,$migration,$adapter,$runtimePackage,$runtimeLock,
    $qualifier,$runner,$readme)) {
    if (-not (Test-Path -LiteralPath $path)) { throw 'Required exact source/runtime path absent' }
  }
  $version = & (Join-Path $pgBin 'postgres.exe') --version
  if ($LASTEXITCODE -ne 0 -or $version -notmatch 'PostgreSQL\) 16\.15\b') { throw 'Installed PostgreSQL must be 16.15' }
  $nodeVersion = & $node24 --version
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'Bundled Node must be 24' }
  # Git trust is process-local to these reads; never alter global safe.directory.
  $safeDirectory = 'safe.directory=' + $repo.Replace('\','/')
  $head = (& git -c $safeDirectory -C $repo rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -cne $ApprovedSourceHead) {
    throw 'Qualification checkout does not match approved immutable source HEAD'
  }
  foreach ($source in @(
    @{path=$qualifier;relative='apps/runtime/temporal-issuer/qualification/qualify.mjs'},
    @{path=$runner;relative='apps/runtime/temporal-issuer/qualification/run-isolated.ps1'},
    @{path=$readme;relative='apps/runtime/temporal-issuer/qualification/README.md'},
    @{path=$migration;relative='apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql'},
    @{path=$adapter;relative='apps/runtime/temporal-issuer/service-task-registration-pg.mjs'},
    @{path=$runtimePackage;relative='apps/runtime/package.json'},
    @{path=$runtimeLock;relative='apps/runtime/package-lock.json'})) {
    $committed = (& git -c $safeDirectory -C $repo rev-parse ('HEAD:' + $source.relative)).Trim()
    $onDisk = (& git -c $safeDirectory -C $repo hash-object -- $source.path).Trim()
    if ($LASTEXITCODE -ne 0 -or $committed -cne $onDisk) {
      throw 'Reviewed qualification source is uncommitted or changed'
    }
  }
  $migrationBlob = & git -c $safeDirectory -C $repo hash-object -- $migration
  $adapterBlob = & git -c $safeDirectory -C $repo hash-object -- $adapter
  $packageBlob = & git -c $safeDirectory -C $repo hash-object -- $runtimePackage
  $lockBlob = & git -c $safeDirectory -C $repo hash-object -- $runtimeLock
  if ($migrationBlob -cne '607929b14678283f62ef4945cf350f3427ec7917' -or
      $adapterBlob -cne '94937b6ee0dca7d3d7d0fb0ee306ebd0604e99ba' -or
      $packageBlob -cne 'aa61b0521a2c6c3b9e0f0460828a3198463c5b69' -or
      $lockBlob -cne 'b2481cede45da976b38c17aab1cb50a4368ce10a') {
    throw 'Reviewed registration/dependency source blob changed; re-review required'
  }
  & git -c $safeDirectory -C $repo merge-base --is-ancestor 5a979d13dd9c3eae6a3a5fa160b5f0b4423081c4 HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Qualification source is not based on published PR126' }
  $installedPgPath = Join-Path $repo 'apps\runtime\node_modules\pg\package.json'
  Assert-PathChainNotReparse $installedPgPath | Out-Null
  if (-not (Test-Path -LiteralPath $installedPgPath)) {
    throw 'Task-owned frozen pg dependency is not installed'
  }
  $installedPg = Get-Content -LiteralPath $installedPgPath -Raw | ConvertFrom-Json
  if ($installedPg.version -cne '8.23.1') { throw 'Task-owned pg version differs from frozen lock' }
  $baseline5432 = @(Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique | Sort-Object)

  New-Item -ItemType Directory -Path $clusterRoot | Out-Null
  $created = $true
  Assert-OwnerPath $clusterRoot | Out-Null
  $adminPassword = New-Secret; $runtimePassword = New-Secret
  [IO.File]::WriteAllText($pwFile,$adminPassword,[Text.Encoding]::ASCII)
  $initialized = $true
  Invoke-Pg 'initdb.exe' @('-D',$dataDir,'-U','postgres',
    '--auth-host=scram-sha-256','--auth-local=scram-sha-256',("--pwfile="+$pwFile)) 'initdb' | Out-Null
  Remove-Item -LiteralPath $pwFile -Force
  $options = '-h 127.0.0.1 -p 56457 -c max_connections=20 -c shared_buffers=16MB -c min_wal_size=32MB -c max_wal_size=64MB -c log_statement=none -c log_min_error_statement=panic'
  $startAttempted = $true
  Invoke-Pg 'pg_ctl.exe' @('-w','-D',$dataDir,'-l',$pgLog,'-o',$options,'start') 'start' | Out-Null
  if ((Get-PSDrive -Name C).Free -lt 1536MB) { throw 'Less than 1.5 GiB free after isolated cluster start' }
  $env:PGPASSWORD = $adminPassword
  Assert-OwnerPath $dataDir | Out-Null
  $pidPath = Join-Path $dataDir 'postmaster.pid'
  $pidText = Get-Content -LiteralPath $pidPath -TotalCount 1
  $parsedPid = 0
  if (-not [int]::TryParse($pidText,[ref]$parsedPid) -or $parsedPid -le 0) {
    throw 'Owned postmaster PID could not be established before native database writes'
  }
  $ownedPostmasterPid = $parsedPid
  $listeners = @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction Stop)
  if ($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $ownedPostmasterPid) {
    throw 'Fixed loopback listener does not belong to the exact new postmaster'
  }
  $identityQuery = "SELECT current_setting('data_directory'),inet_server_addr()::text,inet_server_port(),current_database(),pg_is_in_recovery()"
  $identityText = Invoke-Pg 'psql.exe' @('-X','-A','-t','-F','|','-h','127.0.0.1',
    '-p',[string]$port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1',
    '-c',$identityQuery) 'authenticate-exact-owned-postmaster' -ReturnOutput
  $identityLines = @($identityText.Trim() -split "`r?`n")
  if ($identityLines.Count -ne 1) { throw 'Owned postmaster identity readback was not singular' }
  $identity = @($identityLines[0] -split '\|')
  if ($identity.Count -ne 5 -or
      [IO.Path]::GetFullPath($identity[0]) -ine [IO.Path]::GetFullPath($dataDir) -or
      $identity[1] -cne '127.0.0.1' -or $identity[2] -cne [string]$port -or
      $identity[3] -cne 'postgres' -or $identity[4] -cne 'f') {
    throw 'Authenticated server is not the exact new loopback primary'
  }
  Invoke-Pg 'createdb.exe' @('-h','127.0.0.1','-p',[string]$port,
    '-U','postgres',$database) 'create-disposable-db' | Out-Null
  # The sole credential-bearing SQL file exists only under the owned cluster
  # root, is never committed, and is removed immediately after role creation.
  [IO.File]::WriteAllText($roleSql,(
    "CREATE ROLE $runtimeRole LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$runtimePassword';`n" +
    "REVOKE ALL ON DATABASE $database FROM PUBLIC;`n" +
    "GRANT CONNECT ON DATABASE $database TO $runtimeRole;`n"),[Text.Encoding]::ASCII)
  Invoke-Pg 'psql.exe' @('-X','-q','-h','127.0.0.1','-p',[string]$port,
    '-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f',$roleSql) 'role-bootstrap' | Out-Null
  Remove-Item -LiteralPath $roleSql -Force
  Invoke-Pg 'psql.exe' @('-X','-q','-h','127.0.0.1','-p',[string]$port,
    '-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-f',$migration) 'source-migration' | Out-Null
  $grants = @"
GRANT USAGE ON SCHEMA meri_service_identity TO $runtimeRole;
GRANT SELECT, INSERT ON meri_service_identity.service_task_registrations TO $runtimeRole;
GRANT UPDATE (certificate_sha256,expires_at_ms,proof_observed_at_ms,generation,updated_at,revoked_at)
 ON meri_service_identity.service_task_registrations TO $runtimeRole;
"@
  [IO.File]::WriteAllText($grantSql,$grants,[Text.Encoding]::ASCII)
  Invoke-Pg 'psql.exe' @('-X','-q','-h','127.0.0.1','-p',[string]$port,
    '-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-f',$grantSql) 'narrow-grants' | Out-Null
  Remove-Item -LiteralPath $grantSql -Force
  $env:MERI_ISSUER_PG_QUALIFY = 'approved-task-owned-56457'
  $env:MERI_ISSUER_PG_QUALIFY_PORT = [string]$port
  $env:MERI_ISSUER_PG_QUALIFY_DATABASE = $database
  $env:MERI_ISSUER_PG_QUALIFY_RUN_ID = $runId
  $env:MERI_ISSUER_PG_OWNER_PASSWORD = $adminPassword
  $env:MERI_ISSUER_PG_RUNTIME_PASSWORD = $runtimePassword
  $child = Start-Process -FilePath $node24 -ArgumentList ('"' + $qualifier + '"') -WorkingDirectory $repo -RedirectStandardOutput $nodeOutput -RedirectStandardError $nodeError -WindowStyle Hidden -PassThru
  $remaining = [Math]::Max(1,[int](470-$watch.Elapsed.TotalSeconds))
  if (-not $child.WaitForExit($remaining * 1000)) {
    $child.Refresh()
    if (-not $child.HasExited) {
      try { $child.Kill(); $child.WaitForExit(5000) | Out-Null } catch {}
    }
    throw 'Bounded real-PostgreSQL qualifier timed out'
  }
  $child.Refresh()
  Assert-Budget 'native-tests'
  if ($child.ExitCode -ne 0) { throw 'Real-PostgreSQL qualification failed; sanitized receipt retained' }
} finally {
  try {
    foreach ($name in $oldEnv.Keys) { [Environment]::SetEnvironmentVariable($name,$oldEnv[$name],'Process') }
  } catch { Record-CleanupProblem 'Process environment restoration is unconfirmed' }
  try {
    foreach ($privateFile in @($pwFile,$roleSql)) {
      if (Test-Path -LiteralPath $privateFile) {
        Remove-Item -LiteralPath $privateFile -Force -ErrorAction Stop
      }
    }
  } catch { Record-CleanupProblem 'Disposable credential file could not be retired; exact root retained' }
  try {
    if ($child) { $child.Refresh() }
    if ($child -and -not $child.HasExited) {
      $child.Kill()
      $child.Refresh()
      if (-not $child.WaitForExit(5000)) {
        Record-CleanupProblem 'Qualifier process exit is unconfirmed; exact data retained'
      }
    }
  } catch { Record-CleanupProblem 'Qualifier process could not be stopped; exact data retained' }
  # Shutdown must run even if credential or evidence handling fails.
  try {
    if ($initialized -and (Test-Path -LiteralPath $dataDir)) {
      Assert-OwnerPath $dataDir | Out-Null
      if ($startAttempted) {
        $postmasterFile = Join-Path $dataDir 'postmaster.pid'
        if (-not $ownedPostmasterPid -or -not (Test-Path -LiteralPath $postmasterFile)) {
          Record-CleanupProblem 'Owned postmaster identity is unconfirmed; exact data retained'
        } else {
          $stopPid = 0
          $firstLine = Get-Content -LiteralPath $postmasterFile -TotalCount 1
          if (-not [int]::TryParse($firstLine,[ref]$stopPid) -or
              $stopPid -ne $ownedPostmasterPid) {
            Record-CleanupProblem 'Owned postmaster PID changed; exact data retained'
          } else {
            & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir status *> $null
            if ($LASTEXITCODE -eq 0) {
              & (Join-Path $pgBin 'pg_ctl.exe') -w -t 15 -D $dataDir stop -m fast *> $null
              if ($LASTEXITCODE -ne 0) { Record-CleanupProblem 'Exact owned cluster did not stop; data retained' }
            }
          }
        }
      }
    }
  } catch { Record-CleanupProblem 'Owned PostgreSQL stop is unconfirmed; exact data retained' }
  # Capture only after attempting shutdown, and never let evidence I/O skip
  # process, listener, PID, credential, or exact-root cleanup checks.
  try {
    if ($created) {
      Assert-PathChainNotReparse $evidenceRoot | Out-Null
      New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
      $receipt = Join-Path $evidenceRoot ('registration-pg16-' + $runId + '.txt')
      $summary = "sourceBase: PR126 5a979d13dd9c3eae6a3a5fa160b5f0b4423081c4`napprovedHead: $ApprovedSourceHead`nmigrationBlob: $migrationBlob`nadapterBlob: $adapterBlob`ndependencySource: task-owned frozen install`nloopback: 127.0.0.1:56457`nrunId: $runId`nelapsedSeconds: $([int]$watch.Elapsed.TotalSeconds)`n"
      foreach ($path in @($nodeOutput,$nodeError,$pgLog)) {
        if (Test-Path -LiteralPath $path) {
          $raw = [IO.File]::ReadAllText($path)
          foreach ($secret in @($adminPassword,$runtimePassword)) {
            if ($secret) { $raw = $raw.Replace($secret,'[redacted]') }
          }
          $summary += "`n[$([IO.Path]::GetFileName($path))]`n" + $raw
        }
      }
      [IO.File]::WriteAllText($receipt,$summary,[Text.Encoding]::UTF8)
    }
  } catch { $evidenceProblem = 'Sanitized receipt could not be retained' }
  try {
    if ($created -and -not $cleanupProblem -and (Test-Path -LiteralPath $clusterRoot)) {
      & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir status *> $null
      if ($LASTEXITCODE -eq 0 -or
        (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
        Record-CleanupProblem 'Owned postmaster/listener still active; cluster data retained'
      } else {
        $postmaster = Join-Path $dataDir 'postmaster.pid'
        if (Test-Path -LiteralPath $postmaster) {
          $pidText = Get-Content -LiteralPath $postmaster -TotalCount 1
          $recordedPid = 0
          if ([int]::TryParse($pidText,[ref]$recordedPid) -and
            (Get-Process -Id $recordedPid -ErrorAction SilentlyContinue)) {
            Record-CleanupProblem 'Recorded postmaster PID remains active; cluster data retained'
          }
        }
      }
      if (-not $cleanupProblem) {
        $exactTarget = Assert-OwnerPath $clusterRoot
        Assert-OwnerPath $dataDir | Out-Null
        Assert-NoReparseTree $exactTarget
        Remove-Item -LiteralPath $exactTarget -Recurse -Force
      }
    }
  } catch { Record-CleanupProblem 'Exact owned cluster removal is unconfirmed; inspect retained root' }
  try {
    if ($created) {
      $after5432 = @(Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique | Sort-Object)
      if (($baseline5432 -join ',') -cne ($after5432 -join ',')) {
        Record-CleanupProblem 'Host 5432 listener changed independently; investigate before qualification acceptance'
      }
    }
  } catch { Record-CleanupProblem 'Host 5432 preservation readback is unconfirmed' }
  if ($receipt) {
    try {
      $cleanupState = if ($cleanupProblem) { 'UNCONFIRMED' } elseif (Test-Path -LiteralPath $clusterRoot) { 'RETAINED' } else { 'REMOVED' }
      [IO.File]::AppendAllText($receipt,("cleanup: " + $cleanupState + [Environment]::NewLine),[Text.Encoding]::UTF8)
    } catch { $evidenceProblem = 'Terminal cleanup receipt could not be retained' }
  }
  $adminPassword = $null; $runtimePassword = $null
  if ($cleanupProblem) { throw $cleanupProblem }
  if ($evidenceProblem) { throw $evidenceProblem }
}
