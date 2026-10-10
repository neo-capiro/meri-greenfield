// W02-14 focused qualification test: SYNTHETIC selected RunTask reply-shape expressions.
// Candidate imports resolve relative to THIS file; no developer worktree/root/session is hardcoded.
// Usage:
//   node scripts/test-native-run-shape.mjs <path-to-jsonata-2.0.6.js> <fresh-output.json>
// The runtime SHA is verified BEFORE require. Only the ACTUAL candidate RunShape / RetainRun /
// LaunchUncertain / StartScan expressions are evaluated (no copied JS validator, no string-only
// proof). One wx capture is written; no other IO occurs. This is a focused qualification test,
// not a product framework: no workflow run, AWS, network, provider, model, SDK or acceptance.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';

const RUNTIME_SHA='8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b';
const HERE=dirname(fileURLToPath(import.meta.url));
const [runtimeArg,outArg]=process.argv.slice(2);
assert.ok(runtimeArg&&outArg,'usage: node scripts/test-native-run-shape.mjs <jsonata.js> <fresh-output.json>');
const runtimePath=resolve(runtimeArg),out=resolve(outArg);
assert.ok(!existsSync(out),'output must be a fresh path; prior captures are preserved');
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtimeSha=sha(readFileSync(runtimePath));
assert.equal(runtimeSha,RUNTIME_SHA,'retained JSONata 2.0.6 runtime SHA');
const jsonata=createRequire(import.meta.url)(runtimePath);

const {fixturePins,runShapeFixtures}=await import(pathToFileURL(resolve(HERE,'test-native-enforcement.mjs')).href);
const {buildNativeEnforcementAdmission,buildNativeEnforcementStateMachine,LIMITS}=await import(pathToFileURL(resolve(HERE,'../infra/native-enforcement/app.mjs')).href);
const binding=buildNativeEnforcementAdmission({staticPins:fixturePins()}),p=binding.pins,d=buildNativeEnforcementStateMachine(binding);
const T0=Date.parse('2026-10-10T03:00:00.000Z'),OBSERVED=T0+1000;
const unwrap=x=>{assert.ok(x.startsWith('{% ')&&x.endsWith(' %}'),'wrapped expression');return x.slice(3,-3);};
let evaluations=0;
async function evaluate(source,vars={},states={}){evaluations++;const e=jsonata(unwrap(source));e.registerFunction('now',()=>new Date(OBSERVED).toISOString(),'<:s>');return e.evaluate({}, {...vars,states});}
const runShape=d.States.RunShape.Choices[0].Condition;
const retainRun=d.States.RetainRun.Assign.ctx;
const launchUncertain=d.States.LaunchUncertain.Assign.ctx;
const startScan=d.States.StartScan.Assign.ctx;

const input={runUuid:p.runUuid,probeKind:'sdk',executionName:`meri-native-sdk-${p.runUuid}`,staticBindingId:binding.staticBindingId,t0Ms:T0};
const seed=await evaluate(d.States.Initialize.Assign.ctx,{}, {input});
// ORIGINAL positive ledger facts + consumed attempt that must survive any launch disposition.
const seededOwned={arn:`arn:aws:ecs:${p.region}:${p.account}:task/${p.clusterArn.split('/')[1]}/${'a'.repeat(32)}`,definition:p.taskDefinitionArns.sdk,netId:'eni-0123456789abcdef0',netIp:'10.0.0.7',stopAttempted:true,terminal:false,qualifiedSeen:true,probeSeq:0};
const seededOverflow={arn:`arn:aws:ecs:${p.region}:${p.account}:task/${p.clusterArn.split('/')[1]}/${'b'.repeat(32)}`,definition:p.taskDefinitionArns.sdk,netId:'eni-0123456789abcdef1',netIp:'10.0.0.8',stopAttempted:true,terminal:false,qualifiedSeen:true,probeSeq:0};
const ctx0={...seed,attemptConsumed:true,attemptStart:T0,attemptEnd:OBSERVED,owned:[seededOwned],overflow:[seededOverflow]};

assert.equal(d.States.RunShape.Choices[0].Next,'RetainRun');
assert.equal(d.States.RunShape.Default,'LaunchUncertain');
assert.equal(d.States.LaunchUncertain.Next,'StartScan');
assert.equal(d.States.RunResultRecord.Next,'StartScan');

