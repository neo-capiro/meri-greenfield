param([switch]$Help,[ValidateSet('modules','workflow','types','bundle')][string]$Stage,[ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedSource,[ValidatePattern('^[a-z][a-z0-9-]{0,63}$')][string]$Name)
if($Help -or !$Stage -or !$ExpectedSource -or !$Name){Write-Output 'PREPARED, UNRUN. Shipping must first admit the exact source/stage/resources. Usage: run-profile.ps1 -Stage modules|workflow|types|bundle -ExpectedSource 40hex -Name unused-proof-name. Runs one fixed Node command, no install/services/ports; timeout/memory breach kills owned process tree. Exit0 pass, exit1 failure; previous proof cannot be overwritten.';return}
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$profile=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'profile.json')|ConvertFrom-Json
$selected=$profile.stages.$Stage
$nodePath=(Get-Command node).Source
$stdout=Join-Path $PSScriptRoot ($Name+'.stdout.txt');$stderr=Join-Path $PSScriptRoot ($Name+'.stderr.txt');$metadata=Join-Path $PSScriptRoot ($Name+'.json')
if((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr) -or (Test-Path -LiteralPath $metadata)){throw 'Preserve existing proof; choose an unused Name'}
$record=@{stage=$Stage;source=$ExpectedSource;argv=@($selected.argv);heapMiB=$selected.heapMiB;hardWallMs=$selected.hardWallMs;workingSetLimitMiB=$selected.workingSetLimitMiB;expectedTests=$selected.expectedTests;processCount=1;services=0;ports=@();pgConnections=0;startedAt=[DateTimeOffset]::UtcNow.ToString('o');status='STARTING'}
$process=$null
try{
 $actual=& git -C $repoRoot rev-parse HEAD;if($LASTEXITCODE -ne 0 -or $actual -ne $ExpectedSource){throw 'Exact reviewed integrated source required'}
 & git -C $repoRoot diff --quiet HEAD -- apps packages docs/qualification/candidates/dot-planner-native-20261016;if($LASTEXITCODE -ne 0){throw 'Application/profile source is dirty'}
 foreach($path in ($selected.argv|Where-Object {$_ -match '\.(?:mjs|json)$' -or $_ -like '*/bin/tsc'})){if(!(Test-Path -LiteralPath (Join-Path $repoRoot $path))){throw ('Required source/dependency missing: '+$path)}}
 $probe=& $nodePath --max-old-space-size=64 -e "const os=require('node:os');console.log(JSON.stringify({version:process.version,executable:process.execPath,freeBytes:os.freemem(),totalBytes:os.totalmem(),rssBytes:process.memoryUsage().rss}))"
 if($LASTEXITCODE -ne 0){throw 'Fresh memory/version probe failed'}
 $record.memory=$probe|ConvertFrom-Json;if($record.memory.version -notmatch '^v24\.'){throw 'Requires verified Node24'}
 if($record.memory.freeBytes -lt (($selected.workingSetLimitMiB*1MB)+1GB)){throw 'Memory pressure; test process not started'}
 $record.manifests=@('package.json','package-lock.json','apps/runtime/package.json','apps/runtime/package-lock.json','apps/control/conversations/package.json','apps/control/conversations/package-lock.json')|ForEach-Object {@{path=$_;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot $_)).Hash.ToLowerInvariant()}}
 $argsQuoted=@($selected.argv|ForEach-Object {'"'+$_+'"'})
 $process=Start-Process -FilePath $nodePath -ArgumentList $argsQuoted -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $watch=[Diagnostics.Stopwatch]::StartNew();$peak=0L
 while(!$process.WaitForExit(20) -and $watch.ElapsedMilliseconds -lt $selected.hardWallMs){$process.Refresh();$peak=[Math]::Max($peak,$process.WorkingSet64);if($peak -gt ($selected.workingSetLimitMiB*1MB)){break}}
 $complete=$process.HasExited;if(!$complete){$process.Kill($true);$process.WaitForExit()}
 $record.exitCode=$process.ExitCode;$record.limitStopped=(!$complete);$record.elapsedMs=$watch.ElapsedMilliseconds;$record.sampledPeakWorkingSetBytes=$peak
 if(!$complete -or $process.ExitCode -ne 0){throw 'Native profile failed; raw result retained'}
 if($selected.expectedTests -gt 0 -and !((Get-Content -Raw -LiteralPath $stdout) -match ('\btests\s+'+$selected.expectedTests+'\b'))){throw 'Unexpected test selection/count; no pass claim'}
 $record.status='PASS'
}catch{$record.status='FAILED_OR_UNRUN';throw}finally{
 if($process -and !$process.HasExited){$process.Kill($true);$process.WaitForExit()}
 $record.cleanup=@{ownedProcessExited=($null -eq $process -or $process.HasExited);servicesCreated=0;portsCreated=0};$record.finishedAt=[DateTimeOffset]::UtcNow.ToString('o')
 $record|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $metadata -Encoding utf8
 if($process){$process.Dispose()}
}
