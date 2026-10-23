# Read-only audit one level deeper for Documents\Codex (decision O88): each task folder is a container of repo clones.
# For every <date>\<task>\<repo> that is a git checkout or worktree, report size, uncommitted changes, commits on no remote,
# whether HEAD is on a remote branch, and stashes. Deletes nothing. Output: release-logs/repo-audit-codex.csv
$ErrorActionPreference = 'SilentlyContinue'
$rows = foreach ($date in Get-ChildItem 'C:\Users\neoma\Documents\Codex' -Directory) {
  foreach ($task in Get-ChildItem $date.FullName -Directory -Force) {
    foreach ($d in Get-ChildItem $task.FullName -Directory -Force) {
      $git = Join-Path $d.FullName '.git'
      if (-not (Test-Path $git)) { continue }
      $size = (Get-ChildItem $d.FullName -Recurse -Force -File | Measure-Object Length -Sum).Sum
      $kind = if ((Get-Item $git -Force).PSIsContainer) { 'clone' } else { 'worktree' }
      [pscustomobject]@{
        GB = [math]::Round($size/1GB,2); Date = $date.Name; Task = $task.Name; Repo = $d.Name; Kind = $kind
        Branch = (git -C $d.FullName rev-parse --abbrev-ref HEAD 2>$null)
        Dirty = (git -C $d.FullName status --porcelain 2>$null | Measure-Object).Count
        UnpushedCommits = (git -C $d.FullName log --branches --not --remotes --oneline 2>$null | Measure-Object).Count
        HeadOnRemote = (git -C $d.FullName branch -r --contains HEAD 2>$null | Measure-Object).Count
        Stashes = (git -C $d.FullName stash list 2>$null | Measure-Object).Count
        Modified = $d.LastWriteTime.ToString('yyyy-MM-dd')
      }
    }
  }
}
$rows | Sort-Object GB -Descending | Export-Csv 'C:\dev\fable\release-logs\repo-audit-codex.csv' -NoTypeInformation
'done' | Set-Content 'C:\dev\fable\release-logs\repo-audit-codex.done'
