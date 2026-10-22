# Deletes everything from before the current programme (Neo, 21 Oct 2026: "every other worktree, local repos ... can go").
# Targets: every folder under C:\dev except fable and rubin-audit; old work folders inside C:\dev\fable (keep list below);
# all of Documents\Codex; Downloads folders that are git checkouts or named capiro-*. Loose files in Downloads are kept.
# Anything modified in the last 6 hours is skipped (reviewers' active folders). Up to 4 deletions run at once.
# Usage: -Execute to delete; default prints the target list. Log: release-logs\cleanup-all-old.log
param([switch]$Execute)
$log = 'C:\dev\fable\release-logs\cleanup-all-old.log'
function L($m) { $line = '{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m; Add-Content $log $line; $line }
$cutoff = (Get-Date).AddHours(-6)
$fableKeep = @('meri-greenfield','capiro-backend','capiro-frontend','adj-reports','release-logs','ship-kit','ship-proxy-kit','ship-fe-kit',
  'wt-candidate','wt-consolidate-gf','meri-source','meri-preview-private-pki','meri-stage3-prep-20261018','proxy-artifacts-b7fc',
  'ship-bce70776','ship-src-bce70776','ship-proxy-bce70776','ship-3c56c3e9','ship-src-3c56c3e9','ship-proxy-e3ba4e47','ship-core-0f5d7e15','ship-fe-2abf9cdd')
$targets = @()
$targets += Get-ChildItem C:\dev -Directory -Force | Where-Object { $_.Name -notin @('fable','rubin-audit') }
$targets += Get-ChildItem C:\dev\fable -Directory -Force | Where-Object { $_.Name -notin $fableKeep -and $_.Name -match '^(wt-|ship-|frontend-meri-wire|fe-)' }
if (Test-Path 'C:\Users\neoma\Documents\Codex') { $targets += Get-Item 'C:\Users\neoma\Documents\Codex' }
$targets += Get-ChildItem C:\Users\neoma\Downloads -Directory -Force | Where-Object { $_.Name -like 'capiro-*' -or (Test-Path (Join-Path $_.FullName '.git')) }
$targets = $targets | Where-Object { $_.LastWriteTime -lt $cutoff }
L ("mode={0}; {1} targets" -f $(if ($Execute) {'EXECUTE'} else {'LIST'}), $targets.Count)
if (-not $Execute) { $targets | ForEach-Object { L ("TARGET {0}" -f $_.FullName) }; return }
$freeBefore = (Get-PSDrive C).Free
$running = @()
foreach ($t in $targets) {
  while (($running | Where-Object { -not $_.HasExited }).Count -ge 4) { Start-Sleep -Milliseconds 500 }
  $running += Start-Process -FilePath cmd.exe -ArgumentList '/c', "rd /s /q `"\\?\$($t.FullName)`"" -WindowStyle Hidden -PassThru
  L ("STARTED {0}" -f $t.FullName)
}
$running | ForEach-Object { $_.WaitForExit() }
foreach ($t in $targets) { if (Test-Path $t.FullName) { L ("LEFT {0}" -f $t.FullName) } }
git -C C:\dev\fable\meri-greenfield worktree prune; git -C C:\dev\fable\capiro-frontend worktree prune; git -C C:\dev\fable\capiro-backend worktree prune
L ("DONE C: free {0:N1} -> {1:N1} GB" -f ($freeBefore/1GB), ((Get-PSDrive C).Free/1GB))
