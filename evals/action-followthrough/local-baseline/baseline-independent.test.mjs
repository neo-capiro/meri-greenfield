import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalActionDemo} from '../../../apps/control/action-application/local/demo.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {runLocalPilotBaseline} from './run.mjs';

const input={mode:'synthetic-local'};
const calls=[];
function wrapped(mutator=()=>{}) {
 let count=0;
 return async options=>{
  const at=++count, real=await createLocalActionDemo(options), record={at,routes:[],closeCalls:0,approveCalls:0,before:real.stats()};calls.push(record);
  let override={};
  const fixture={...real,app:{async handle(request){record.routes.push(new URL(request.url).pathname.split('/').at(-1));return real.app.handle(request);}},approve(){record.approveCalls++;throw new Error('INDEPENDENT_APPROVAL_MUST_NOT_RUN');},close(){record.closeCalls++;real.close();record.after=real.stats();}};
  override=mutator(fixture,real,record,at)??{};
  return {...fixture,...override};
 };
}
function allSix(result){assert.equal(result.caseCount,6);assert.equal(result.cases.length,6);assert.deepEqual(result.cases.map(c=>c.id),['P01','P02','P03','P04','P05','P06']);}
function expectedFailure(result,id){allSix(result);assert.equal(result.status,'FAIL');assert.ok(result.passed<6);assert.equal(result.cases.find(c=>c.id===id).status,'FAIL');}
async function changeResponse(response,mutate){if(response.status!==200)return response;const value=JSON.parse(await response.text());mutate(value);return new Response(JSON.stringify(value),{status:response.status,headers:response.headers});}

test('independent actual six fresh compositions retain current public DTOs, no approval/effect, exact preludes and cleanup',async()=>{
 calls.length=0;const result=await runLocalPilotBaseline({...input,createDemo:wrapped()});allSix(result);assert.equal(result.status,'PASS');assert.equal(result.passed,6);assert.equal(calls.length,6);
 assert.deepEqual(calls.map(c=>c.routes),[['query','query'],['query','query'],['query','draft','query'],['query','draft','prepare','query'],['query','draft','prepare','execute','query'],['query','query']]);
 for(const c of calls){assert.equal(c.before.lookupRows,0);assert.equal(c.before.metadataRows,0);assert.equal(c.before.commandRows,0);assert.equal(c.approveCalls,0);assert.equal(c.closeCalls,1);assert.equal(c.after.closed,true);assert.equal(c.after.taskEffects,0);assert.equal(c.after.approvals,0);}
 assert.equal(calls[5].after.sourceReads,0);assert.ok(!JSON.stringify(result).includes('Bearer '));
});
test('independent default production composition passes all six without injection',async()=>{const r=await runLocalPilotBaseline(input);allSix(r);assert.equal(r.status,'PASS');assert.equal(r.passed,6);});
test('independent one constructor error is redacted and retains all six denominator rows',async()=>{let n=0;const secret='SECRET_INDEPENDENT_CONSTRUCTOR';const r=await runLocalPilotBaseline({...input,createDemo:async o=>{if(++n===2)throw new Error(secret);return createLocalActionDemo(o);}});expectedFailure(r,'P02');assert.equal(n,6);assert.ok(!JSON.stringify(r).includes(secret));});
test('independent reported task effect makes the real case fail',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===1?{stats:()=>({...real.stats(),taskEffects:1})}:undefined)});expectedFailure(r,'P01');});
test('independent approval issuance makes the real case fail',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===2?{stats:()=>({...real.stats(),approvals:1})}:undefined)});expectedFailure(r,'P02');});
test('independent cleanup failure fails its case and never removes later cases',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===3?{close(){f.close();throw new Error('SECRET_CLOSE');}}:undefined)});expectedFailure(r,'P03');assert.ok(!JSON.stringify(r).includes('SECRET_CLOSE'));});
test('independent coherent but wrong recommendation title cannot pass gold',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===1?{app:{async handle(req){return changeResponse(await f.app.handle(req),v=>{v.observation.result.actions[0].title='WRONG_GOLD';v.resultSha256=canonicalSha256(v.observation);});}}}:undefined)});expectedFailure(r,'P01');});
test('independent false evidence-ready assertion cannot pass coverage gold',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===2?{app:{async handle(req){return changeResponse(await f.app.handle(req),v=>{v.observation.result.evidenceReady=true;v.resultSha256=canonicalSha256(v.observation);});}}}:undefined)});expectedFailure(r,'P02');});
test('independent coherent draft for another result cannot pass current selection correlation',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===3?{app:{async handle(req){const response=await f.app.handle(req);if(!req.url.endsWith('/draft'))return response;return changeResponse(response,v=>{v.source.resultReference='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const {draftSha256,...content}=v;v.draftSha256=canonicalSha256(content);});}}}:undefined)});expectedFailure(r,'P03');});
test('independent malformed public response cannot become a passing row',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===4?{app:{async handle(req){const response=await f.app.handle(req);if(!req.url.endsWith('/prepare'))return response;return new Response('{"status":"approval_required"}',{status:200,headers:{'content-type':'application/json'}});}}}:undefined)});expectedFailure(r,'P04');});
test('independent refusal wrong outcome cannot pass P05',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===5?{app:{async handle(req){const response=await f.app.handle(req);if(!req.url.endsWith('/execute'))return response;return new Response(JSON.stringify({error:{code:'COMMAND_APPROVAL_REFUSED',outcome:'UNKNOWN'}}),{status:409,headers:{'content-type':'application/json'}});}}}:undefined)});expectedFailure(r,'P05');});
test('independent revoked-session source read contradicts P06 even if HTTP refusal is correct',async()=>{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===6?{stats:()=>({...real.stats(),sourceReads:1})}:undefined)});expectedFailure(r,'P06');});
test('independent wrong mode refuses before acquiring any demo',async()=>{let calls=0;await assert.rejects(()=>runLocalPilotBaseline({mode:'production',createDemo:async()=>{calls++;throw new Error('NOT_RUN');}}));assert.equal(calls,0);});

test('independent stats failure must still close the acquired session and continue denominator',async()=>{let closed=0;const owned=[];try{const r=await runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>{owned.push(real);return n===2?{stats(){throw new Error('SECRET_STATS');},close(){closed++;f.close();}}:undefined;})});expectedFailure(r,'P02');assert.equal(closed,1);assert.ok(!JSON.stringify(r).includes('SECRET_STATS'));}finally{for(const demo of owned)demo.close();}});
test('independent parked cleanup handler is bounded and cannot erase later cases',async()=>{let timer;const pending=runLocalPilotBaseline({...input,createDemo:wrapped((f,real,record,n)=>n===1?{app:{handle(req){if(real.stats().closed)return new Promise(()=>{});return f.app.handle(req);}}}:undefined)});const result=await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2200);})]);clearTimeout(timer);assert.notEqual(result,null,'cleanup hung beyond its1s advertised signal deadline');expectedFailure(result,'P01');});
