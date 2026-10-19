#!/usr/bin/env node
// OFFLINE. Verify public records first; then invoke the canonical source CLI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {joinMeasurement,joinArtifactDownloads,measurementStartRequest,ARTIFACT_NAMES,hash,checkedJson,SOURCE_COMMIT} from './receipt-joins.mjs';
const usage='Usage: node verify-measurement.mjs --source-root ROOT --packet PREPARED_DIR --results DOWNLOADED_DIR --operator-dir AUTHENTICATED_READBACK_DIR --out NEW_RUNTIME.json\nOperator directory: product-build.json, measurement-start.json, measurement-build.json, ecr-image.json, ecr-scan.json, artifact-downloads.json. Exit 0 joined+assembled, 2 refused.';
try{
 if(process.argv.includes('--help')){console.log(usage);process.exit(0);}
 const a={};for(let i=2;i<process.argv.length;i+=2){assert.ok(process.argv[i+1]&&!a[process.argv[i]]);a[process.argv[i]]=process.argv[i+1];}
 assert.deepEqual(Object.keys(a).sort(),['--source-root','--packet','--results','--operator-dir','--out'].sort());
 const root=resolve(a['--source-root']),packet=resolve(a['--packet']),results=resolve(a['--results']),op=resolve(a['--operator-dir']),out=resolve(a['--out']);
 assert.ok(!existsSync(out),'output exists');
 const read=(dir,name)=>{const b=readFileSync(join(dir,name));assert.ok(b.length>0&&b.length<=4*1024*1024,'file bound');return checkedJson(b);};
 const rawPlan=readFileSync(join(packet,'measurement-plan.json')),plan=checkedJson(rawPlan),pins=read(packet,'packet-hashes.json');
 assert.equal(hash(rawPlan),pins.planSha256);assert.equal(hash(readFileSync(join(packet,'measurement-buildspec.json'))),pins.buildspecSha256);
 const startBytes=readFileSync(join(packet,'measurement-start.request.json'));assert.equal(hash(startBytes),pins.startRequestSha256);
 assert.deepEqual(checkedJson(startBytes),measurementStartRequest(plan,readFileSync(join(packet,'measurement-buildspec.json'),'utf8')),'exact submitted request');
 Object.assign(plan,{planSha256:pins.planSha256,buildspecSha256:pins.buildspecSha256});
 const git=(...args)=>execFileSync('git',['-C',root,...args],{maxBuffer:32*1024*1024});
 assert.equal(git('rev-parse','HEAD').toString().trim(),SOURCE_COMMIT);assert.equal(git('diff',SOURCE_COMMIT,'--','apps','packages','infra/product-preview').length,0,'working source drift');
 for(const [path,pin]of Object.entries(plan.sourcePins)){const b=git('show',SOURCE_COMMIT+':'+path);assert.equal(hash(b),pin.sha256);assert.equal(b.length,pin.bytes);}
 const one=(value,key)=>{assert.equal(value[key]?.length,1);return value[key][0];};
 const operator={productBuild:one(read(op,'product-build.json'),'builds'),measurementStart:read(op,'measurement-start.json'),measurementBuild:one(read(op,'measurement-build.json'),'builds'),ecrImage:one(read(op,'ecr-image.json'),'imageDetails'),ecrScan:read(op,'ecr-scan.json')};
 joinArtifactDownloads({plan,buildId:operator.measurementStart.id,downloads:read(op,'artifact-downloads.json'),resultBytes:Object.fromEntries(ARTIFACT_NAMES.map(name=>[name,readFileSync(join(results,name))]))});
 const diagnostic=read(results,'measurement-diagnostic.json');assert.equal(diagnostic.status,'SUCCEEDED');assert.equal(diagnostic.cleanup,'COMPLETE');
 const launch=read(results,'launch-measurement.json'),readback=read(results,'launch-readback.json'),native=read(results,'runtime-native.json'),packages=read(results,'runtime-packages.json'),provenance=read(results,'measurement-provenance.json');
 const joined=joinMeasurement({plan,launch,readback,native,packages,provenance,operator});
 const runtime=await import(pathToFileURL(join(root,'infra/product-preview/first-chat/runtime-values.mjs')));
 // This is the canonical policy/allocation/source-template/skills/read verifier.
 const accepted=await runtime.runtimeValues({receipt:launch,...plan.publicInputs,sourceRoot:root});
 assert.equal(accepted.runtime.preparationIntent.runnerSha256,plan.request.runnerSha256);
 assert.equal(accepted.runtime.preparationIntent.executableSha256,launch.executable.sha256);
 assert.equal(accepted.runtime.capabilityProfileSha256,undefined);
 const temporary=mkdtempSync(join(tmpdir(),'meri-measurement-assembly-'));
 try{
  for(const [name,value]of Object.entries(plan.publicInputs))writeFileSync(join(temporary,name+'.json'),JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});
  const result=spawnSync(process.execPath,[join(root,'infra/product-preview/first-chat/runtime-values.mjs'),'assemble','--receipt',join(results,'launch-measurement.json'),'--out',out,'--allocation',join(temporary,'allocation.json'),'--policy',join(temporary,'policy.json'),'--deployment-inputs',join(temporary,'deployment.json')],{encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  assert.equal(result.status,0,'canonical assembly refused: '+(result.stderr??''));
  assert.deepEqual(checkedJson(readFileSync(out)),accepted.runtime,'canonical CLI output');
 }finally{rmSync(temporary,{recursive:true,force:true});}
 console.log(JSON.stringify({...joined,status:'MEASUREMENT_VERIFIED_AND_ASSEMBLED',out,runtimeSha256:hash(readFileSync(out)),features:'REUSED_C_ABSENT_NO_EXPANSION',measurementOnly:true}));
}catch(error){console.error('MEASUREMENT_VERIFY_REFUSED: '+(error?.message??'invalid input'));process.exitCode=2;}
