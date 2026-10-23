# Deletes the confirmed-safe old checkouts in Downloads (decision O90; Neo: "make space", after the O89 audit).
# Per folder, immediately before deleting: git status clean, no commits on no remote, HEAD on a remote branch, no stashes,
# and the folder is not the parent of a linked worktree that is being kept. Then permanent delete (long-path safe), and
# `git worktree prune` in surviving parents. Log: release-logs/delete-safe-downloads.log. Usage: -Execute to delete; default dry run.
param([switch]$Execute)
$ErrorActionPreference = 'Continue'
$log = 'C:\dev\fable\release-logs\delete-safe-downloads.log'
function L($m) { $line = '{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m; Add-Content $log $line; $line }
$root = 'C:\Users\neoma\Downloads'
$names = Get-Content 'C:\dev\fable\release-logs\confirmed-safe-downloads.json' -Raw | ConvertFrom-Json
$set = @{}; foreach ($n in $names) { $set[(Join-Path $root $n).ToLower()] = $true }
L ("mode={0}; {1} candidates" -f ($(if ($Execute) {'EXECUTE'} else {'DRY RUN'})), $names.Count)
$freeBefore = (Get-PSDrive C).Free
$parentsToPrune = @{}; $deleted = 0; $skipped = 0; $bytes = 0
foreach ($n in $names) {
  $dir = Join-Path $root $n
  if (-not (Test-Path (Join-Path $dir '.git'))) { L "SKIP $n (not a git folder now)"; $skipped++; continue }
  $dirty   = (git -C $dir status --porcelain 2>$null | Measure-Object).Count
  $unpush  = (git -C $dir log --branches --not --remotes --oneline 2>$null | Measure-Object).Count
  $onRem   = (git -C $dir branch -r --contains HEAD 2>$null | Measure-Object).Count
  $stash   = (git -C $dir stash list 2>$null | Measure-Object).Count
  if ($dirty -ne 0 -or $unpush -ne 0 -or $onRem -eq 0 -or $stash -ne 0) { L "SKIP $n (dirty=$dirty unpushed=$unpush onRemote=$onRem stash=$stash)"; $skipped++; continue }
  $isClone = (Get-Item (Join-Path $dir '.git') -Force).PSIsContainer
  if ($isClone) {
    $keep = git -C $dir worktree list --porcelain 2>$null | Where-Object { $_ -like 'worktree *' } | ForEach-Object { ($_ -replace '^worktree ','') -replace '/','\' } |
      Where-Object { $_.ToLower() -ne $dir.ToLower() -and (Test-Path $_) -and -not $set.ContainsKey($_.ToLower()) }
    if ($keep) { L "SKIP $n (parent of kept worktree: $($keep -join ', '))"; $skipped++; continue }
  } else {
    $gd = (Get-Content (Join-Path $dir '.git') -Raw).Trim() -replace '^gitdir:\s*',''
    $parent = ($gd -replace '/','\') -replace '\\\.git\\worktrees\\.*$',''
    if ($parent) { $parentsToPrune[$parent] = $true }
  }
  $size = if ($Execute) { 0 } else { (Get-ChildItem $dir -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum }
  if ($Execute) {
    cmd /c "rd /s /q `"\\?\$dir`"" 2>&1 | Out-Null
    if (Test-Path $dir) { L "PARTIAL $n (still exists after rd; will retry once)"; Start-Sleep 2; cmd /c "rd /s /q `"\\?\$dir`"" 2>&1 | Out-Null }
    if (Test-Path $dir) { L "FAILED $n (could not remove)"; $skipped++; continue }
    L ("DELETED {0}" -f $n)
  } else { L ("WOULD DELETE {0} ({1:N2} GB)" -f $n, ($size/1GB)) }
  $deleted++; $bytes += $size
}
if ($Execute) {
  foreach ($p in $parentsToPrune.Keys) { if (Test-Path $p) { git -C $p worktree prune 2>$null; L "pruned worktrees in $p" } }
}
$freeAfter = (Get-PSDrive C).Free
L ("SUMMARY: {0} {1}, {2} skipped, {3:N1} GB; C: free {4:N1} -> {5:N1} GB" -f $deleted, $(if ($Execute) {'deleted'} else {'would delete'}), $skipped, ($bytes/1GB), ($freeBefore/1GB), ($freeAfter/1GB))
'done' | Set-Content 'C:\dev\fable\release-logs\delete-safe-downloads.done'
