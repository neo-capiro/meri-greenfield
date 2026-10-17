/** Shared direct synthetic control configuration. No WindowResolution, server, credential read or source effect. */
import {normalize,resolve} from 'node:path';
import {productFixture,NOW} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {runOwnerOperations} from '../../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../../packages/contracts/runtime-0.2/session.mjs';
const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
export function productControlFixture(){
 const seed=productFixture(),model=seed.context(),binding=model.binding,q=model.qualificationBinding;
 const clientId=id(5),staticBinding={...binding,conversationId:id(90),runId:id(91),attemptId:id(92),workerId:id(93),writerFence:1};
 const c={identity:{origin:'https://authority.synthetic.invalid',credentialFile:'/run/meri/identity',commandContext:{binding:staticBinding,clientResolution:{reference:clientId,clientId}}},
  runtime:{binding:staticBinding,versions,proxyUrl:'https://proxy.synthetic.invalid',model:'synthetic',deadlineMs:NOW+60000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1},
  proxyCredentialFile:'/run/meri/proxy',plan:{purpose:'synthetic-placement'},preparationIntent:{workspace:normalize('/workspace/'+staticBinding.conversationId),configParentDirectory:normalize('/tmp/sdk-config'),secureStorageDirectory:normalize('/tmp/sdk-secure'),launchTemplate:{command:normalize('/usr/bin/node'),args:[],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:normalize('/tmp/sdk-secure')}},executableSha256:'a'.repeat(64),imageSha256:versions.imageDigest.slice(7),runnerSha256:'b'.repeat(64),sdkOptionsSha256:'c'.repeat(64),authoritySha256:'d'.repeat(64)},
  grantIntents:[{grantId:id(99),capabilitySha256:'a'.repeat(64),expiresAtMs:NOW+60000}],grantId:id(99),operations:[...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op)],taskCapabilityFile:'/run/meri/task',controlCapabilityFile:'/run/meri/control',containerName:'worker',taskOrigin:'https://control.synthetic.invalid',taskHttp:{hostname:'0.0.0.0',port:8080,frontendOrigin:'https://control.synthetic.invalid'},objects:{bucket:'meri-synthetic',prefix:'synthetic',expectedBucketOwner:'967807252336',kmsKeyId:'arn:aws:kms:us-east-1:967807252336:key/11111111-1111-4111-8111-111111111111'}};
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},native:{origin:'https://control.synthetic.invalid',capabilityFile:c.controlCapabilityFile,loopback:false,maxResponseBytes:2097152},http:{hostname:'0.0.0.0',port:8080,frontendOrigin:'https://frontend.synthetic.invalid'},database:{connectionFile:'/run/meri/database'},temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri-first',taskQueue:'meri-v1',tls:{caFile:'/run/meri/ca',certFile:'/run/meri/cert',keyFile:'/run/meri/key'}},sessions:{mode:'process-local',replicas:1,maxSessions:10,maxTtlMs:300000},versions,nativeCandidate:c};
 c.runtime.binding=staticBinding;c.identity.commandContext.binding=staticBinding;c.runtime.deadlineMs=NOW+60000;
 c.preparationIntent.workspace=normalize('/workspace/'+staticBinding.conversationId);
 for(const name of ['configParentDirectory','secureStorageDirectory'])c.preparationIntent[name]=normalize(c.preparationIntent[name]);
 c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;
 c.multiRun={runWindowMs:60000,materialDirectory:resolve('synthetic-placement-material'),dynamicInitialRuns:true};
 c.qualification={attempt:q.attempt,policyRevision:q.policyRevision};
 c.preparationIntent.authoritySha256=hash({scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:q.policyRevision}],selectedClientId:clientId,policyRevision:q.policyRevision});
 const configuredAllocation=structuredClone(seed.allocation);configuredAllocation.run=Object.fromEntries(Object.keys(configuredAllocation.run).map(k=>[k,staticBinding[k]]));
 configuredAllocation.schedule.expiresAt=new Date(NOW+60000).toISOString();c.allocationJson=JSON.stringify(configuredAllocation);
 c.grantIntents=c.grantIntents.map(g=>({...g,expiresAtMs:NOW+60000}));
 c.taskRequest={cluster:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinition:'arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:1',networkConfiguration:{awsvpcConfiguration:{subnets:['subnet-12345678'],securityGroups:['sg-12345678'],assignPublicIp:'DISABLED'}},overrides:{containerOverrides:[{name:'worker',command:['start'],environment:[]}]}};
 c.taskOrigin=configuration.native.origin;c.taskHttp.frontendOrigin=c.taskOrigin;
 configuration.privateHttp={hostname:'0.0.0.0',port:8082,frontendOrigin:configuration.native.origin};
 configuration.taskRouter={enabled:true,runnerCaFile:'/run/meri/runner-ca.pem',zone:'runner.synthetic.invalid',vpcId:'vpc-12345678'};
 return {configuration,seed,model,binding,clientId,qualification:q};
}
