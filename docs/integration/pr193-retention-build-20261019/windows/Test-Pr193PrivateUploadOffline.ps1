# Focused fake-bundle / metadata / argv checks. No AWS executable or real private input is invoked/read.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Pr193Common.ps1')
. (Join-Path $PSScriptRoot 'Invoke-Pr193PrivateUpload.ps1')
$script:realAwsAdapter=${function:Invoke-Pr193UploadAws}
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('pr193-upload-fake-'+[Guid]::NewGuid().ToString('N'))
$expectedParent=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
$script:checkCount=0
function Check([bool]$Condition,[string]$Code){if(-not $Condition){throw $Code};$script:checkCount++}
function Refuses([scriptblock]$Action,[string]$Code){$failed=$false;try{& $Action|Out-Null}catch{if($_.Exception.Message-cne $Code){[Console]::WriteLine('FAKE_EXPECTED_'+$Code+'; actual='+$_.Exception.Message)};Check ($_.Exception.Message -ceq $Code) 'WRONG_REFUSAL';$failed=$true};Check $failed 'EXPECTED_REFUSAL'}
function New-FakeContext([string]$Name){
 $work=Join-Path $scratch $Name;New-Pr193PrivateDirectory $work
 [IO.Directory]::CreateDirectory((Join-Path $work 'rendered'))|Out-Null
 [IO.File]::WriteAllText((Join-Path $work 'stage3.json'),'{"fake":true}')
 [IO.File]::WriteAllText((Join-Path $work 'rendered/summary.json'),'{"fake":true}')
 $roles=@()
 foreach($role in $script:Pr193UploadRoleKeys.Keys){
  $relative='rendered/'+$role+'/bundle.json';$file=Join-Path $work $relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file))|Out-Null
  [IO.File]::WriteAllText($file,'{"synthetic":"FAKE_SECRET_CANARY"}')
  $roles += [pscustomobject]@{role=$role;bundleRelativePath=$relative;bytes=(Get-Item -LiteralPath $file).Length;sha256=Get-Pr193Sha256 $file}
 }
 $receipt=[ordered]@{schemaVersion=1;sourceCommit=$script:Pr193UploadPins.Source;packetCommit=$script:Pr193UploadPins.Packet;readbackCommit=$script:Pr193UploadPins.Readback;readbackManifestSha256=$script:Pr193UploadPins.Manifest;runtimeValuesSha256=$script:Pr193UploadPins.Runtime;deploymentInputsSha256=$script:Pr193UploadPins.Deployment;packetManifestSha256='2c7b60d898ce4356348d510e203ee69d5969f00176b03add3dd43d3b6c9d51f2';policySha256='e338c50e1f3f4eede1943466024b6eff36e9a85a527339b4c9dbe752e65d88fe';allocationSha256='8caf70039edab43b1f5665c8555ef3189aa546da1fbf722c5563a82ff0788195';stage3Sha256=Get-Pr193Sha256 (Join-Path $work 'stage3.json');summarySha256=Get-Pr193Sha256 (Join-Path $work 'rendered/summary.json');roles=$roles}
 Write-Pr193UploadJson (Join-Path $work 'local-render-receipt.json') $receipt -CreateOnly
 # Test-only approved manifest. Production has a fixed hash and no CLI override.
 $approved=[ordered]@{schemaVersion=1;account='967807252336';region='us-east-1';label=$script:Pr193UploadPins.Label}
 foreach($key in $receipt.Keys){if($key-ne 'schemaVersion' -and $key-ne 'roles'){$approved[$key]=$receipt[$key]}}
 $deployment=Read-Pr193UploadJson (Join-Path $cache ('packet-'+$script:Pr193UploadPins.Packet+'/public-candidate/deployment-inputs.candidate.json'))
 $approved.roles=@($roles|ForEach-Object {[ordered]@{role=$_.role;arn=$deployment.secrets.($script:Pr193UploadRoleKeys[$_.role]);bundleRelativePath=$_.bundleRelativePath;bytes=$_.bytes;sha256=$_.sha256}})
 $approvedPath=Join-Path $scratch 'NEO-UPLOAD-MANIFEST.json'
 if(-not (Test-Path -LiteralPath $approvedPath)){Write-Pr193UploadJson $approvedPath $approved -CreateOnly}
 $script:Pr193UploadPins.ApprovedManifest=Get-Pr193Sha256 $approvedPath
 $script:Pr193UploadDirectory=$scratch
 return Get-Pr193UploadContext $work $cache $script:Pr193UploadPins.Readback "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" 'FAKE_PROFILE'
}
function Reset-FakeCloud($Context){
 $script:cloud=@{};$script:calls=@();$script:putMode='NONE';$script:putCount=0;$script:pageLoop=$false
 foreach($role in $Context.Roles){$script:cloud[$role.arn]=[pscustomobject]@{kms=$role.kms;versions=@([pscustomobject]@{id=$role.originalCurrent;stages=@('AWSCURRENT')},[pscustomobject]@{id='00000000-0000-4000-8000-000000000002';stages=@('FIRST_CHAT_PRIOR')})}}
}
function Invoke-Pr193UploadAws($Context,[string[]]$OperationArguments){
 $op=$OperationArguments[1];$arn=if($OperationArguments -contains '--secret-id'){$OperationArguments[[Array]::IndexOf($OperationArguments,'--secret-id')+1]}else{$null}
 $script:calls += [pscustomobject]@{op=$op;args=$OperationArguments}
 switch($op){
  'get-caller-identity' {return [pscustomobject]@{account='967807252336'}}
  'describe-secret' {
   $v=[ordered]@{};foreach($row in $script:cloud[$arn].versions){if($row.stages.Count){$v[$row.id]=$row.stages}}
   return [pscustomobject]@{arn=$arn;kms=$script:cloud[$arn].kms;versions=[pscustomobject]$v}
  }
  'list-secret-version-ids' {
   Check ($OperationArguments -ccontains '--no-paginate' -and $OperationArguments -ccontains '--max-results') 'PAGINATION_NOT_EXPLICIT'
   if($OperationArguments -contains '--next-token'){
    return [pscustomobject]@{arn=$arn;versions=$script:cloud[$arn].versions;nextToken=$(if($script:pageLoop){'PAGE2'}else{$null})}
   }
   return [pscustomobject]@{arn=$arn;versions=@([pscustomobject]@{id='00000000-0000-4000-8000-000000000001';stages=$null});nextToken='PAGE2'}
  }
  'put-secret-value' {
   $script:putCount++
   $token=$OperationArguments[[Array]::IndexOf($OperationArguments,'--client-request-token')+1]
   $stage=$OperationArguments[[Array]::IndexOf($OperationArguments,'--version-stages')+1]
   $fileUri=$OperationArguments[[Array]::IndexOf($OperationArguments,'--secret-string')+1]
   $saved=Read-Pr193UploadJson (Join-Path $Context.Work 'upload-state.json')
   $row=@($saved.roles|Where-Object {$_.arn-ceq $arn})[0]
   Check ($row.token-ceq $token -and $row.status-ceq 'SUBMITTING') 'TOKEN_NOT_DURABLE_BEFORE_PUT'
   Check ($stage-ceq 'FIRST_CHAT_20261019D' -and $OperationArguments -cnotcontains 'AWSCURRENT') 'UPLOAD_STAGE_CHANGED'
   Check ($fileUri-ceq ('file://'+(Join-Path $Context.Work $row.bundleRelativePath)) -and ($OperationArguments -join '|') -notmatch 'FAKE_SECRET_CANARY') 'PRIVATE_VALUE_IN_ARGV'
   $writeDenied=$false
   try{$writer=[IO.File]::Open($fileUri.Substring(7),[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::None);$writer.Dispose()}catch{$writeDenied=$true}
   Check $writeDenied 'BUNDLE_NOT_LOCKED_DURING_PUT'
   if($script:putMode-ceq 'BEFORE'){$script:putMode='NONE';throw 'UPLOAD_AWS_OUTCOME_UNCERTAIN'}
   $script:cloud[$arn].versions += [pscustomobject]@{id=$token;stages=@($stage)}
   if($script:putMode-ceq 'AFTER'){$script:putMode='NONE';throw 'UPLOAD_AWS_OUTCOME_UNCERTAIN'}
   return [pscustomobject]@{arn=$arn;versionId=$token;stages=@($stage)}
  }
  default {throw 'FAKE_UNEXPECTED_AWS_OPERATION'}
 }
}
try{
 [IO.Directory]::CreateDirectory($scratch)|Out-Null
 $cache=Join-Path $scratch 'cache';[IO.Directory]::CreateDirectory($cache)|Out-Null
 $evidence=Split-Path $PSScriptRoot -Parent
 $packet=Join-Path $cache ('packet-'+$script:Pr193UploadPins.Packet);[IO.Directory]::CreateDirectory((Join-Path $packet 'public-candidate'))|Out-Null
 Copy-Item -LiteralPath (Join-Path $evidence 'public-candidate/deployment-inputs.candidate.json') -Destination (Join-Path $packet 'public-candidate/deployment-inputs.candidate.json')
 Copy-Item -LiteralPath (Join-Path $evidence 'windows-readbacks') -Destination (Join-Path $cache ('readbacks-'+$script:Pr193UploadPins.Readback)) -Recurse
 Refuses {Invoke-Pr193PrivateUploadMain -OutputDirectory 'FAKE_PRIVATE_CANARY'} 'UPLOAD_NEO_APPROVAL_REQUIRED'
 Check (-not (Test-Path -LiteralPath (Join-Path $scratch 'upload-state.json'))) 'UNAPPROVED_STATE_CREATED'
 $context=New-FakeContext 'after-uncertainty';Reset-FakeCloud $context
 Assert-Pr193PrivateTreeAcl $context.Work
 $script:putMode='AFTER'
 Refuses {Invoke-Pr193UploadWorkflow $context} 'UPLOAD_AWS_OUTCOME_UNCERTAIN'
 $before=Read-Pr193UploadJson (Join-Path $context.Work 'upload-state.json')
 Check ($script:putCount-eq 1 -and -not (Test-Path -LiteralPath (Join-Path $context.Work 'upload-receipt.json'))) 'UNCERTAINTY_DID_NOT_STOP'
 $result=Invoke-Pr193UploadWorkflow $context
 $after=Read-Pr193UploadJson (Join-Path $context.Work 'upload-state.json')
 Check ($result-ceq 'PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY' -and $script:putCount-eq 5) 'RECOVERY_DUPLICATED_PUT'
 Check (($before.roles.token -join ',') -ceq ($after.roles.token -join ',')) 'RECOVERY_CHANGED_TOKEN'
 $receipt=Read-Pr193UploadJson (Join-Path $context.Work 'upload-receipt.json')
 Check ($receipt.status-ceq 'PR193_PRIVATE_UPLOAD_VERIFIED' -and $receipt.stateSha256-ceq (Get-Pr193Sha256 (Join-Path $context.Work 'upload-state.json')) -and $receipt.secretVersionsSha256-ceq (Get-Pr193Sha256 (Join-Path $context.Work 'secret-versions.tsv'))) 'FINAL_RECEIPT_JOIN'
 $null=Invoke-Pr193UploadWorkflow $context;Check ($script:putCount-eq 5) 'COMPLETED_RERUN_MUTATED'
 $collision=New-FakeContext 'collision'
 Refuses {Invoke-Pr193UploadWorkflow $collision} 'UPLOAD_LABEL_COLLISION'
 Check (-not (Test-Path -LiteralPath (Join-Path $collision.Work 'upload-state.json'))) 'COLLISION_CREATED_TOKENS'
 [IO.File]::WriteAllText((Join-Path $context.Work 'rendered/control/bundle.json'),'changed fake bytes')
 $callCount=$script:calls.Count
 Refuses {Get-Pr193UploadContext $context.Work $cache $script:Pr193UploadPins.Readback $context.AwsExecutable 'FAKE_PROFILE'} 'UPLOAD_BUNDLE_CHANGED'
 Check ($script:calls.Count-eq $callCount) 'CHANGED_BUNDLE_CALLED_AWS'
 $beforeContext=New-FakeContext 'before-uncertainty';Reset-FakeCloud $beforeContext;$script:putMode='BEFORE'
 Refuses {Invoke-Pr193UploadWorkflow $beforeContext} 'UPLOAD_AWS_OUTCOME_UNCERTAIN'
 $firstToken=(Read-Pr193UploadJson (Join-Path $beforeContext.Work 'upload-state.json')).roles[0].token
 $null=Invoke-Pr193UploadWorkflow $beforeContext
 $putCalls=@($script:calls|Where-Object {$_.op-ceq 'put-secret-value'})
 Check ($putCalls.Count-eq 6 -and $putCalls[0].args[[Array]::IndexOf($putCalls[0].args,'--client-request-token')+1]-ceq $firstToken -and $putCalls[1].args[[Array]::IndexOf($putCalls[1].args,'--client-request-token')+1]-ceq $firstToken) 'ABSENT_RECOVERY_NEW_TOKEN'
 $loop=New-FakeContext 'page-loop';Reset-FakeCloud $loop;$script:pageLoop=$true
 Refuses {Invoke-Pr193UploadWorkflow $loop} 'UPLOAD_PAGINATION_REFUSED'
 Check (-not (Test-Path -LiteralPath (Join-Path $loop.Work 'upload-state.json'))) 'PAGE_LOOP_CREATED_STATE'
 $current=New-FakeContext 'current-drift';Reset-FakeCloud $current
 $script:cloud[$current.Roles[0].arn].versions[0].id='00000000-0000-4000-8000-000000000099'
 Refuses {Invoke-Pr193UploadWorkflow $current} 'UPLOAD_CURRENT_OR_KEY_CHANGED'
 Check (-not (Test-Path -LiteralPath (Join-Path $current.Work 'upload-state.json'))) 'CURRENT_DRIFT_CREATED_STATE'
 foreach($mode in @('REMOVED','MOVED','FOREIGN')){
  $drift=New-FakeContext ('historical-'+$mode);Reset-FakeCloud $drift;$script:putMode='AFTER'
  Refuses {Invoke-Pr193UploadWorkflow $drift} 'UPLOAD_AWS_OUTCOME_UNCERTAIN'
  $originalState=Read-Pr193UploadJson (Join-Path $drift.Work 'upload-state.json')
  Check (@($originalState.roles[0].originalVersions).Count-eq 3) 'FULL_INITIAL_HISTORY_NOT_SAVED'
  $secret=$script:cloud[$drift.Roles[0].arn]
  if($mode-ceq 'REMOVED'){$secret.versions=@($secret.versions|Where-Object {$_.id-cne '00000000-0000-4000-8000-000000000002'})}
  if($mode-ceq 'MOVED'){@($secret.versions|Where-Object {$_.id-ceq '00000000-0000-4000-8000-000000000002'})[0].stages=@('MOVED_PRIOR_STAGE')}
  if($mode-ceq 'FOREIGN'){$secret.versions += [pscustomobject]@{id='00000000-0000-4000-8000-000000000003';stages=@()}}
  $expected=if($mode-ceq 'FOREIGN'){'UPLOAD_UNEXPECTED_VERSION'}else{'UPLOAD_ORIGINAL_VERSION_CHANGED'}
  Refuses {Invoke-Pr193UploadWorkflow $drift} $expected
  Check ($script:putCount-eq 1 -and -not (Test-Path -LiteralPath (Join-Path $drift.Work 'upload-receipt.json'))) 'HISTORY_DRIFT_DID_NOT_STOP'
  Check (((Read-Pr193UploadJson (Join-Path $drift.Work 'upload-state.json')).roles.token -join ',')-ceq ($originalState.roles.token -join ',')) 'HISTORY_DRIFT_CHANGED_TOKENS'
 }
 $capacity=New-FakeContext 'capacity';Reset-FakeCloud $capacity
 for($i=100;$i-lt 197;$i++){$script:cloud[$capacity.Roles[0].arn].versions += [pscustomobject]@{id=('00000000-0000-4000-8000-'+('{0:d12}' -f $i));stages=@()}}
 Refuses {Invoke-Pr193UploadWorkflow $capacity} 'UPLOAD_VERSION_CAPACITY_REFUSED'
 Check ($script:putCount-eq 0 -and -not (Test-Path -LiteralPath (Join-Path $capacity.Work 'upload-state.json'))) 'CAPACITY_CREATED_STATE_OR_PUT'
 $oldStateContext=New-FakeContext 'missing-history';Reset-FakeCloud $oldStateContext;$script:putMode='BEFORE'
 Refuses {Invoke-Pr193UploadWorkflow $oldStateContext} 'UPLOAD_AWS_OUTCOME_UNCERTAIN'
 $oldStatePath=Join-Path $oldStateContext.Work 'upload-state.json';$oldState=Read-Pr193UploadJson $oldStatePath
 $oldState.roles[0].PSObject.Properties.Remove('originalVersions');Write-Pr193UploadJson $oldStatePath $oldState
 Refuses {Invoke-Pr193UploadWorkflow $oldStateContext} 'UPLOAD_STATE_BINDING'
 Check ($script:putCount-eq 1) 'MISSING_HISTORY_SUBMITTED'
 $approvedMismatch=New-FakeContext 'manifest-mismatch'
 $receiptPath=Join-Path $approvedMismatch.Work 'local-render-receipt.json';$changed=Read-Pr193UploadJson $receiptPath
 $changed.summarySha256='0'*64;Write-Pr193UploadJson $receiptPath $changed
 Refuses {Get-Pr193UploadContext $approvedMismatch.Work $cache $script:Pr193UploadPins.Readback $approvedMismatch.AwsExecutable 'FAKE_PROFILE'} 'UPLOAD_APPROVED_MANIFEST_BINDING'
 function Invoke-Pr193Captured {param($FilePath,$ArgumentList,$WorkingDirectory,$TimeoutSeconds,$Environment);$script:captured=[pscustomobject]@{file=$FilePath;args=$ArgumentList;timeout=$TimeoutSeconds;environment=$Environment};return [pscustomobject]@{ExitCode=0;Stdout='{"account":"967807252336"}'}}
 $null=& $script:realAwsAdapter $current @('sts','get-caller-identity','--query','{account:Account}')
 Check ($script:captured.args[0]-ceq '--profile' -and $script:captured.args[1]-ceq 'FAKE_PROFILE' -and $script:captured.args -ccontains 'us-east-1' -and $script:captured.timeout-eq 60 -and $script:captured.environment.AWS_MAX_ATTEMPTS-ceq '1') 'AWS_ARGV_BOUNDARY'
 [Console]::WriteLine('PS51_FAKE_UPLOAD_PASS; assertions='+$script:checkCount+'; no AWS/private reads; durable same-token recovery; full historical preservation; capacity refusal; approved manifest; paginated metadata; inherited ACL; locked bundle; five exact roles')
}finally{
 $resolved=[IO.Path]::GetFullPath($scratch)
 if(-not $resolved.StartsWith($expectedParent,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved)-notlike 'pr193-upload-fake-*'){throw 'FAKE_CLEANUP_PATH_REFUSED'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
