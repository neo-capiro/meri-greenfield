# Read-only second pass over the audit's "safe" git folders (decision O88): also require that HEAD is contained in a remote
# branch (catches detached-HEAD commits) and that there are no stashes. Writes release-logs/repo-safe-recheck.csv. Deletes nothing.
$ErrorActionPreference = 'SilentlyContinue'
$rows = Import-Csv 'C:\dev\fable\release-logs\repo-audit.csv' | Where-Object { $_.Kind -and [int]$_.Dirty -eq 0 -and [int]$_.UnpushedCommits -eq 0 }
$res = foreach ($r in $rows) {
  $path = if ($r.Parent -eq 'Downloads') { Join-Path 'C:\Users\neoma\Downloads' $r.Name } else { $null }
  if (-not $path) { continue }
  $headOnRemote = (git -C $path branch -r --contains HEAD 2>$null | Measure-Object).Count
  $stashes = (git -C $path stash list 2>$null | Measure-Object).Count
  $untrackedIgnoredWork = (git -C $path status --porcelain --ignored 2>$null | Where-Object { $_ -match '^!! ' -and $_ -notmatch 'node_modules|\.next|dist/|build/|coverage|\.turbo|\.cache|\.tsbuildinfo|\.vite|test-results|playwright-report' } | Measure-Object).Count
  [pscustomobject]@{ GB = $r.GB; Name = $r.Name; Kind = $r.Kind; Branch = $r.Branch; HeadOnRemote = $headOnRemote; Stashes = $stashes; OddIgnoredFiles = $untrackedIgnoredWork; Modified = $r.Modified }
}
$res | Export-Csv 'C:\dev\fable\release-logs\repo-safe-recheck.csv' -NoTypeInformation
'done' | Set-Content 'C:\dev\fable\release-logs\repo-safe-recheck.done'
