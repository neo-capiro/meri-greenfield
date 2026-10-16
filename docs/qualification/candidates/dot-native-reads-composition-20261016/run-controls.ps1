param([string]$Name='composition-1',[string[]]$Files=@('apps/runtime/native-authority/test/prepared-reads.test.mjs','apps/runtime/test/prepared-run-issuance.test.mjs','apps/runtime/test/prepared-run-registry.test.mjs'))
$ErrorActionPreference='Stop'
$taskRoot='C:\Users\neoma\Documents\Codex\2026-10-15\task-4'
$repo=Join-Path $taskRoot 'meri-greenfield'
$memory=& 'C:\Users\neoma\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe' (Join-Path $taskRoot 'history-memory.py')
if($LASTEXITCODE -ne 0){throw 'Fresh native memory observation failed'}
$health=$memory|ConvertFrom-Json
if($health.commitAvailable -lt 1342177280){throw 'Insufficient fresh memory margin'}
$evidence=Join-Path $taskRoot 'native-read-controls'
New-Item -ItemType Directory -Path $evidence -Force|Out-Null
$stdout=Join-Path $evidence ($Name+'.stdout.txt');$stderr=Join-Path $evidence ($Name+'.stderr.txt')
$argv=@('--max-old-space-size=128','--experimental-test-module-mocks','--test','--test-isolation=none','--test-concurrency=1')+$Files
$quoted=@($argv|ForEach-Object{'"'+$_+'"'})
$proc=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList $quoted -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$timer=[Diagnostics.Stopwatch]::StartNew();$peak=0L;$timeout=$false;$pressure=$false;$cleanup=0
while(-not $proc.WaitForExit(25)){
 $proc.Refresh();try{$peak=[Math]::Max($peak,$proc.WorkingSet64)}catch{}
 if($timer.Elapsed.TotalSeconds -ge 120 -or $peak -gt 268435456){$timeout=$timer.Elapsed.TotalSeconds -ge 120;$pressure=$peak -gt 268435456;Stop-Process -Id $proc.Id -Force;$proc.WaitForExit();break}
}
$proc.WaitForExit()
$result=[pscustomobject]@{name=$Name;head=(& git -C $repo rev-parse HEAD).Trim();argv=$argv;hardSeconds=120;heapMiB=128;memoryBefore=$health;primaryExit=$proc.ExitCode;cleanupExit=$cleanup;timedOut=$timeout;pressure=$pressure;ownedPid=$proc.Id;ownedExited=$proc.HasExited;wallMs=$timer.ElapsedMilliseconds;sampledRssBytes=$peak;children='none: single Node process test-isolation=none';finishedAtUtc=[DateTime]::UtcNow.ToString('o')}
$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence ($Name+'.json')) -Encoding utf8NoBOM
$result|ConvertTo-Json -Depth 5 -Compress
Get-Content -LiteralPath $stdout -Tail 16
Get-Content -LiteralPath $stderr -Tail 10
if($proc.ExitCode -ne 0 -or $timeout -or $pressure){exit 1}
