/** The public Objective generation starter over SYNTHETIC session and Temporal ports, plus the actual dispatcher over a
 * SYNTHETIC Temporal client. No Clerk, Core, Temporal server or network is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectiveGenerationDispatcher,objectiveGenerationWorkflowId} from '../../control/conversations/objective-generation-dispatch.mjs';
import {objectiveRunIdentity} from '../objective-source/run-starts.mjs';
import {createObjectiveGenerationStartApplication,OBJECTIVE_GENERATION_START_PATH} from './start-application.mjs';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {receiveObjectiveGenerationStartResponse} from '../../../packages/contracts/objective-generation.mjs';

const NOW=1792065600000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,url='https://meri.example'+OBJECTIVE_GENERATION_START_PATH;
const credential='synthetic.native.clerk';
function harness({sessionFails=false,startFails=false,foreignJob=false}={}){
 const calls={auth:[],start:[]};
 const identity={async verifyIdentity(q){calls.auth.push(q);if(sessionFails)throw Error('SESSION_REFUSED');
  return {principal:{sessionId:id(90),tenantId:id(1),actorId:id(2),conversationId:id(91),runId:id(92)},sessionRevision:'r1',checkedAtMs:NOW,expiresAtMs:NOW+300000};}};
 const starts=[],client={connection:{withDeadline:(_d,fn)=>fn(),withAbortSignal:(_s,fn)=>fn()},workflow:{async start(type,options){starts.push({type,options});if(startFails)throw Error('lost ack');},getHandle(){return {signal:async()=>{}};}}};
 const dispatcher=createObjectiveGenerationDispatcher({client,taskQueue:'meri-conversations',now:()=>NOW});
 const spy={start(value){calls.start.push(value);return dispatcher.start(value);}};
 const app=createObjectiveGenerationStartApplication({enabled:true,identity,dispatcher:spy,windowMs:1800000,now:()=>NOW,authorizeJob:async({source})=>({generationJobId:source.generationJobId,tenantId:source.binding.tenantId,actorId:foreignJob?id(99):source.binding.actorId,effectExpiresAtMs:NOW+1800000})});
 const post=(body={generationJobId:id(21)},init={})=>app.handle(new Request(url,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body),...init}));
 return {calls,starts,app,post};
}

test('disabled by default: every request falls through (null) and no port is touched',async()=>{
 for(const app of [createObjectiveGenerationStartApplication(),createObjectiveGenerationStartApplication({enabled:false,identity:null})]){
  assert.equal(app.state(),'disabled');assert.equal(await app.handle(new Request(url,{method:'POST',body:'{}'})),null);
 }
 assert.throws(()=>createObjectiveGenerationStartApplication({enabled:true,identity:{},dispatcher:{start(){}},windowMs:1800000}),/OBJECTIVE_GENERATION_CONFIGURATION/u);
 assert.throws(()=>createObjectiveGenerationStartApplication({enabled:true,identity:{verifyIdentity(){}},dispatcher:{start(){}},windowMs:1000}),/OBJECTIVE_GENERATION_CONFIGURATION/u);
});

test('a fresh Core identity starts exactly one workflow for the derived binding with a server-set deadline',async()=>{
 const h=harness(),response=await h.post();
 assert.equal(response.status,202);assert.deepEqual(await response.json(),{state:'requested',generationJobId:id(21)});
 assert.equal(h.calls.auth[0].credential,credential);
 const expected=objectiveRunIdentity({tenantId:id(1),actorId:id(2),generationJobId:id(21)}).binding;
 assert.deepEqual(h.calls.start[0].source,{generationJobId:id(21),binding:expected,notAfterMs:NOW+1800000});
 assert.notEqual(expected.conversationId,id(91),'the Objective run gets its own conversation, not the session conversation');
 assert.equal(h.starts[0].type,'meriObjectiveGenerationWorkflow');
 assert.equal(h.starts[0].options.workflowId,objectiveGenerationWorkflowId({tenantId:id(1),generationJobId:id(21)}));
 assert.equal(await h.app.handle(new Request('https://meri.example/api/conversations/x',{method:'POST'})),null,'other paths fall through');
});

test('malformed requests are 400 before authentication; a refused session is 401; a lost start acknowledgement is UNKNOWN',async()=>{
 const h=harness();
 for(const [body,init] of [[{generationJobId:'job'}],[{generationJobId:id(21),binding:{}}],[{generationJobId:id(21)},{headers:{'content-type':'text/plain',authorization:'Bearer '+credential}}],
  [{generationJobId:id(21)},{headers:{'content-type':'application/json'}}],[{generationJobId:id(21)},{method:'PUT'}]]){
  const r=await h.post(body,init);assert.equal(r.status,400);
 }
 assert.equal((await h.app.handle(new Request(url+'?x=1',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:'{}'}))).status,400);
 assert.equal(h.calls.auth.length,0);assert.equal(h.calls.start.length,0);
 const s=harness({sessionFails:true}),refused=await s.post();assert.equal(refused.status,401);assert.deepEqual(await refused.json(),{error:{code:'SESSION_REFUSED'}});assert.equal(s.calls.start.length,0);
 const lost=harness({startFails:true}),unknown=await lost.post();assert.equal(unknown.status,503);assert.deepEqual(await unknown.json(),{error:{code:'OBJECTIVE_GENERATION_UNKNOWN'}});
});

test('a foreign saved job is refused before Temporal start',async()=>{const h=harness({foreignJob:true});assert.equal((await h.post()).status,403);assert.equal(h.calls.start.length,0);});

test('native Core identity starts the saved job without a chat, opaque session or browser-supplied principal',async()=>{
 const paths=[],starts=[];
 let revoked=false;
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',enabled:true,now:()=>NOW,
  limits:{maxRequestMs:3000,maxFactBytes:4096},currentOwner:{currentRun(){throw Error('No conversation is required');}},
  admitInitialConversation(){throw Error('No conversation is created');},
  async fetchImpl(url,options){paths.push(new URL(url).pathname);assert.equal(options.headers.authorization,'Bearer '+credential);
   return revoked?Response.json({error:'denied'},{status:401}):Response.json({principal:{tenantId:id(1),actorId:id(2)},identityRevision:'native-1',checkedAtMs:NOW,expiresAtMs:NOW+300000});}});
 const app=createObjectiveGenerationStartApplication({enabled:true,identity,now:()=>NOW,windowMs:1800000,
  authorizeJob:async({source})=>({generationJobId:source.generationJobId,tenantId:id(1),actorId:id(2),effectExpiresAtMs:NOW+900000}),
  dispatcher:{async start(value){starts.push(value);}}});
 const post=()=>app.handle(new Request(url,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({generationJobId:id(21)})}));
 const response=await post();
 assert.deepEqual(receiveObjectiveGenerationStartResponse(response.status,await response.text(),id(21)),{state:'requested',generationJobId:id(21)});
 assert.deepEqual(paths,['/api/clio/application-authority/identity']);assert.equal(starts.length,1);
 assert.equal(starts[0].source.notAfterMs,NOW+900000,'Core consent bounds the native dispatch');
 revoked=true;assert.equal((await post()).status,401);assert.equal(starts.length,1,'fresh revoked identity cannot dispatch');
});
