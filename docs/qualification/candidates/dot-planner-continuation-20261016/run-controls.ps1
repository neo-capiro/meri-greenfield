param([switch]$Help,[ValidatePattern('^[a-z][a-z0-9-]{0,63}$')][string]$Name='controls',[ValidateSet('continuation','canonical-review','sdk-layout','producer','regeneration')][string]$Slice='continuation')
if($Help){Write-Output 'Usage: run-controls.ps1 [-Name unused-evidence-name] [-Help]. One built-in Node synthetic Planner control process, heap128MiB, wall30s, measured working-set cap256MiB, owned process-tree cleanup. No dependencies/services/model/provider/DB. Exit0 pass; exit1 control/setup failure. Existing proof files cannot be overwritten.';return}
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$nodePath=(Get-Command node).Source
$nodeArguments=@('--max-old-space-size=128','--experimental-test-module-mocks','--import','./docs/qualification/candidates/dot-planner-continuation-20261016/dependency-seams.mjs','--test','--test-isolation=none','--test-concurrency=1','apps/control/objective-planner/continuation/driver.test.mjs','apps/control/conversations/test/objective-planner-dispatch.test.mjs','apps/control/objective-planner/continuation/registration.test.mjs','apps/control/objective-planner/continuation/contract.test.mjs','apps/control/objective-planner/continuation/core-client.test.mjs','apps/control/objective-planner/continuation/admission.test.mjs','apps/runtime/test/objective-planner-activities.test.mjs','apps/control/objective-planner/continuation/server.test.mjs','apps/runtime/test/objective-planner-startup.test.mjs','apps/control/objective-planner/test/receipts.test.mjs','apps/control/objective-planner/test/materializer.test.mjs')
if($Slice -eq 'canonical-review'){$nodeArguments=@($nodeArguments[0..6])+@('apps/control/objective-planner/continuation/contract.test.mjs','apps/control/objective-planner/continuation/core-client.test.mjs','apps/runtime/test/objective-planner-activities.test.mjs','apps/runtime/test/objective-planner-startup.test.mjs')}
if($Slice -eq 'sdk-layout'){$nodeArguments=@($nodeArguments[0..6])+@('apps/control/objective-planner/continuation/contract.test.mjs','apps/control/objective-planner/continuation/core-client.test.mjs','apps/runtime/test/objective-planner-activities.test.mjs','apps/runtime/test/objective-planner-startup.test.mjs','apps/control/conversations/test/objective-planner-dispatch.test.mjs')}
if($Slice -eq 'producer'){$nodeArguments=@($nodeArguments[0..6])+@('apps/control/objective-planner/continuation/core-client.test.mjs','apps/control/objective-planner/continuation/core-producer.test.mjs','apps/runtime/test/objective-planner-activities.test.mjs','apps/runtime/test/objective-planner-startup.test.mjs')}
if($Slice -eq 'regeneration'){$nodeArguments=@($nodeArguments[0..6])+@('apps/control/objective-planner/continuation/contract.test.mjs','apps/control/objective-planner/test/receipts.test.mjs')}
$stdout=Join-Path $PSScriptRoot ($Name+'.stdout.txt')
$stderr=Join-Path $PSScriptRoot ($Name+'.stderr.txt')
$metadata=Join-Path $PSScriptRoot ($Name+'.json')
if((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr) -or (Test-Path -LiteralPath $metadata)){throw 'Choose an unused evidence name; preserve previous results'}
$record=@{synthetic=$true;note='Real new driver/dispatcher/client/admission/activities/server/composition/contract plus legacy controls; scripted ports, public hash/schema and Temporal enum/Context import seams. Core sorted hash uses real node:crypto. Actual Temporal1.24/server/replay, Core authority/stored custody, canonicalize/Ajv/provider/DB UNRUN.';argv=$nodeArguments;heapMiB=128;hardWallMs=30000;workingSetLimitBytes=256MB;ports=@();processCount=1;startedAt=[DateTimeOffset]::UtcNow.ToString('o')}
$process=$null
try{
 $probe=& $nodePath --max-old-space-size=64 -e "const os=require('node:os');console.log(JSON.stringify({freeBytes:os.freemem(),totalBytes:os.totalmem(),rssBytes:process.memoryUsage().rss}))"
 if($LASTEXITCODE -ne 0){throw 'Memory probe failed'}
 $record.memory=($probe|ConvertFrom-Json)
 if($record.memory.freeBytes -lt 1GB){throw 'Actual host memory pressure; no control process started'}
 foreach($testPath in ($nodeArguments|Where-Object {$_ -like '*.test.mjs'})){if(!(Test-Path -LiteralPath (Join-Path $repoRoot $testPath))){throw 'Focused control file missing; refuse a partial test selection'}}
 $record.sourceParent=(& git -C $repoRoot rev-parse HEAD)
 $record.sourceFiles=@(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/control/objective-planner') -Recurse -File | ForEach-Object {@{path=[IO.Path]::GetRelativePath($repoRoot,$_.FullName);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
 $record.sourceFiles+=@('apps/control/conversations/workflow.ts','apps/runtime/temporal-worker.mjs','apps/runtime/objective-planner-activities.mjs','apps/runtime/objective-planner-startup.mjs','apps/runtime/test/objective-planner-activities.test.mjs','apps/runtime/test/objective-planner-startup.test.mjs','apps/control/conversations/objective-planner-dispatch.mjs','apps/control/conversations/objective-planner-workflow.ts','apps/control/conversations/test/objective-planner-dispatch.test.mjs','docs/qualification/candidates/dot-planner-continuation-20261016/dependency-seams.mjs','docs/qualification/candidates/dot-planner-continuation-20261016/temporal-client-shim.mjs','docs/qualification/candidates/dot-planner-continuation-20261016/temporal-activity-shim.mjs','docs/qualification/candidates/dot-planner-continuation-20261016/run-controls.ps1')|ForEach-Object {@{path=$_;sha256=(Get-FileHash -LiteralPath (Join-Path $repoRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()}}
 $quoted=@($nodeArguments|ForEach-Object {'"'+$_+'"'})
 $process=Start-Process -FilePath $nodePath -ArgumentList $quoted -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $watch=[Diagnostics.Stopwatch]::StartNew();$peak=0L
 while(!$process.WaitForExit(20) -and $watch.ElapsedMilliseconds -lt 30000){$process.Refresh();$peak=[Math]::Max($peak,$process.WorkingSet64);if($peak -gt 256MB){break}}
 $complete=$process.HasExited
 if(!$complete){$process.Kill($true);$process.WaitForExit()}
 $record.exitCode=$process.ExitCode;$record.limitStopped=(!$complete);$record.sampledPeakWorkingSetBytes=$peak;$record.elapsedMs=$watch.ElapsedMilliseconds
 if(!$complete -or $process.ExitCode -ne 0){throw 'Planner controls failed; preserved stdout/stderr and metadata'}
}finally{
 if($process -and !$process.HasExited){$process.Kill($true);$process.WaitForExit()}
 $record.cleanup=@{ownedProcessExited=($null -eq $process -or $process.HasExited);servicesCreated=0;portsCreated=0}
 $record.finishedAt=[DateTimeOffset]::UtcNow.ToString('o')
 $record|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $metadata -Encoding utf8
 if($process){$process.Dispose()}
}
