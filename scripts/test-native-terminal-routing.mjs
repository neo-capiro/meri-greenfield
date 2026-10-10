// Focused offline JSONata checks. Retained AWS history is DATA, never replayed.
// Usage: node scripts/test-native-terminal-routing.mjs <fresh .task-inputs output.json>
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCanaryEnforcementAdmission,buildCanaryEnforcementStateMachine} from '../infra/native-enforcement/app.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const out=resolve(process.argv[2]??'');
assert.equal(process.argv.length,3,'one fresh output argument');
assert.ok(out.startsWith(resolve(ROOT,'.task-inputs')+sep)&&!existsSync(out),'fresh ignored output only');
const inputs=[];
function load(path,pin){const raw=readFileSync(resolve(ROOT,path));assert.equal(sha(raw),pin,path);inputs.push({path,bytes:raw.length,sha256:pin});return JSON.parse(raw);}
const runtime=resolve(ROOT,'.task-inputs/jsonata-2.0.6-runtime/jsonata.js');
assert.equal(sha(readFileSync(runtime)),'8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata=createRequire(import.meta.url)(runtime);
const p=load('.task-inputs/CODEX-G1-canary-admission-data-4/static-pins.json','318ab033dfaeb3b11e850b18fb849d3c8692574f1e12f15359d0b513a4bc1903');
const oldReadback=load('.task-inputs/CODEX-G1-canary-runtime-2/version-readback/stdout.bin','9f471fe9633425d9690d3bc195b6c7205bd232b3e161bb6d4e0c9486d06fec9e');
assert.equal(sha(oldReadback.definition),'5603bcfb499e4249e8e880a405f279c0b2b939c980f21936e6af4793bb89fb04');
const old=JSON.parse(oldReadback.definition),events=[];
const pagePins=['4b4ac1b9817dcec6265d1e30f33a558b01dd5e23606fb778f2f1c8a4deea7ba8','640801e5c7610027dd3e067ad929ae6628c578777e52d82993f566928892c676','c2294ece07beb90f3fcb6279a88852319e3f62ff01bc1fd24caf785159cb046e','816688c9f12b95f2bc4fa9579f72378434696c3e7ca102b70c90500ffd193de3','f0e7f62e38bbd80723d293b56dd3e579fac3866d220e8394b1f4a7a2083624ce','925cb456d7f7e570d8b9f5aa43e51c8f466aa9bd27d6f15fb820af04ff8e008a','e0f7b99100907ba4f6938d8c6e47446986bffadae7b7aa16ba37dd817b55bcab'];
for(let n=1;n<=7;n++)events.push(...load(`.task-inputs/CODEX-G1-canary-runtime-2/history-final/page-${String(n).padStart(2,'0')}/stdout.bin`,pagePins[n-1]).events);
assert.equal(events.length,6877);events.forEach((e,i)=>assert.equal(e.id,i+1));
const actualInput=JSON.parse(events[0].executionStartedEventDetails.input);
const actualOutput=JSON.parse(events.at(-1).executionSucceededEventDetails.output);
const observed=JSON.parse(events.find(e=>e.id===6826).stateEnteredEventDetails.input);
const actualTask=load('.task-inputs/CODEX-G1-canary-runtime-2/watch-07/task-details/stdout.bin','d2bf93d85da233015680a46f43d92662059eab02afaa9d5220cfe46c126a4ebd').tasks[0];
const b=buildCanaryEnforcementAdmission({staticPins:p}),d=buildCanaryEnforcementStateMachine(b);
assert.equal(b.runtimeEnabled,false);assert.equal(Object.keys(d.States).length,94);
let NOW=Date.parse(events.find(e=>e.id===6826).timestamp),evaluations=0;
async function ev(source,ctx,extra={}){evaluations++;const e=jsonata(source.slice(3,-3));e.registerFunction('now',()=>new Date(NOW).toISOString(),'<:s>');return e.evaluate({}, {ctx,...extra});}
async function route(graph,name,ctx,extra={}){const s=graph.States[name];for(const c of s.Choices)if(await ev(c.Condition,ctx,extra))return c.Next;return s.Default;}
const initial=await ev(d.States.Initialize.Assign.ctx,{}, {states:{input:actualInput}});
const base={...initial,calls:320,attemptConsumed:true,launchCertain:true,mode:3,completeModes:[0,1,2],owned:actualOutput.ledger,overflow:[],currentArn:actualOutput.ledger.arn,current:observed.task,eni:observed.eni,taskReady:true,issues:actualOutput.issues};
const clone=x=>structuredClone(x),rows=[];
async function check(name,fn){try{const facts=await fn();rows.push({name,status:'PASS',facts});}catch(e){rows.push({name,status:'FAIL',error:String(e.stack??e)});}}
async function untilTask(start,ctx,extra={}){const trace=[];let name=start;for(let n=0;n<20;n++){trace.push(name);const s=d.States[name];if(s.Type==='Task'||s.Type==='Succeed')return {name,ctx,trace};if(s.Type==='Choice')name=await route(d,name,ctx,extra);else{if(s.Assign?.ctx)ctx=await ev(s.Assign.ctx,ctx,extra);name=s.Next;}}throw Error('focused transition bound');}

await check('actual post-stop observation: frozen defect and repaired confirmation',async()=>{
 assert.equal(actualOutput.cleanup,'CLEANUP_UNKNOWN');assert.equal(base.owned.stopAttempted,true);
 assert.equal(await route(old,'AfterObservation',base),'SelectOwned');
 assert.equal(await route(d,'AfterObservation',base),'SelectConfirm');
 const reached=await untilTask('AfterObservation',clone(base));assert.equal(reached.name,'TerminalDescribe');assert.ok(!reached.trace.includes('StopOwned'));
 return {oldRoute:'SelectOwned',newTrace:reached.trace,rawOwned:base.owned};
});
await check('actual empty-pending denial was unrelated to earlier ENI warning',async()=>{
 const sts=JSON.parse(events.find(e=>e.id===6871).taskSucceededEventDetails.output);
 assert.equal(await route(old,'CheckStopIdentity',base,{raw:sts,states:{context:{Execution:{RoleArn:oldReadback.roleArn}}}}),'FinalUnknown');
 assert.equal(events.filter(e=>e.stateEnteredEventDetails?.name==='NetworkUnknown').length,1);
 assert.equal(events.find(e=>e.stateEnteredEventDetails?.name==='NetworkUnknown').id,126);
 assert.equal(events.filter(e=>e.stateEnteredEventDetails?.name==='TerminalDescribe').length,0);
 return {networkUnknownEvent:126,terminalDescribeVisits:0,failedIdentityGateEvent:6873};
});
await check('empty selector explicitly clears stale ARN and refuses all-empty cleanup',async()=>{
 const c=clone(base);c.owned=[];c.currentArn=base.currentArn;
 const selected=await ev(d.States.SelectOwned.Assign.ctx,c);assert.equal(selected.currentArn,null);
 assert.equal(await route(d,'StopBudget',selected),'FinalUnknown');return {selectedArn:selected.currentArn};
});
await check('empty-pending selector race still reaches terminal confirmation',async()=>{
 const selected=await ev(d.States.SelectOwned.Assign.ctx,clone(base));assert.equal(selected.currentArn,null);
 assert.equal(await route(d,'StopBudget',selected),'SelectConfirm');
 const reached=await untilTask('StopBudget',selected);assert.equal(reached.name,'TerminalDescribe');return {trace:reached.trace};
});
await check('a distinct pending identity is selected before confirmation',async()=>{
 const c=clone(base),pending={...clone(c.owned),arn:c.owned.arn.replace(/.{32}$/,'f'.repeat(32)),stopAttempted:false};c.owned=[c.owned,pending];
 assert.equal(await route(d,'AfterObservation',c),'SelectOwned');const selected=await ev(d.States.SelectOwned.Assign.ctx,c);
 assert.equal(selected.currentArn,pending.arn);assert.equal(await route(d,'StopBudget',selected),'PreparePreStopDescribe');
 selected.currentArn=base.currentArn;assert.equal(await route(d,'StopBudget',selected),'FinalUnknown');return {selectedPending:pending.arn};
});
await check('terminal polling keeps round-robin overflow identity',async()=>{
 const c=clone(base),o={...clone(c.owned),arn:c.owned.arn.replace(/.{32}$/,'e'.repeat(32)),probeSeq:1};c.owned=[{...c.owned,probeSeq:2}];c.overflow=[o];
 const selected=await ev(d.States.PickConfirm.Assign.ctx,c);assert.equal(selected.currentArn,o.arn);return {selectedOverflow:o.arn};
});
await check('deadline preserves UNKNOWN and dispatches neither stop nor read',async()=>{
 const saved=NOW;try{NOW=base.C-999;const selected=await ev(d.States.SelectOwned.Assign.ctx,clone(base));assert.equal(await route(d,'StopBudget',selected),'FinalUnknown');assert.equal(await route(d,'PrepareTerminal',clone(base)),'FinalUnknown');return {remainingMs:999};}finally{NOW=saved;}
});
await check('one scoped stop attempt then confirmation, never a second stop',async()=>{
 const c=clone(base);c.owned={...c.owned,stopAttempted:false};c.stopMode=true;
 const sts=JSON.parse(events.find(e=>e.id===6871).taskSucceededEventDetails.output),extra={raw:sts,states:{context:{Execution:{RoleArn:oldReadback.roleArn}}}};
 const first=await untilTask('CheckStopIdentity',c,extra);assert.equal(first.name,'StopOwned');assert.equal(first.ctx.owned.stopAttempted,true);
 first.ctx.stopMode=false;first.ctx.current=observed.task;const second=await untilTask('AfterObservation',first.ctx);
 assert.equal(second.name,'TerminalDescribe');assert.equal([...first.trace,...second.trace].filter(n=>n==='StopOwned').length,1);return {first:first.trace,afterStop:second.trace};
});
await check('same bound STOPPED evidence confirms cleanup while exit137 stays FAILED',async()=>{
 const c=clone(base);c.current={...c.current,lastStatus:actualTask.lastStatus,attachments:actualTask.attachments,worker:{...c.current.worker,lastStatus:actualTask.containers[0].lastStatus,exitCode:actualTask.containers[0].exitCode}};
 assert.equal(await route(d,'TerminalGate',c,{observedMs:NOW}),'RetainTerminal');const retained=await ev(d.States.RetainTerminal.Assign.ctx,c,{observedMs:NOW});
 const row=Array.isArray(retained.owned)?retained.owned[0]:retained.owned;assert.equal(row.terminal,true);assert.equal(retained.qualificationFailed,true);
 assert.equal(await route(d,'FinalGate',retained),'FinalConfirmed');
 assert.equal(await ev(d.States.FinalConfirmed.Output.qualification,retained),'FAILED');return {terminalAt:row.terminalAt,cleanup:'STOPPED_CONFIRMED',qualification:'FAILED',note:'explicit CLI-to-facts terminal data mapping; not a new Step Functions observation'};
});
await check('foreign container identity cannot create a terminal receipt',async()=>{
 const c=clone(base);c.current.lastStatus='STOPPED';c.current.worker.lastStatus='STOPPED';c.current.worker.exitCode=0;c.current.worker.containerArn=c.current.worker.containerArn.replace(/.{36}$/,'00000000-0000-0000-0000-000000000000');
 assert.equal(await route(d,'TerminalGate',c,{observedMs:NOW}),'TerminalWaitRoute');return {receipt:false};
});
await check('direct terminal candidate precedes stop work without fresh ENI proof',async()=>{
 const c=clone(base);c.current.lastStatus='STOPPED';c.current.worker.lastStatus='STOPPED';c.current.worker.exitCode=137;c.current.attachments=[];c.eni={status:'UNAVAILABLE'};
 assert.equal(await route(d,'AfterObservation',c),'RetainTerminal');return {route:'RetainTerminal',freshEniRequired:false};
});
const result={status:rows.every(r=>r.status==='PASS')?'PASS':'BLOCKED',boundary:'OFFLINE_SELECTED_ACTUAL_JSONATA_AND_RETAINED_DATA__NOT_AWS_OR_FULL_WORKFLOW_OR_RUNTIME_ACCEPTANCE',capturedAt:new Date().toISOString(),runtimeSha256:sha(readFileSync(runtime)),inputs,evaluations,cases:rows,changedStates:['AfterObservation','SelectOwned','StopBudget'],stateCount:94,limits:['No complete scheduler/IAM/service/kernel simulation','Historical version2 unchanged; new compiler output remains inert','Owner must migrate exact compiler closure pins and review a fresh immutable runtime version','Physical STOPPED after managed workflow exit does not retroactively alter its UNKNOWN result']};
writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,cases:rows.map(({name,status})=>({name,status})),evaluations}));
if(result.status!=='PASS')process.exitCode=1;
