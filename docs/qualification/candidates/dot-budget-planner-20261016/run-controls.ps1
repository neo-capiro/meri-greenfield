param([switch]$Help,[switch]$Supplemental,[switch]$MemoryScope,[switch]$ModelGrants,[switch]$IntentDdl)
if($Help) { Write-Output 'Usage: run-controls.ps1 [-Supplemental | -MemoryScope | -ModelGrants | -IntentDdl] [-Help]. Runs synthetic controls serially; temporarily reverts owned source and restores exact bytes. Supplemental runs adapter/DDL controls only. MemoryScope runs retained-firm-scope before/after controls only. ModelGrants runs issuer/store/purpose controls only. IntentDdl runs canonical journal and allocated DDL controls only. Exit 0: expected outcomes; exit 1: check/setup failure. No infrastructure or dependency installation.'; return }
if(@(@($Supplemental,$MemoryScope,$ModelGrants,$IntentDdl) | Where-Object { $_.IsPresent }).Count -gt 1) { throw 'Choose one focused control mode' }
$ErrorActionPreference = 'Stop'
$evidenceRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $evidenceRoot '../../../..')).Path
$nodePath = (Get-Command node).Source
$pythonPath = (Get-Command python).Source
$runs = [System.Collections.Generic.List[object]]::new()
$restorations = [System.Collections.Generic.List[object]]::new()
$seam = './docs/qualification/candidates/dot-budget-planner-20261016/dependency-seams.mjs'
function Invoke-Control([string]$name,[string]$executable,[string[]]$arguments,[bool]$negative=$false) {
 $stdout = Join-Path $evidenceRoot ($name+'.stdout.txt')
 $stderr = Join-Path $evidenceRoot ($name+'.stderr.txt')
 $started = [DateTimeOffset]::UtcNow
 $quotedArguments = @($arguments | ForEach-Object { if($_.Contains('"')) { throw 'Unexpected quote in fixed control argument' }; '"'+$_+'"' })
 $process = Start-Process -FilePath $executable -ArgumentList $quotedArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
 $watch = [Diagnostics.Stopwatch]::StartNew();$peak=0L
 while (!$process.WaitForExit(20) -and $watch.ElapsedMilliseconds -lt 30000) { $process.Refresh();$peak=[Math]::Max($peak,$process.WorkingSet64);if($peak -gt 256MB) { break } }
 $complete = $process.HasExited
 if (!$complete) { $process.Kill($true); $process.WaitForExit() }
 $process.Refresh()
 $runs.Add(@{name=$name;arguments=$arguments;negative=$negative;exitCode=$process.ExitCode;timedOut=(!$complete);elapsedMs=([DateTimeOffset]::UtcNow-$started).TotalMilliseconds;sampledPeakWorkingSetBytes=$peak;stdout=[IO.Path]::GetFileName($stdout);stderr=[IO.Path]::GetFileName($stderr)})
 if (!$negative -and (!$complete -or $process.ExitCode -ne 0)) { throw "Control failed: $name" }
 if ($negative -and $complete -and $process.ExitCode -eq 0) { throw "Negative control did not fail: $name" }
}
function With-Source([hashtable]$replacements,[scriptblock]$body) {
 $saved=@{}
 try {
  foreach ($path in $replacements.Keys) {
   $absolute=Join-Path $repoRoot $path
   $saved[$absolute]=[IO.File]::ReadAllBytes($absolute)
   [IO.File]::WriteAllText($absolute,$replacements[$path],[Text.UTF8Encoding]::new($false))
  }
  & $body
 } finally { foreach ($absolute in $saved.Keys) {
  [IO.File]::WriteAllBytes($absolute,$saved[$absolute])
  $expected=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($saved[$absolute])).ToLowerInvariant()
  $actual=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant()
  $restorations.Add(@{path=[IO.Path]::GetRelativePath($repoRoot,$absolute);sha256=$actual;byteExact=($expected -eq $actual)})
  if($expected -ne $actual) { throw 'Owned source restoration failed' }
 } }
}
function Baseline([string]$path,[string]$ref='eca78d458acb46cbfd54a94cf870841d999ef6b1') {
 $lines = & git -C $repoRoot show ($ref+':'+$path)
 if ($LASTEXITCODE -ne 0) { throw "Cannot read pinned source: $path" }
 return ($lines -join "`n")+"`n"
}
$common=@('--max-old-space-size=128','--experimental-test-module-mocks','--import',$seam,'--test','--test-isolation=none','--test-concurrency=1')
try {
 if($IntentDdl) {
  Invoke-Control 'intent-ddl-after' $nodePath ($common+@('apps/control/intents/test/postgres-journal.test.mjs','apps/control/intents/test/migration-source.test.mjs'))
  return
 }
 if($ModelGrants) {
  $modelCommon=@('--max-old-space-size=128','--experimental-test-module-mocks','--import','./docs/qualification/candidates/dot-budget-planner-20261016/model-grant-dependency-seams.mjs','--test','--test-isolation=none','--test-concurrency=1')
  Invoke-Control 'model-issuer-after' $nodePath ($modelCommon+@('apps/runtime/test/model-grant-issuer.test.mjs','apps/runtime/test/model-grant-store.test.mjs','apps/runtime/test/run-model-grant.test.mjs'))
  return
 }
 if($MemoryScope) {
  With-Source @{'apps/control/memory/producer.mjs'=(Baseline 'apps/control/memory/producer.mjs' '89aaff209217bc86e49c866c57d83a2f6bd6590a')} {
   Invoke-Control 'memory-scope-before' $nodePath ($common+@('--test-name-pattern=removed proposal permission','apps/control/memory/test/producer.test.mjs')) $true
  }
  Invoke-Control 'memory-scope-after' $nodePath ($common+@('apps/control/memory/test/producer.test.mjs'))
  return
 }
 if($Supplemental) {
  Invoke-Control 'adapter-after' $nodePath ($common+@('apps/control/intents/test/postgres-journal.test.mjs','apps/control/intents/test/result-release.test.mjs','apps/control/memory/test/migration-source.test.mjs'))
  Invoke-Control 'source-proof-after-ddl' $nodePath @('--max-old-space-size=128','--test','--test-isolation=none','scripts/qualification/assembled-image/source-proof.test.mjs')
  return
 }
 With-Source @{'apps/control/memory/producer.mjs'=(Baseline 'apps/control/memory/producer.mjs')} {
  Invoke-Control 'memory-before' $nodePath ($common+@('--test-name-pattern=correction lost ACK|correction replay after','apps/control/memory/test/producer.test.mjs')) $true
 }
 Invoke-Control 'memory-after' $nodePath ($common+@('apps/control/memory/test/producer.test.mjs'))
 $mount=[IO.File]::ReadAllText((Join-Path $repoRoot 'apps/control/intents/mount.mjs'))
 $bypass=$mount.Replace('if(begun.replayed)return await release.release({...selected,owner:preparer.owner,result:begun.result,original:begun.release});','if(begun.replayed)return begun.result;')
 if ($mount -eq $bypass) { throw 'Replay ablation did not match' }
 With-Source @{'apps/control/intents/mount.mjs'=$bypass} {
  Invoke-Control 'intent-replay-before' $nodePath ($common+@('--test-name-pattern=revoked client on retained|original authority expiry|legacy retained','apps/control/intents/test/result-release.test.mjs')) $true
 }
 With-Source @{'apps/worker/conversation/intents/prepared.mjs'=(Baseline 'apps/worker/conversation/intents/prepared.mjs')} {
  Invoke-Control 'intent-worker-before' $nodePath ($common+@('--test-name-pattern=worker rejects','apps/control/intents/test/result-release.test.mjs')) $true
 }
 Invoke-Control 'intent-after' $nodePath ($common+@('apps/control/intents/test/result-release.test.mjs'))
 With-Source @{'apps/proxy/qualification/state/ledger.py'=(Baseline 'apps/proxy/qualification/state/ledger.py');'apps/proxy/qualification/state/admission.py'=(Baseline 'apps/proxy/qualification/state/admission.py')} {
  Invoke-Control 'proxy-before' $pythonPath @('-B','-m','unittest','apps.proxy.qualification.test.test_product_budget.ProductBudgetTests.test_product_model_reserves_same_combined_liability_and_run_cap','apps.proxy.qualification.test.test_product_budget.ProductBudgetTests.test_current_product_admission_uses_product_run_and_grant_rows') $true
 }
 Invoke-Control 'proxy-after' $pythonPath @('-B','-m','unittest','apps.proxy.qualification.test.test_product_budget','apps.proxy.qualification.test.test_tool_budget_source','apps.proxy.qualification.test.test_ingress.StateTests')
 $tenantPath='apps/gateway/budget/tenant/native-admission.mjs';$tenant=[IO.File]::ReadAllText((Join-Path $repoRoot $tenantPath))
 With-Source @{$tenantPath=$tenant.Replace('if(unresolved===0)','if(true)')} {
  Invoke-Control 'tenant-unknown-before' $nodePath @('--max-old-space-size=128','--test','--test-isolation=none','--test-name-pattern=cancellation/revocation','apps/gateway/budget/tenant/test/native-admission.test.mjs') $true
 }
 Invoke-Control 'tenant-after' $nodePath @('--max-old-space-size=128','--test','--test-isolation=none','--test-concurrency=1','apps/gateway/budget/tenant/test/native-admission.test.mjs','apps/gateway/budget/tenant/test/tenant-budget-gate.test.mjs')
 Invoke-Control 'model-grant-after' $nodePath @('--max-old-space-size=128','--test','--test-isolation=none','apps/runtime/test/run-model-grant.test.mjs')
 Invoke-Control 'source-proof' $nodePath @('--max-old-space-size=128','--test','--test-isolation=none','scripts/qualification/assembled-image/source-proof.test.mjs')
} finally {
 $resultFile=if($IntentDdl){'intent-ddl-controls.json'}elseif($ModelGrants){'model-grant-controls.json'}elseif($MemoryScope){'memory-scope-controls.json'}elseif($Supplemental){'supplemental-controls.json'}else{'controls.json'}
 $note=if($ModelGrants){'Model controls mock canonical JSON/schema and artifact/native validator imports; execute real issuer/store code with fixed synthetic material and scripted ports. No live qualification.'}else{'memory/intent controls mock hash/schema/preparer dependency seams; remaining controls use built-ins and scripted ports. No live qualification.'}
 @{base='eca78d458acb46cbfd54a94cf870841d999ef6b1';synthetic=$true;note=$note;runs=$runs;restorations=$restorations} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $evidenceRoot $resultFile) -Encoding utf8
}