const fixtures=runShapeFixtures(p);
const cases=[];
for(const fx of fixtures){
 const payload=fx.payload;
 const raw=await evaluate(d.States.RunTask.Assign.raw,{ctx:ctx0},{result:payload});
 const rawOver=await evaluate(d.States.RunTask.Assign.rawOver,{ctx:ctx0},{result:payload});
 const guard=await evaluate(runShape,{ctx:ctx0,raw});
 const route=guard?'RetainRun':'LaunchUncertain';
 const row={name:fx.name,expectRetainRun:fx.expectRetainRun,payload,serializedUtf8Bytes:Buffer.byteLength(JSON.stringify(payload)),conservativeSerializedBound:JSON.stringify(payload).length*6,rawAfterTaskBound:raw,rawOver,runShape:guard,route};
 if(fx.expectRetainRun===true)assert.equal(route,'RetainRun',`${fx.name} must retain`);
 if(fx.expectRetainRun===false)assert.equal(route,'LaunchUncertain',`${fx.name} must route uncertain`);
 let reached;
 if(route==='RetainRun'){
  reached=await evaluate(retainRun,{ctx:ctx0,raw});
  row.retainRunRawContext=reached;
  row.projection={direct:reached.direct,directCount:Array.isArray(reached.direct)?reached.direct.length:null,launchCertain:reached.launchCertain,qualificationFailed:reached.qualificationFailed};
  assert.ok(row.projection.directCount<=payload.tasks.length,`${fx.name} direct<=immediate count`);
  if(fx.name==='valid-one-scalar-object'){assert.equal(reached.launchCertain,true);assert.equal(reached.qualificationFailed,false);assert.equal(row.projection.directCount,1);}
  if(fx.name==='valid-four-scalar-objects'){assert.equal(reached.launchCertain,false);assert.equal(reached.qualificationFailed,true);assert.equal(row.projection.directCount,4);}
  // Empty tasks may pass RunShape, but the disposition must stay false certainty / failure.
  if(fx.name==='empty-tasks-uncertain'){assert.equal(reached.launchCertain,false,`${fx.name} launchCertain false`);assert.equal(reached.qualificationFailed,true,`${fx.name} qualificationFailed true`);}
 }else{
  reached=await evaluate(launchUncertain,{ctx:ctx0,raw,callError:null});
  row.launchUncertainRawContext=reached;
  assert.equal(reached.launchCertain,false,`${fx.name} launchCertain false after LaunchUncertain`);
  assert.equal(reached.qualificationFailed,true,`${fx.name} qualificationFailed true after LaunchUncertain`);
 }
 // attemptConsumed + ORIGINAL positive ledgers / net pins / stop-attempt flags must survive every case.
 assert.equal(reached.attemptConsumed,true,`${fx.name} attemptConsumed survives`);
 assert.equal(reached.owned[0].netId,'eni-0123456789abcdef0',`${fx.name} owned netId survives`);
 assert.equal(reached.owned[0].netIp,'10.0.0.7',`${fx.name} owned netIp survives`);
 assert.equal(reached.owned[0].stopAttempted,true,`${fx.name} owned stopAttempted survives`);
 assert.equal(reached.overflow[0].netId,'eni-0123456789abcdef1',`${fx.name} overflow netId survives`);
 assert.equal(reached.overflow[0].netIp,'10.0.0.8',`${fx.name} overflow netIp survives`);
 assert.equal(reached.overflow[0].stopAttempted,true,`${fx.name} overflow stopAttempted survives`);
 // Independent bounded discovery remains reachable from either disposition.
 const scan=await evaluate(startScan,{ctx:reached});
 assert.ok(Array.isArray(scan.queue),`${fx.name} StartScan queue is array`);
 row.startScan={queue:scan.queue,queueCount:scan.queue.length,mode:scan.mode,polls:scan.polls};
 row.disposition={launchCertain:reached.launchCertain,qualificationFailed:reached.qualificationFailed,attemptConsumed:reached.attemptConsumed};
 if(route==='LaunchUncertain')assert.ok(scan.queue.includes(seededOwned.arn)&&scan.queue.includes(seededOverflow.arn),`${fx.name} independent discovery keeps original positives`);
 cases.push(row);
}

const result={boundary:'FOCUSED_SYNTHETIC_SELECTED_EXPRESSION_QUALIFICATION_TEST__NOT_AWS_OR_WORKFLOW_OR_ACCEPTANCE',
 capturedUtc:new Date().toISOString(),runtimeSha256:runtimeSha,
 evaluatedExpressions:{runShape,retainRun,launchUncertain,startScan},
 staticReachability:{runShapeRetain:d.States.RunShape.Choices[0].Next,runShapeDefault:d.States.RunShape.Default,launchUncertainNext:d.States.LaunchUncertain.Next,runResultRecordNext:d.States.RunResultRecord.Next},
 limits:LIMITS,evaluations,cases,
 limitsOfEvidence:[
  'Fixture compilation remains runtimeEnabled:false; no inert guard bypass or StartExecution was attempted.',
  'Only selected actual source expressions were executed; no complete downstream stop/cleanup simulation was performed.',
  'The malformed guard routes LaunchUncertain and preserves the original positive ledgers, but actual AWS wire framing, IAM/tag propagation and physical termination remain unqualified.',
  'The empty-tasks case is not asserted to fail the guard; its disposition is asserted to stay launchCertain:false / qualificationFailed:true.'
 ]};
writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({runtimeSha256:runtimeSha,evaluations,cases:cases.map(c=>({name:c.name,runShape:c.runShape,route:c.route,disposition:c.disposition,directCount:c.projection?.directCount}))},null,2));
