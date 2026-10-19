$ErrorActionPreference='Stop'
$evidence=Join-Path $PSScriptRoot 'ml-proof-pr193-retention/docs/integration/pr193-retention-build-20261019'
$destination=Join-Path $evidence 'windows-upload-verification'
if(Test-Path -LiteralPath $destination){throw 'VERIFICATION_OUTPUT_EXISTS'}
$baselinePath=Join-Path $evidence 'windows-upload-readbacks/secret-label-metadata.json'
if((Get-FileHash -LiteralPath $baselinePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '37853ca911277baefbce225c5317313177d46f6bd9029ee6dd04bdab81126aa2'){throw 'BASELINE_HASH_REFUSED'}
$baseline=@(Get-Content -LiteralPath $baselinePath -Raw|ConvertFrom-Json)
$tokens=[ordered]@{control='fa20782d-aa2e-4a9f-96d5-5a280c7f6006';'temporal-worker'='57ec3646-a266-4bf8-8d8b-0f612ec2f539';'temporal-issuer'='82665233-c946-4f4d-a3b7-c83c7530bf36';'model-owner'='290f3f19-1dcf-4046-b629-0a116b79fe1b';'model-proxy'='e8794017-6bd2-4932-89d1-2441ad8296d2'}
$label='FIRST_CHAT_20261019D'
function Save-Public([string]$Name,$Value){[IO.File]::WriteAllText((Join-Path $destination $Name),(ConvertTo-Json -InputObject $Value -Depth 30)+"`n",[Text.UTF8Encoding]::new($false))}
function Read-Aws([string[]]$Arguments){
 $raw=& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' --profile default --region us-east-1 --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 @Arguments --output json
 if($LASTEXITCODE -ne 0){throw 'PUBLIC_AWS_READ_FAILED'}
 return ($raw|ConvertFrom-Json)
}
function Stages($Values){return (ConvertTo-Json -InputObject @($Values|Where-Object{$null-ne $_}|Sort-Object -CaseSensitive) -Compress)}
$started=[DateTime]::UtcNow.ToString('o')
$caller=Read-Aws @('sts','get-caller-identity','--query','{account:Account,arn:Arn}')
if($caller.account -cne '967807252336' -or $caller.arn -cne 'arn:aws:iam::967807252336:user/jump-cli'){throw 'CALLER_REFUSED'}
[IO.Directory]::CreateDirectory($destination)|Out-Null
Save-Public 'caller.json' $caller
$records=@()
foreach($role in $tokens.Keys){
 $old=@($baseline|Where-Object{$_.role-ceq $role})
 if($old.Count-ne 1){throw 'BASELINE_ROLE_REFUSED'}
 $old=$old[0];$arn=$old.arn;$token=$tokens[$role]
 $before=Read-Aws @('secretsmanager','describe-secret','--secret-id',$arn,'--query','{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages,deletedDate:DeletedDate}')
 $versions=@();$next=$null;$pages=0;$seenTokens=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 do{
  $arguments=@('secretsmanager','list-secret-version-ids','--secret-id',$arn,'--include-deprecated','--no-paginate','--max-results','100','--query','{arn:ARN,versions:Versions[].{id:VersionId,stages:VersionStages},nextToken:NextToken}')
  if($null-ne $next){$arguments+=@('--next-token',$next)}
  $page=Read-Aws $arguments
  if($page.arn-cne $arn){throw 'ARN_REFUSED'}
  $versions+=@($page.versions);$pages++;$next=$page.nextToken
  if($pages-gt 20 -or $versions.Count-gt 1000){throw 'PAGINATION_BOUND'}
  if($null-ne $next -and (-not $seenTokens.Add($next) -or $pages-ge 20)){throw 'PAGINATION_REFUSED'}
 }while($null-ne $next)
 $after=Read-Aws @('secretsmanager','describe-secret','--secret-id',$arn,'--query','{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages,deletedDate:DeletedDate}')
 if((ConvertTo-Json $before -Depth 20 -Compress)-cne (ConvertTo-Json $after -Depth 20 -Compress)){throw 'METADATA_CHANGED_DURING_READ'}
 if($after.arn-cne $arn -or $after.kms-cne $old.metadata.kms -or $null-ne $after.deletedDate){throw 'SECRET_IDENTITY_OR_KEY_CHANGED'}
 if(@($versions.id|Select-Object -Unique).Count-ne $versions.Count){throw 'DUPLICATE_VERSION'}
 foreach($v in $versions){
  $described=@($after.versions.PSObject.Properties|Where-Object{$_.Name-ceq $v.id})
  if($described.Count-eq 0){if(@($v.stages|Where-Object{$null-ne $_}).Count-gt 0){throw 'VERSION_LIST_DESCRIPTION_MISMATCH'}}
  elseif($described.Count-ne 1 -or (Stages $described[0].Value)-cne (Stages $v.stages)){throw 'VERSION_LIST_DESCRIPTION_MISMATCH'}
 }
 foreach($p in $after.versions.PSObject.Properties){if(@($versions|Where-Object{$_.id-ceq $p.Name}).Count-ne 1){throw 'DESCRIBED_VERSION_MISSING'}}
 foreach($v in $old.listedVersions){
  $current=@($versions|Where-Object{$_.id-ceq $v.id})
  if($current.Count-ne 1 -or (Stages $current[0].stages)-cne (Stages $v.stages)){throw 'ORIGINAL_VERSION_OR_STAGE_CHANGED'}
 }
 $new=@($versions|Where-Object{$old.listedVersions.id-cnotcontains $_.id})
 if($new.Count-ne 1 -or $new[0].id-cne $token -or (Stages $new[0].stages)-cne (Stages @($label))){throw 'EXACT_NEW_VERSION_REFUSED'}
 $labelled=@($versions|Where-Object{$_.stages-ccontains $label})
 $current=@($versions|Where-Object{$_.stages-ccontains 'AWSCURRENT'})
 $oldCurrent=@($old.listedVersions|Where-Object{$_.stages-ccontains 'AWSCURRENT'})
 if($labelled.Count-ne 1 -or $labelled[0].id-cne $token -or $current.Count-ne 1 -or $oldCurrent.Count-ne 1 -or $current[0].id-cne $oldCurrent[0].id){throw 'LABEL_OR_CURRENT_REFUSED'}
 $records+=[ordered]@{role=$role;arn=$arn;versionId=$token;metadata=$after;listedVersions=$versions;pages=$pages;versionCount=$versions.Count;originalVersionCount=@($old.listedVersions).Count;originalVersionsAndStagesPreserved=$true;currentAndKmsPreserved=$true;exactlyOneApprovedAddition=$true}
}
Save-Public 'secret-version-metadata.json' $records
Save-Public 'verification-summary.json' ([ordered]@{schemaVersion=1;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');account='967807252336';region='us-east-1';label=$label;roles=5;baselineSha256='37853ca911277baefbce225c5317313177d46f6bd9029ee6dd04bdab81126aa2';approvedManifestSha256='870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50';renderReceiptSha256='99b01a2ea89e25162fc03a63fca6541d28e926a2e129026a0a2189ee7bd4b649';uploadStateSha256='3918eb073034231b85c0576ba6e4455ada69466604feaffd41594618f16e2d1e';secretVersionsSha256='8cb6bac16a69bfb4b88a561e66273846b6bb1baf532ba7edfcf9e532ee93e257';allVersionIdsMatchNeoReceipt=$true;allOriginalVersionsAndStagesPreserved=$true;allCurrentAndKmsPreserved=$true;privateValuesRead=$false;mutations=0})
[Console]::WriteLine('PR193_UPLOAD_METADATA_VERIFIED_5_ROLES_HISTORY_PRESERVED')
