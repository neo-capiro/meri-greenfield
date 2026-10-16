param([switch]$Help,[ValidatePattern('^[a-z][a-z0-9-]{0,63}$')][string]$Name='controls')
if($Help){Write-Output 'Usage: run-controls.ps1 [-Name unused-evidence-name] [-Help]. One built-in Node synthetic Planner control process, heap128MiB, wall30s, measured working-set cap256MiB, owned process-tree cleanup. No dependencies/services/model/provider/DB. Exit0 pass; exit1 control/setup failure. Existing proof files cannot be overwritten.';return}
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$nodePath=(Get-Command node).Source
$nodeArguments=@('--max-old-space-size=128','--experimental-test-module-mocks','--import','./docs/qualification/candidates/dot-planner-20261016/dependency-seams.mjs','--test','--test-isolation=none','--test-concurrency=1','apps/control/objective-planner/test/receipts.test.mjs','apps/control/objective-planner/test/materializer.test.mjs')
$stdout=Join-Path $PSScriptRoot ($Name+'.stdout.txt')
$stderr=Join-Path $PSScriptRoot ($Name+'.stderr.txt')
$metadata=Join-Path $PSScriptRoot ($Name+'.json')
if((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr) -or (Test-Path -LiteralPath $metadata)){throw 'Choose an unused evidence name; preserve previous results'}
$record=@{synthetic=$true;note='Real production source, fixed synthetic receipts/transport; hash-only dependency stub. Actual canonicalize/Ajv, Core authority/stored custody/Temporal/provider/DB UNRUN.';argv=$nodeArguments;heapMiB=128;hardWallMs=30000;workingSetLimitBytes=256MB;ports=@();processCount=1;startedAt=[DateTimeOffset]::UtcNow.ToString('o')}
$process=$null
try{
 $probe=& $nodePath --max-old-space-size=64 -e "const os=require('node:os');console.log(JSON.stringify({freeBytes:os.freemem(),totalBytes:os.totalmem(),rssBytes:process.memoryUsage().rss}))"
 if($LASTEXITCODE -ne 0){throw 'Memory probe failed'}
 $record.memory=($probe|ConvertFrom-Json)
 if($record.memory.freeBytes -lt 1GB){throw 'Actual host memory pressure; no control process started'}
 $record.sourceParent=(& git -C $repoRoot rev-parse HEAD)
 $record.sourceFiles=@(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/control/objective-planner') -Recurse -File | ForEach-Object {@{path=[IO.Path]::GetRelativePath($repoRoot,$_.FullName);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
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
