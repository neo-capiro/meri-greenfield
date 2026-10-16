param([Parameter(Mandatory=$true)][ValidateRange(1,6)][int]$Stage)
$ErrorActionPreference='Stop'
$taskRoot='C:\Users\neoma\Documents\Codex\2026-10-15\task-4'
$repository=Join-Path $taskRoot 'meri-greenfield'
$profile=Get-Content -LiteralPath (Join-Path $taskRoot 'history-tooling-profile.json') -Raw|ConvertFrom-Json
$spec=$profile.stages[$Stage-1]
$head=(& git -C $repository rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $head -ne $profile.source){throw 'Unexpected history source'}
$memory=& $profile.python (Join-Path $taskRoot 'history-memory.py')
if($LASTEXITCODE -ne 0){throw 'Memory observation failed'}
$health=$memory|ConvertFrom-Json
if($health.commitAvailable -lt ($spec.reserveBytes+1073741824)){throw 'Insufficient fresh commit margin'}
$health|ConvertTo-Json -Compress
$evidence=Join-Path $taskRoot 'history-tooling'
New-Item -ItemType Directory -Path $evidence -Force|Out-Null
$baselinePath=Join-Path $evidence 'preserved-inputs.json'
if(-not(Test-Path -LiteralPath $baselinePath)){
 $paths=@('package-lock.json','packages/contracts/package-lock.json','packages/contracts/meri.schema.json')+@(Get-ChildItem -LiteralPath (Join-Path $repository 'packages/contracts/dist') -File|ForEach-Object{'packages/contracts/dist/'+$_.Name})
 $rows=@(foreach($path in $paths){[pscustomobject]@{path=$path;sha256=(Get-FileHash -LiteralPath (Join-Path $repository $path) -Algorithm SHA256).Hash.ToLowerInvariant()}})
 $rows|ConvertTo-Json -Depth 3|Set-Content -LiteralPath $baselinePath -Encoding utf8NoBOM
}
if($Stage -eq 6){New-Item -ItemType Directory -Path (Join-Path $taskRoot 'history-package') -Force|Out-Null}
$stdout=Join-Path $evidence ("stage-$Stage.stdout.txt")
$stderr=Join-Path $evidence ("stage-$Stage.stderr.txt")
$arguments=@($spec.argv|ForEach-Object{'"'+$_+'"'})
$owned=Start-Process -FilePath $profile.node -ArgumentList $arguments -WorkingDirectory (Join-Path $repository 'packages/contracts') -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$timer=[Diagnostics.Stopwatch]::StartNew();$peak=0L;$timedOut=$false;$cleanupExit=0
while(-not $owned.WaitForExit(50)){
 $owned.Refresh();try{$peak=[Math]::Max($peak,$owned.WorkingSet64)}catch{}
 if($timer.Elapsed.TotalSeconds -ge $spec.hardSeconds){$timedOut=$true;& taskkill.exe /PID $owned.Id /T /F|Out-Null;$cleanupExit=$LASTEXITCODE;$owned.WaitForExit();break}
}
$owned.WaitForExit()
$unchanged=$true
foreach($row in (Get-Content -LiteralPath $baselinePath -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $repository $row.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256){$unchanged=$false}
}
$receipt=[pscustomobject]@{source=$head;stage=$Stage;argv=$spec.argv;hardSeconds=$spec.hardSeconds;memoryBefore=$health;primaryExit=$owned.ExitCode;cleanupExit=$cleanupExit;timedOut=$timedOut;ownedExited=$owned.HasExited;wallMs=$timer.ElapsedMilliseconds;sampledParentRssBytes=$peak;preservedBytes=$unchanged;childNote=$spec.children}
$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence ("stage-$Stage.receipt.json")) -Encoding utf8NoBOM
$receipt|ConvertTo-Json -Depth 5 -Compress
Get-Content -LiteralPath $stdout -Tail 12
Get-Content -LiteralPath $stderr -Tail 15
if($timedOut -or $owned.ExitCode -ne 0 -or $cleanupExit -ne 0 -or -not $unchanged){exit 1}
