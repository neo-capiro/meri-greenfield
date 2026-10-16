param([switch]$Help,[ValidatePattern('^[a-z][a-z0-9-]{0,63}$')][string]$Name='controls',[ValidateSet('validation','custody','hooks','all')][string]$Slice='validation')
if($Help){Write-Output 'Usage: run-controls.ps1 -Name unused-proof-name [-Slice validation|custody|hooks|all]. Synthetic Node controls, one128MiB heap,30s hardwall,256MiB sampled working-set ceiling, no services/ports/provider/DB. Exit0 pass,1 failed; previous proof cannot be overwritten.';return}
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$nodePath=(Get-Command node).Source
$tests=@('apps/worker/conversation/objective-generation/test/typed-result.test.mjs','apps/worker/conversation/objective-generation/test/runtime.test.mjs')
if($Slice -in @('custody','all')){$tests+=@('apps/runtime/objective-generation/test/retained-result.test.mjs','apps/control/conversations/test/typed-completion.test.mjs','apps/runtime/native-authority/test/typed-completion-capture.test.mjs')}
if($Slice -eq 'hooks'){$tests=@('apps/worker/conversation/objective-generation/test/activity-hook.test.mjs','apps/runtime/native-authority/test/typed-checkpoint-http.test.mjs','apps/worker/conversation/test/completion-activity.test.mjs')}
if($Slice -eq 'all'){$tests+=@('apps/worker/conversation/objective-generation/test/activity-hook.test.mjs','apps/runtime/native-authority/test/typed-checkpoint-http.test.mjs','apps/worker/conversation/test/completion-activity.test.mjs')}
$nodeArguments=@('--max-old-space-size=128','--experimental-test-module-mocks','--import','./docs/qualification/candidates/dot-strategy-custody-20261016/dependency-seams.mjs','--test','--test-isolation=none','--test-concurrency=1')+$tests
$stdout=Join-Path $PSScriptRoot ($Name+'.stdout.txt');$stderr=Join-Path $PSScriptRoot ($Name+'.stderr.txt');$metadata=Join-Path $PSScriptRoot ($Name+'.json')
foreach($path in @($stdout,$stderr,$metadata)){if(Test-Path -LiteralPath $path){throw 'Choose unused evidence name; preserve prior results'}}
$record=@{synthetic=$true;note='Real changed typed/custody source with scripted canonical candidate/schema/hash, SQL/native/authority ports. Installed Ajv/canonicalize/SDK/real provider/DB and Linux fd writer UNRUN.';argv=$nodeArguments;heapMiB=128;hardWallMs=30000;workingSetLimitBytes=256MB;ports=@();processCount=1;startedAt=[DateTimeOffset]::UtcNow.ToString('o')};$process=$null
try{
 $probe=& $nodePath --max-old-space-size=64 -e "const os=require('node:os');console.log(JSON.stringify({freeBytes:os.freemem(),totalBytes:os.totalmem(),rssBytes:process.memoryUsage().rss}))";if($LASTEXITCODE -ne 0){throw 'Memory probe failed'};$record.memory=$probe|ConvertFrom-Json;if($record.memory.freeBytes -lt 1GB){throw 'Actual memory pressure; process not started'}
 foreach($testPath in $tests){if(!(Test-Path -LiteralPath (Join-Path $repoRoot $testPath))){throw 'Refuse partial test selection'}}
 $record.sourceParent=(& git -C $repoRoot rev-parse HEAD)
 $paths=@('packages/runtime/objective-generation-custody.mjs','apps/worker/conversation/activity.mjs','apps/worker/conversation/options.mjs','apps/worker/conversation/continuation/activity-lifecycle.mjs','apps/control/conversations/completion-journal.mjs','apps/runtime/native-authority/completion-capture.mjs','apps/runtime/native-authority/checkpoint-http.mjs','docs/qualification/candidates/dot-strategy-custody-20261016/dependency-seams.mjs','docs/qualification/candidates/dot-strategy-custody-20261016/sdk-seam.mjs','docs/qualification/candidates/dot-strategy-custody-20261016/run-controls.ps1')
 $paths+=@($tests)+@('apps/control/conversations/test/typed-completion-fixture.mjs')
 $paths+=@(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'apps/worker/conversation/objective-generation'),(Join-Path $repoRoot 'apps/runtime/objective-generation') -Recurse -File | ForEach-Object {[IO.Path]::GetRelativePath($repoRoot,$_.FullName)})
 $record.sourceFiles=@($paths|ForEach-Object {@{path=$_;sha256=(Get-FileHash -LiteralPath (Join-Path $repoRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()}})
 $quoted=@($nodeArguments|ForEach-Object {'"'+$_+'"'});$process=Start-Process -FilePath $nodePath -ArgumentList $quoted -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $watch=[Diagnostics.Stopwatch]::StartNew();$peak=0L
 while(!$process.WaitForExit(20) -and $watch.ElapsedMilliseconds -lt 30000){$process.Refresh();$peak=[Math]::Max($peak,$process.WorkingSet64);if($peak -gt 256MB){break}}
 $complete=$process.HasExited;if(!$complete){$process.Kill($true);$process.WaitForExit()};$record.exitCode=$process.ExitCode;$record.limitStopped=(!$complete);$record.sampledPeakWorkingSetBytes=$peak;$record.elapsedMs=$watch.ElapsedMilliseconds
 if(!$complete -or $process.ExitCode -ne 0){throw 'Focused controls failed; outputs preserved'}
}finally{if($process -and !$process.HasExited){$process.Kill($true);$process.WaitForExit()};$record.cleanup=@{ownedProcessExited=($null -eq $process -or $process.HasExited);servicesCreated=0;portsCreated=0};$record.finishedAt=[DateTimeOffset]::UtcNow.ToString('o');$record|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $metadata -Encoding utf8;if($process){$process.Dispose()}}
