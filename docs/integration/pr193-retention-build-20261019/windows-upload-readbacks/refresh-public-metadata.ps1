$ErrorActionPreference='Stop'
$awsExe='C:\Program Files\Amazon\AWSCLIV2\aws.exe'
$packet=Join-Path $PSScriptRoot 'ml-proof-pr193-retention/docs/integration/pr193-retention-build-20261019'
$readbackOut=Join-Path $packet 'windows-upload-readbacks'
if(Test-Path -LiteralPath $readbackOut){throw 'UPLOAD_READBACK_OUTPUT_EXISTS'}
[IO.Directory]::CreateDirectory($readbackOut)|Out-Null
$startedAt=[DateTime]::UtcNow.ToString('o')
$utf8=New-Object Text.UTF8Encoding($false)
function Save-Json([string]$Name,$Value){[IO.File]::WriteAllText((Join-Path $readbackOut $Name),($Value|ConvertTo-Json -Depth 40)+"`n",$utf8)}
function Read-Aws([string[]]$Arguments){
 $raw=& $awsExe --profile default --region us-east-1 --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 @Arguments --output json
 if($LASTEXITCODE -ne 0){throw 'PUBLIC_AWS_READ_FAILED'}
 return (($raw -join "`n")|ConvertFrom-Json)
}
$caller=Read-Aws @('sts','get-caller-identity','--query','{account:Account,arn:Arn}')
if($caller.account -ne '967807252336' -or $caller.arn -ne 'arn:aws:iam::967807252336:user/jump-cli'){throw 'CALLER_MISMATCH'}
Save-Json 'caller.json' $caller
$services=@('meri-product-preview-control','meri-product-preview-temporal-worker','meri-product-preview-temporal-issuer','meri-product-preview-owner','meri-product-preview-proxy','meri-product-preview-temporal-frontend','meri-product-preview-temporal-history','meri-product-preview-temporal-matching','meri-product-preview-temporal-internal-worker','meri-product-preview-temporal-internal-frontend')
$serviceReadback=Read-Aws (@('ecs','describe-services','--cluster','capiro-dev','--services')+$services+@('--query','{failures:failures,services:services[].{name:serviceName,arn:serviceArn,status:status,desired:desiredCount,running:runningCount,pending:pendingCount,taskDefinition:taskDefinition,deployments:deployments[].{status:status,taskDefinition:taskDefinition,rolloutState:rolloutState,desired:desiredCount,running:runningCount,pending:pendingCount}}}'))
if(@($serviceReadback.failures).Count -ne 0){throw 'SERVICE_READ_FAILURE'}
Save-Json 'live-services.json' $serviceReadback
$families=@('meri-product-preview-control','meri-product-preview-temporal-worker','meri-product-preview-temporal-issuer','meri-product-preview-owner','meri-product-preview-proxy','meri-product-preview-runner')
$rows=@();$lines=@();$latestRunner=$null
foreach($family in $families){
 foreach($status in @('ACTIVE','INACTIVE')){
  $arns=@(Read-Aws @('ecs','list-task-definitions','--family-prefix',$family,'--status',$status,'--sort','DESC','--query','taskDefinitionArns'))
  $exact=@($arns|Where-Object{$_ -match ('task-definition/'+[regex]::Escape($family)+':\d+$')})
  $arn=if($exact.Count){$exact[0]}else{'None'}
  $rows += [ordered]@{family=$family;status=$status;latestArn=$arn;observedCount=$exact.Count}
  $lines += "$family`t$arn"
  if($family -eq 'meri-product-preview-runner' -and $status -eq 'ACTIVE'){$latestRunner=$arn}
 }
}
Save-Json 'live-latest-revisions.json' @{observedAt=[DateTime]::UtcNow.ToString('o');account='967807252336';region='us-east-1';readbacks=$rows}
[IO.File]::WriteAllText((Join-Path $readbackOut 'latest.tsv'),($lines -join "`n")+"`n",$utf8)
$tasks=@()
foreach($arn in @(@($serviceReadback.services.taskDefinition)+$latestRunner|Select-Object -Unique)){
 $tasks += Read-Aws @('ecs','describe-task-definition','--task-definition',$arn,'--query','taskDefinition.{arn:taskDefinitionArn,family:family,revision:revision,status:status,runtimePlatform:runtimePlatform,containers:containerDefinitions[].{name:name,image:image,secrets:secrets[].{name:name,valueFrom:valueFrom}}}')
}
Save-Json 'live-task-metadata.json' $tasks
$imageMetadata=@()
$images=@(@($tasks|ForEach-Object{$_.containers}|ForEach-Object{$_.image})+'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49'|Select-Object -Unique)
foreach($uri in $images){
 if($uri -match '^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com/([^@]+)@(sha256:[a-f0-9]{64})$'){
  $repo=$Matches[1];$digest=$Matches[2]
  $details=Read-Aws @('ecr','describe-images','--repository-name',$repo,'--image-ids',('imageDigest='+$digest),'--query','imageDetails[].{registryId:registryId,repositoryName:repositoryName,imageDigest:imageDigest,imageTags:imageTags,imagePushedAt:imagePushedAt,imageSizeInBytes:imageSizeInBytes}')
  $imageMetadata += [ordered]@{uri=$uri;details=@($details)}
 }
}
Save-Json 'image-source-metadata.json' $imageMetadata
$stackMetadata=@()
foreach($name in @('meri-first-chat-foundation','meri-first-chat-private-edge','meri-first-chat-app','meri-first-chat-model','meri-first-chat-issuer')){
 $stackMetadata += Read-Aws @('cloudformation','describe-stacks','--stack-name',$name,'--query','Stacks[0].{name:StackName,status:StackStatus,updated:LastUpdatedTime,outputs:Outputs}')
}
Save-Json 'stack-metadata.json' $stackMetadata
$deployment=Get-Content -LiteralPath (Join-Path $packet 'public-candidate/deployment-inputs.candidate.json') -Raw|ConvertFrom-Json
$secretKeys=[ordered]@{control='control/material';'temporal-worker'='worker/material';'temporal-issuer'='issuer/material';'model-owner'='owner/material';'model-proxy'='proxy/material'}
$label='FIRST_CHAT_20261019D';$secretReadbacks=@()
foreach($role in $secretKeys.Keys){
 $arn=$deployment.secrets.($secretKeys[$role])
 $meta=Read-Aws @('secretsmanager','describe-secret','--secret-id',$arn,'--query','{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages,deletedDate:DeletedDate}')
 $versions=@();$next=$null;$pages=0;$tokens=New-Object 'System.Collections.Generic.HashSet[string]'
 do{
  $argsList=@('secretsmanager','list-secret-version-ids','--secret-id',$arn,'--include-deprecated','--no-paginate','--max-results','100','--query','{arn:ARN,versions:Versions[].{id:VersionId,stages:VersionStages},nextToken:NextToken}')
  if($null -ne $next){$argsList+=@('--next-token',$next)}
  $page=Read-Aws $argsList
  if($page.arn -ne $arn){throw 'SECRET_IDENTITY_MISMATCH'}
  $versions+=@($page.versions);$next=$page.nextToken;$pages++
  if($versions.Count -gt 1000 -or $pages -gt 20){throw 'VERSION_METADATA_BOUND'}
  if($null -ne $next -and (-not $tokens.Add($next) -or $pages -ge 20)){throw 'VERSION_PAGINATION_REFUSED'}
 }while($null -ne $next)
 $after=Read-Aws @('secretsmanager','describe-secret','--secret-id',$arn,'--query','{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages,deletedDate:DeletedDate}')
 if(($meta|ConvertTo-Json -Depth 30 -Compress) -cne ($after|ConvertTo-Json -Depth 30 -Compress)){throw 'SECRET_METADATA_CHANGED_DURING_READ'}
 $present=@($meta.versions.PSObject.Properties|Where-Object{$_.Value -ccontains $label}).Count -gt 0
 $listedPresent=@($versions|Where-Object{$_.stages -ccontains $label}).Count -gt 0
 if($present -ne $listedPresent){throw 'LABEL_METADATA_DISAGREEMENT'}
 $current=@($versions|Where-Object{$_.stages -ccontains 'AWSCURRENT'})
 if($current.Count -ne 1 -or $null -ne $meta.deletedDate){throw 'SECRET_CURRENT_UNPROVEN'}
 $secretReadbacks += [ordered]@{role=$role;arn=$arn;proposedLabel=$label;labelPresent=$present;versionCount=$versions.Count;pages=$pages;currentVersionId=$current[0].id;metadata=$meta;listedVersions=$versions}
}
Save-Json 'secret-label-metadata.json' $secretReadbacks
$baseline=Get-Content -LiteralPath (Join-Path $packet 'windows-readbacks/secret-label-metadata.json') -Raw|ConvertFrom-Json
$currentSame=$true
foreach($row in $secretReadbacks){
 $old=@($baseline|Where-Object{$_.role -eq $row.role})[0]
 $oldCurrent=@($old.metadata.versions.PSObject.Properties|Where-Object{$_.Value -contains 'AWSCURRENT'})
 if($oldCurrent.Count -ne 1 -or $oldCurrent[0].Name -cne $row.currentVersionId -or $old.metadata.kms -cne $row.metadata.kms){$currentSame=$false}
}
Save-Json 'readback-summary.json' ([ordered]@{schemaVersion=1;startedAt=$startedAt;completedAt=[DateTime]::UtcNow.ToString('o');account='967807252336';region='us-east-1';sourceCommit='5b395d4ce9218b872b21c420dc00a3af31739824';renderReadbackCommit='05b73a61cb4f2bbfa52eae38ea23e44598c33e9f';proposedLabel=$label;labelAbsentForAllFive=(@($secretReadbacks|Where-Object{$_.labelPresent}).Count -eq 0);currentAndKmsMatchRenderReadback=$currentSame;latestTsvMatchesRenderReadback=((Get-FileHash -LiteralPath (Join-Path $readbackOut 'latest.tsv') -Algorithm SHA256).Hash -ceq (Get-FileHash -LiteralPath (Join-Path $packet 'windows-readbacks/latest.tsv') -Algorithm SHA256).Hash);privateValuesRead=$false;mutations=0})
Write-Output 'PUBLIC_UPLOAD_READBACKS_COMPLETE'
