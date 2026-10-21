#!/usr/bin/env node
// OFFLINE: public inputs and exact local Git objects only. Never starts a build.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sourceCommitArgument,PROJECT_ARN,PROJECT_ROLE_ARN,MODULE,RUNNER,hash,checkedJson} from './receipt-joins.mjs';
import {createPayload,payloadKey,renderWrapper} from './measurement-payload.mjs';
const usage='Usage: node prepare-measurement.mjs --source-root ROOT --source-commit SHA40 --request REQUEST.json --product-receipt RECEIPT.json --deployment PUBLIC.json --policy POLICY.json --allocation ALLOCATION.json --baseline-commit SHA40 --baseline-path PATH --baseline-sha256 HEX64 --project-role-arn ARN --attempt HEX32 --out NEW_DIRECTORY\nThe baseline is the reviewed public deployment-inputs blob the deployment may differ from only in images.nodeRuntime and images.nodeRuntimeSourceCommit.\nOffline only. Exit 0 prepared, 2 refused.';
function args(argv){const out={};for(let i=0;i<argv.length;i+=2){assert.ok(/^--[a-z0-9-]+$/.test(argv[i])&&argv[i+1]&&!out[argv[i]]);out[argv[i]]=argv[i+1];}assert.deepEqual(Object.keys(out).sort(),['--source-root','--source-commit','--request','--product-receipt','--deployment','--policy','--allocation','--baseline-commit','--baseline-path','--baseline-sha256','--project-role-arn','--attempt','--out'].sort());return out;}
try{
 if(process.argv.includes('--help')){console.log(usage);process.exit(0);}
 const a=args(process.argv.slice(2)),root=resolve(a['--source-root']),out=resolve(a['--out']),sourceCommit=sourceCommitArgument(a['--source-commit']);
 assert.ok(!existsSync(out),'output already exists');assert.match(a['--attempt'],/^[a-f0-9]{32}$/);
 assert.equal(a['--project-role-arn'],PROJECT_ROLE_ARN);
 assert.match(a['--baseline-commit'],/^[a-f0-9]{40}$/,'--baseline-commit');assert.match(a['--baseline-sha256'],/^[a-f0-9]{64}$/,'--baseline-sha256');
 const git=(...v)=>execFileSync('git',['-C',root,...v],{maxBuffer:32*1024*1024});
 assert.equal(git('rev-parse','HEAD').toString().trim(),sourceCommit);
 assert.equal(git('diff',sourceCommit,'--','apps','packages','infra/product-preview').length,0,'working source differs');
 const blob=path=>git('show',sourceCommit+':'+path),json=path=>checkedJson(readFileSync(path));
 const request=json(a['--request']),productReceipt=json(a['--product-receipt']);
 const deployment=json(a['--deployment']),policy=json(a['--policy']),allocation=json(a['--allocation']);
 assert.deepEqual(policy,checkedJson(blob('infra/product-preview/first-chat/policy.json')),'policy drift');
 assert.deepEqual(allocation,checkedJson(blob('infra/product-preview/first-chat/allocation.json')),'allocation drift');
 const recipe=await import(pathToFileURL(join(root,'infra/product-preview/image-build-recipe.mjs')));
 const productRecipe=recipe.createProductImageBuildRecipe(request); // Canonical schema-v2 validation, no I/O.
 assert.equal(request.codeBuildProjectArn,PROJECT_ARN);
 assert.equal(request.sourceCommit,sourceCommit);assert.equal(productReceipt.sourceCommit,sourceCommit);
 assert.match(productReceipt.imageDigest,/^sha256:[a-f0-9]{64}$/);assert.equal(productReceipt.scanStatus,'COMPLETE');
 assert.equal(productReceipt.findingSeverityCounts?.HIGH??0,0);assert.equal(productReceipt.findingSeverityCounts?.CRITICAL??0,0);
 const image=request.ecrRepositoryUri+'@'+productReceipt.imageDigest;
 assert.equal(deployment.images.nodeRuntime,image);assert.equal(deployment.images.nodeRuntimeSourceCommit,sourceCommit);
 const baselineBytes=git('show',a['--baseline-commit']+':'+a['--baseline-path']);
 assert.equal(hash(baselineBytes),a['--baseline-sha256'],'baseline bytes');
 const baseline=checkedJson(baselineBytes);baseline.images.nodeRuntime=image;baseline.images.nodeRuntimeSourceCommit=sourceCommit;
 assert.deepEqual(deployment,baseline,'only C image/source fields may change');
 assert.equal(Object.hasOwn(deployment,'features'),false,'C feature absence must remain exact');
 const values=await import(pathToFileURL(join(root,'infra/product-preview/first-chat/runtime-values.mjs')));
 const measure=await import(pathToFileURL(join(root,MODULE)));
 const {canonicalSha256}=await import(pathToFileURL(join(root,'packages/contracts/validate.mjs')));
 values.parsePolicy(policy,deployment);await values.parseAllocationFile(allocation,policy,{sourceRoot:root});
 const policyRevision=values.policyRevisionOf(policy),capability=values.measuredCapabilityProfile(deployment),active=values.activeReadOperationsOf(deployment);
 assert.equal(capability,null);assert.equal(active,null);assert.equal(policy.runtime.maxTurns,3);assert.equal(allocation.manifest.budgets.maxToolCalls,1);
 const rawInputs=values.measurementInputs({policy,deployment,policyRevision});
 const inputs={...rawInputs,capabilityProfileSha256:capability?.profileSha256??null};
 const sdkOptionsSha256=await measure.probeTemplateSha256({...rawInputs,...(capability?{capabilityProfile:capability.profile}:{})},{root});
 const skills=await measure.skillsDigest({root});
 const generalReadInstallation=await measure.generalReadInstallation({root,...(active===null?{}:{activeReadOperations:active})});
 const generalReadInventory=active===null?undefined:await measure.generalReadInstallation({root});
 const moduleBytes=blob(MODULE),overrides=values.measurementOverrides({moduleBytes,policy,deployment,policyRevision,mode:'shipped'});
 const sourcePins={};
 for(const path of ['infra/product-preview/image-build-source.py','infra/product-preview/image-build-producer.py','infra/product-preview/image-build-recipe.mjs','infra/product-preview/image-build-test-reporter.mjs','infra/product-preview/image-build-linux-checks.py','apps/runtime/Dockerfile','.dockerignore',MODULE,RUNNER,'infra/product-preview/first-chat/runtime-values.mjs','infra/product-preview/first-chat/render-material.mjs','infra/product-preview/runtime-packages.lock.json']){const bytes=blob(path);sourcePins[path]={sha256:hash(bytes),bytes:bytes.length};}
 for(const [path,key]of [[RUNNER,'runnerSha256'],['infra/product-preview/image-build-source.py','verifierSha256'],['infra/product-preview/image-build-producer.py','producerSha256'],['apps/runtime/Dockerfile','dockerfileSha256'],['infra/product-preview/runtime-packages.lock.json','runtimePackagesSha256']])assert.equal(sourcePins[path].sha256,request[key]);
 const plan={schema:'meri.operator-launch-measurement-plan.v1',attempt:a['--attempt'],projectRoleArn:a['--project-role-arn'],image,request,productReceipt,productBuildspecSha256:productRecipe.buildspecSha256,sourcePins,
  publicInputHashes:{deployment:hash(readFileSync(a['--deployment'])),policy:hash(readFileSync(a['--policy'])),allocation:hash(readFileSync(a['--allocation'])),allocationCanonical:canonicalSha256(allocation),policyRevision},
  publicInputs:{deployment,policy,allocation},command:overrides.containerOverrides[0].command[0],expected:{inputs,sdkOptionsSha256,skills,generalReadInstallation,...(generalReadInventory?{generalReadInventory}:{})}};
 const planBytes=Buffer.from(JSON.stringify(plan)+'\n'),here=dirname(fileURLToPath(import.meta.url)),wrapper=renderWrapper(readFileSync(join(here,'measurement-build-wrapper.py')),sourceCommit);
 const payload=createPayload(planBytes,wrapper);
 mkdirSync(out,{recursive:false});
 const write=(name,bytes)=>writeFileSync(join(out,name),bytes,{flag:'wx',mode:0o600});
 write('measurement-plan.json',planBytes);write('launch-overrides.json',JSON.stringify(overrides)+'\n');write('measurement-payload.json',payload);
 const pins={sourceCommit,attempt:plan.attempt,planSha256:hash(planBytes),wrapperSha256:hash(wrapper),payloadSha256:hash(payload),payloadBytes:payload.length,payloadBucket:request.archive.bucket,payloadKey:payloadKey(plan),enabledCapabilityProfile:capability!==null,activeReadSubset:active!==null};
 write('preparation-hashes.json',JSON.stringify(pins,null,2)+'\n');
 console.log(JSON.stringify({status:'OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN',out,...pins}));
}catch(error){console.error('MEASUREMENT_PREPARE_REFUSED: '+(error?.message??'invalid input'));process.exitCode=2;}
