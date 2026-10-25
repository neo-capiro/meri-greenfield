/** Existing selected-client proposal owner and retained context over closed HTTP/storage. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createMailFixture,uuid} from '../../gateway/sources/mail/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
async function fixture({personal=false}={}){
 const source=createMailFixture(undefined,{client:true}),binding={...source.binding,tenantId:uuid('9'),actorId:uuid('1')},clientId=personal?null:source.clientId,records=new Map(),calls=[];
 const operation={id:'memory.list_own_proposals',version:'0.2.0'},family='memory-proposals',scopes=[{tenantId:binding.tenantId,kind:personal?'private-user':'client',resourceId:clientId??binding.actorId,policyRevision:source.subject.policyRevision}];
 let revoked=false,status=200,after,mutate;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:clientId,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[family],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[family],activeReadOperations:[operation]};}},memoryContexts:{forTask(task){assert.equal(task.expiresAtMs,identity.expiresAtMs);return {
   async retain({record}){records.set(hash(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:hash(record.key),previousSha256:record.previousSha256,checkedAtMs:source.state.now});},
   async loadPrevious({key}){return JSON.stringify({record:records.get(hash(key)),checkedAtMs:source.state.now});},
  };}},async fetchImpl(url,options){assert.equal(new URL(url).pathname,'/api/clio/tools/memory.list_own_proposals');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');const body=JSON.parse(options.body);calls.push(body);assert.equal(body.input.clientId,clientId);
   const next=body.input.cursor!==null,page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,scope:{tenantId:binding.tenantId,userId:binding.actorId,clientId},
    candidates:[{id:uuid(next?'7':'8'),status:'pending',approvedFact:false,scope:personal?'personal':'client',clientId,sourceKind:'explicit_user',createdAt:next?'2026-01-01T00:00:00.000Z':'2026-01-02T00:00:00.000Z',restricted:false,title:'Synthetic',proposedText:'Unapproved',contentTruncated:false}],nextCursor:next?null:'opaque-next',coverage:{firstPage:!next,complete:false,reason:'unread_pages_restricted_or_truncated_content'}};
   mutate?.(page);after?.();return Response.json(page,{status});}});
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}};
 async function execute(args={limit:1}){const app=composer.createReadsRuntime({execution,binding,approvedReads}),request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const a=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));if(a.status!==200)return a;const available=await a.json();return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:args,deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256}));}
 return {source,records,calls,execute,expiry:identity.expiresAtMs,revoke:()=>{revoked=true;},after:fn=>{after=fn;},mutate:fn=>{mutate=fn;},status:n=>{status=n;}};
}
test('proposal continuation survives its first request timeout within the same active execution',async()=>{
 const f=await fixture(),first=await f.execute();assert.equal(first.status,200,(await first.clone().text())+' calls='+JSON.stringify(f.calls));assert.equal(f.records.size,1);assert.equal(f.records.values().next().value.expiresAtMs,f.expiry);
 f.source.state.now+=1500;const r=await f.execute({limit:1,cursor:'opaque-next'});assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.length,2);assert.equal(JSON.parse((await r.json()).resultJson).result.coverage.firstPage,false);
});
test('proposal request timeout remains independent from retained page expiry',async()=>{const f=await fixture();f.after(()=>{f.source.state.now+=1001;});assert.notEqual((await f.execute()).status,200);assert.equal(f.records.size,0);});
test('proposal continuation refuses after execution expiry or revocation',async()=>{for(const action of ['expiry','revocation']){const f=await fixture();assert.equal((await f.execute()).status,200);if(action==='expiry')f.source.state.now=f.expiry;else f.revoke();assert.notEqual((await f.execute({limit:1,cursor:'opaque-next'})).status,200);assert.equal(f.calls.length,1);}});
test('proposal current owner refusal, foreign client and scope substitution remain closed',async()=>{
 const denied=await fixture();denied.status(403);assert.equal((await denied.execute()).status,403);assert.equal(denied.records.size,0);
 const selected=await fixture();assert.notEqual((await selected.execute({clientId:uuid('6')})).status,200);assert.equal(selected.calls.length,0);
 const altered=await fixture();altered.mutate(page=>{page.scope.userId=uuid('6');});assert.notEqual((await altered.execute()).status,200);assert.equal(altered.records.size,0);
});

test('General own proposals use the canonical personal selector and retain a bounded continuation',async()=>{
 const f=await fixture({personal:true}),first=await f.execute();assert.equal(first.status,200,await first.clone().text());
 const stored=[...f.records.values()][0];assert.equal(stored.key.subject.kind,'personal');assert.equal(stored.key.subject.entityIds[0],stored.key.binding.actorId);assert.equal(stored.previous.request.clientId,null);
 f.source.state.now+=1500;const next=await f.execute({limit:1,cursor:'opaque-next'});assert.equal(next.status,200,await next.clone().text());assert.equal(f.calls.length,2);
});

test('General proposal continuation rejects client selectors, foreign actor results, revocation and expiry',async()=>{
 const selector=await fixture({personal:true});assert.notEqual((await selector.execute({clientId:uuid('6')})).status,200);assert.equal(selector.calls.length,0);
 const actor=await fixture({personal:true});actor.mutate(page=>{page.scope.userId=uuid('6');});assert.notEqual((await actor.execute()).status,200);assert.equal(actor.records.size,0);
 for(const action of ['expiry','revocation']){const f=await fixture({personal:true});assert.equal((await f.execute()).status,200);if(action==='expiry')f.source.state.now=f.expiry;else f.revoke();assert.notEqual((await f.execute({limit:1,cursor:'opaque-next'})).status,200);assert.equal(f.calls.length,1);}
});
