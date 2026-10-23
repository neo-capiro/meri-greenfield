# Read-only audit of old project folders (decision O88). For every folder under Downloads and Documents\Codex that is a git
# checkout or worktree, report size, uncommitted changes, and commits that exist on no remote. Deletes nothing.
$ErrorActionPreference = 'SilentlyContinue'
$out = 'C:\dev\fable\release-logs\repo-audit.csv'
$roots = @('C:\Users\neoma\Downloads') + (Get-ChildItem 'C:\Users\neoma\Documents\Codex' -Directory | ForEach-Object { $_.FullName })
$candidates = foreach ($r in $roots) { Get-ChildItem $r -Directory -Force | ForEach-Object { $_ } }
$rows = foreach ($d in $candidates) {
  $git = Join-Path $d.FullName '.git'
  $isGit = Test-Path $git
  $size = (Get-ChildItem $d.FullName -Recurse -Force -File | Measure-Object Length -Sum).Sum
  $dirty = ''; $unpushed = ''; $branch = ''; $kind = ''
  if ($isGit) {
    $kind = if ((Get-Item $git -Force).PSIsContainer) { 'clone' } else { 'worktree' }
    $branch = (git -C $d.FullName rev-parse --abbrev-ref HEAD 2>$null)
    $dirty = (git -C $d.FullName status --porcelain 2>$null | Measure-Object).Count
    $unpushed = (git -C $d.FullName log --branches --not --remotes --oneline 2>$null | Measure-Object).Count
  }
  [pscustomobject]@{ GB = [math]::Round($size/1GB,2); Parent = $d.Parent.Name; Name = $d.Name; Kind = $kind; Branch = $branch; Dirty = $dirty; UnpushedCommits = $unpushed; Modified = $d.LastWriteTime.ToString('yyyy-MM-dd') }
}
$rows | Sort-Object GB -Descending | Export-Csv $out -NoTypeInformation
'done' | Set-Content 'C:\dev\fable\release-logs\repo-audit.done'
