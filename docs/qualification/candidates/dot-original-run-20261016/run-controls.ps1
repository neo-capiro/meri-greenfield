param([switch]$Help,[ValidatePattern('^[a-z][a-z0-9-]{0,63}$')][string]$Name='controls')
if($Help){Write-Output 'Usage: run-controls.ps1 [-Name unused-evidence-name] [-Help]. One built-in Node synthetic original-run control process, heap128MiB, wall30s, sampled working-set cap256MiB, owned process-tree cleanup. No installed dependencies/services/model/provider/DB. Exit0 pass; exit1 control/setup failure. Existing proof files cannot be overwritten.';return}
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$nodePath=(Get-Command node).Source
$nodeArguments=@('--max-old-space-size=128','--experimental-test-module-mocks','--import','./docs/qualification/candidates/dot-original-run-20261016/dependency-seams.mjs','--test','--test-isolation=none','--test-concurrency=1','apps/runtime/test/original-run-preparation.test.mjs','apps/runtime/test/original-run-facts.test.mjs')
$stdout=Join-Path $PSScriptRoot ($Name+'.stdout.txt')
$stderr=Join-Path $PSScriptRoot ($Name+'.stderr.txt')
$metadata=Join-Path $PSScriptRoot ($Name+'.json')
if((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr) -or (Test-Path -LiteralPath $metadata)){throw 'Choose an unused evidence name; preserve previous results'}
$record=@{synthetic=$true;note='Real new helper/trusted bindings fact producer/canonical task issuer/memory journal; scripted accepted-run/allocation/fact/model ports and fixed synthetic material. Hash/schema/native validator/config parser/compiler/admission imports substituted. READS parser/catalog/compiler semantics, PG, real material/provider UNRUN.';argv=$nodeArguments;heapMiB=128;hardWallMs=30000;workingSetLimitBytes=256MB;ports=@();processCount=1;startedAt=[DateTimeOffset]::UtcNow.ToString('o')}
$process=$null
try{
 $probe=& $nodePath --max-old-space-size=64 -e "const os=require('node:os');console.log(JSON.stringify({freeBytes:os.freemem(),totalBytes:os.totalmem(),rssBytes:process.memoryUsage().rss}))"
 if($LASTEXITCODE -ne 0){throw 'Memory probe failed'}
 $record.memory=($probe|ConvertFrom-Json)
 if($record.memory.freeBytes -lt 1GB){throw 'Actual host memory pressure; no control process started'}
 $record.sourceParent=(& git -C $repoRoot rev-parse HEAD)
 $sourcePaths=@('apps/runtime/original-run-preparation.mjs','apps/runtime/prepared-run-bindings.mjs','apps/runtime/prepared-run-issuer.mjs','apps/runtime/prepared-run-issuance-store.mjs','apps/runtime/test/original-run-preparation.test.mjs','apps/runtime/test/original-run-facts.test.mjs','docs/qualification/candidates/dot-original-run-20261016/dependency-seams.mjs','docs/qualification/candidates/dot-original-run-20261016/run-controls.ps1')
 $record.sourceFiles=@($sourcePaths|ForEach-Object {@{path=$_;sha256=(Get-FileHash -LiteralPath (Join-Path $repoRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()}})
 $quoted=@($nodeArguments|ForEach-Object {'"'+$_+'"'})
 $process=Start-Process -FilePath $nodePath -ArgumentList $quoted -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $watch=[Diagnostics.Stopwatch]::StartNew();$peak=0L
 while(!$process.WaitForExit(20) -and $watch.ElapsedMilliseconds -lt 30000){$process.Refresh();$peak=[Math]::Max($peak,$process.WorkingSet64);if($peak -gt 256MB){break}}
 $complete=$process.HasExited
 if(!$complete){$process.Kill($true);$process.WaitForExit()}
 $record.exitCode=$process.ExitCode;$record.limitStopped=(!$complete);$record.sampledPeakWorkingSetBytes=$peak;$record.elapsedMs=$watch.ElapsedMilliseconds
 if(!$complete -or $process.ExitCode -ne 0){throw 'Original-run controls failed; preserved stdout/stderr and metadata'}
}finally{
 if($process -and !$process.HasExited){$process.Kill($true);$process.WaitForExit()}
 $record.cleanup=@{ownedProcessExited=($null -eq $process -or $process.HasExited);servicesCreated=0;portsCreated=0}
 $record.finishedAt=[DateTimeOffset]::UtcNow.ToString('o')
 $record|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $metadata -Encoding utf8
 if($process){$process.Dispose()}
}
