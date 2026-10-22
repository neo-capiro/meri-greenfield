# Removes my own regenerable working copies and old release kits under C:\dev\fable (decision O105; Neo: disk nearly full).
# Worktrees/clones: only when untouched for 3 h, not on the keep list, git status clean, no stash, and HEAD on a remote
# branch (so everything is on GitHub); worktrees go through `git worktree remove` so their repo stays consistent.
# Release kits: every ship-*/ship-src-* except the live and rollback candidates and the reused proxy kit.
# Usage: -Execute to delete; default dry run. Log: release-logs\cleanup-fable-workdirs.log
param([switch]$Execute)
$ErrorActionPreference = 'Continue'
$root = 'C:\dev\fable'; $log = 'C:\dev\fable\release-logs\cleanup-fable-workdirs.log'
function L($m) { $line = '{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m; Add-Content $log $line; $line }
$keep = @('wt-candidate','wt-consolidate-gf','wt-adj-e-c11','wt-c10-latest','wt-c10-followups','wt-c10-probe','wt-c10-base','wt-c10-base2','wt-c10-base3','wt-adj-a-p2a',
          'ship-kit','ship-proxy-kit','ship-fe-kit','ship-3c56c3e9','ship-src-3c56c3e9','ship-96b6da6d','ship-src-96b6da6d','ship-proxy-e3ba4e47','ship-fe-2abf9cdd','ship-core-0f5d7e15',
          'meri-greenfield','capiro-backend','capiro-frontend','meri-source','adj-reports','release-logs')
$cutoff = (Get-Date).AddHours(-3)
$freeBefore = (Get-PSDrive C).Free
L ("mode={0}" -f $(if ($Execute) {'EXECUTE'} else {'DRY RUN'}))
foreach ($d in Get-ChildItem $root -Directory | Where-Object { $_.Name -match '^(wt-|ship-|ship-src-|frontend-meri-wire$)' } | Sort-Object { $_.Name -notlike 'wt-fe-*' }, Name) {
  $n = $d.Name
  if ($keep -contains $n) { continue }
  if ($n -notmatch '^ship-' -and $d.LastWriteTime -gt $cutoff) { L "SKIP $n (touched in the last 3 h)"; continue }
  $git = Join-Path $d.FullName '.git'
  $isWorktree = (Test-Path $git) -and -not (Get-Item $git -Force).PSIsContainer
  if (Test-Path $git) {
    $dirty  = (git -C $d.FullName status --porcelain 2>$null | Measure-Object).Count
    $onRem  = (git -C $d.FullName branch -r --contains HEAD 2>$null | Measure-Object).Count
    $stash  = (git -C $d.FullName stash list 2>$null | Measure-Object).Count
    if ($dirty -ne 0 -or $onRem -eq 0 -or $stash -ne 0) { L "SKIP $n (dirty=$dirty headOnRemote=$onRem stash=$stash)"; continue }
  } elseif ($n -notmatch '^ship-') { L "SKIP $n (not a git checkout)"; continue }
  if (-not $Execute) { L "WOULD REMOVE $n"; continue }
  if ($isWorktree) {
    $common = (git -C $d.FullName rev-parse --git-common-dir 2>$null)
    $repo = Split-Path ([IO.Path]::GetFullPath((Join-Path $d.FullName $common))) -Parent
    git -C $repo worktree remove --force $d.FullName 2>$null
  }
  if (Test-Path $d.FullName) { cmd /c "rd /s /q `"\\?\$($d.FullName)`"" 2>&1 | Out-Null }
  if (Test-Path $d.FullName) { L "FAILED $n" } else { L "REMOVED $n" }
}
L ("C: free {0:N1} -> {1:N1} GB" -f ($freeBefore/1GB), ((Get-PSDrive C).Free/1GB))
