/** Real composer/dispatch/HTTP normalization; closed Core and storage ports, no DB/provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createMailFixture,uuid} from '../../gateway/sources/mail/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

async function fixture({client=false,id='mail.list_messages'}={}){
 const source=createMailFixture(id,{client}),binding=source.binding,calls=[],records=new Map();
 let rows=[{id:source.mailboxId,tenantId:binding.tenantId,createdByUserId:binding.actorId,provider:'microsoft_365',status:'disabled'},
  {id:uuid('7'),tenantId:binding.tenantId,createdByUserId:binding.actorId,provider:'zoom',status:'connected'}],revoked=false,afterPage,status=200;
 const scopes=[{tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?source.clientId:binding.actorId,policyRevision:source.subject.policyRevision}];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:client?source.clientId:null,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[source.operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['mail'],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:['mail']};}},
  memoryContexts:{forTask(){throw Error('Memory is not selected');},forMail(task){assert.equal(task.clientId,current.selectedClientId);return {
   async retain({record}){records.set(hash(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:hash(record.key),previousSha256:record.previousSha256,checkedAtMs:source.state.now});},
   async loadPrevious({key}){return JSON.stringify({record:records.get(hash(key)),checkedAtMs:source.state.now});},
  };}},
  async fetchImpl(url,options){
   const path=new URL(url).pathname;calls.push(path);assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   if(path==='/api/engagement/integrations'){assert.equal(options.method,'GET');assert.equal(options.headers['x-internal-service-secret'],undefined);return Response.json(rows,{status});}
   assert.equal(path,`/api/clio/tools/${id}`);assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   const correlation=JSON.parse(Buffer.from(options.headers['x-meri-read-correlation'],'base64url').toString());
   assert.deepEqual(correlation.subject.scopes,[...scopes,{tenantId:binding.tenantId,kind:'mailbox',resourceId:source.mailboxId,policyRevision:current.policyRevision}]);
   assert.equal(Object.hasOwn(correlation.subject,'authorizationDecisionId'),false);
   const page=source.page(JSON.parse(options.body).input,correlation);afterPage?.();return Response.json(page);
  }});
 assert.deepEqual(composer.missing,[]);
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}};
 async function execute(args=source.args){
  // A new HTTP owner per request proves continuation does not depend on its cache.
  const app=composer.createReadsRuntime({execution,binding,approvedReads});
  const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const availability=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));if(availability.status!==200)return availability;
  const a=await availability.json();return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation:source.operation,arguments:args,deliveryId:'synthetic',installationId:a.installation.installationId,executionCatalogSha256:a.installation.executionCatalogSha256}));
 }
 return {source,calls,records,execute,rows:fn=>{rows=fn(rows);},revoke:()=>{revoked=true;},after:fn=>{afterPage=fn;},status:n=>{status=n;}};
}

for(const client of [false,true])for(const id of ['mail.list_messages','mail.search_messages','mail.read_thread'])test(`actual ${id} reads disconnected stored ${client?'client':'General'} mail`,async()=>{
 const f=await fixture({client,id}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 const page=JSON.parse((await r.json()).resultJson);assert.equal(page.messages[0].connectionStatus,'disconnected');assert.equal(page.subject.kind,client?'client':'personal');
 assert(f.calls.includes('/api/engagement/integrations'));assert.equal(f.calls.filter(x=>x.startsWith('/api/clio/tools/')).length,1);
});
test('candidate continuation reloads exact stored page on a newly composed owner',async()=>{
 const f=await fixture(),first=await f.execute();assert.equal(first.status,200,await first.clone().text());const page=JSON.parse((await first.json()).resultJson);
 assert.equal(f.records.size,1);f.source.state.now+=1500;const r=await f.execute({...f.source.args,offset:page.nextOffset,asOf:page.queryScope.asOfInclusive});assert.equal(r.status,200,await r.clone().text());
 const next=JSON.parse((await r.json()).resultJson);assert.equal(next.messages.length,1);assert.notEqual(next.messages[0].messageId,page.messages[0].messageId);assert.equal(next.hasMore,false);
});
for(const field of ['tenantId','createdByUserId'])test(`foreign inventory ${field} refuses before reading mail`,async()=>{const f=await fixture();f.rows(rows=>rows.map(row=>({...row,[field]:'foreign'})));const r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert(!f.calls.some(x=>x.startsWith('/api/clio/tools/')));});
test('mailbox removal after Core read withholds content and continuation',async()=>{const f=await fixture();f.after(()=>f.rows(()=>[]));const r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.records.size,0);assert.doesNotMatch(await r.text(),/Synthetic mail candidate/);});
test('execution revocation after Core read withholds content and continuation',async()=>{const f=await fixture();f.after(f.revoke);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.records.size,0);});
test('Core inventory denial is a refusal with no fallback',async()=>{const f=await fixture();f.status(403);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.length,1);});
test('continuation refuses a missing retained page before source read',async()=>{const f=await fixture(),r=await f.execute({...f.source.args,offset:1,asOf:f.source.anchor});assert.notEqual(r.status,200);assert(!f.calls.some(x=>x.startsWith('/api/clio/tools/')));});

test('stored mail continuation cannot survive execution expiry or revocation',async()=>{
 for(const action of ['expiry','revocation']){const f=await fixture(),first=await f.execute();assert.equal(first.status,200);const page=JSON.parse((await first.json()).resultJson),before=f.calls.filter(x=>x.startsWith('/api/clio/tools/')).length;
  if(action==='expiry')f.source.state.now+=10000;else f.revoke();const r=await f.execute({...f.source.args,offset:page.nextOffset,asOf:page.queryScope.asOfInclusive});assert.notEqual(r.status,200);assert.equal(f.calls.filter(x=>x.startsWith('/api/clio/tools/')).length,before);
 }
});
