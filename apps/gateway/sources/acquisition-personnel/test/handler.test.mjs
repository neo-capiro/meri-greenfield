import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {GatewayDenied} from '../../../dispatch/operation-result.mjs';
import {createAcquisitionPersonnelHandlers} from '../handler.mjs';
import * as family from '../../../general-reads/families/acquisition-personnel.mjs';
import {acquisitionFixture,operationIds,personId} from './fixtures.mjs';
const refused=code=>error=>error instanceof GatewayDenied&&error.message===code;
const rows=f=>f.result.data??[f.result.person];
for(const id of operationIds){
 test(`${id}: native JSON DTO and exact private envelope survive fixed flat POST`,async()=>{
  const f=acquisitionFixture(id),saved=structuredClone(f.call),output=JSON.parse(await f.handler()(f.call));
  assert.deepEqual(output,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:f.normalized.argumentsSha256,result:f.result});
  assert.deepEqual(f.call,saved);assert.equal(f.state.fetches,1);assert.equal(f.state.credentials,1);
  const {url,options}=f.state.wire;assert.equal(url,`https://core.example.invalid/api/clio/tools/${id}`);
  assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),id==='search_acquisition_personnel'?f.request:f.normalized.input);
  assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
  assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.equal(options.headers['x-meri-deadline-at'],String(f.now()+250));
  assert.equal(f.state.proof.requestSha256,canonicalSha256(f.request));assert.deepEqual(f.state.proof.normalizationContext,{actorRole:'standard_user'});
  for(const key of ['authoritative','sourceConnected','producerQualified','currentAuthorityQualified','absenceEvidence'])assert.equal(f.normalized.metadata[key],false);
  assert.equal(f.normalized.metadata.auditWriteRequired,true);
 });
 test(`${id}: missing credential broker or current role is unavailable without native attempt`,async()=>{
  const f=acquisitionFixture(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call),refused('UNAVAILABLE'));
  for(const context of [undefined,null,{}])await assert.rejects(f.handler()({...f.call,normalizationContext:context}),refused('UNAVAILABLE'));
  assert.equal(f.state.fetches,0);assert.equal(f.state.credentials,0);
 });
 test(`${id}: role context is exact and model authority hints never reach audit-producing route`,async()=>{
  const f=acquisitionFixture(id);
  for(const context of [{actorRole:'admin'},{actorRole:'capiro_admin',tenantId:'invented'}])await assert.rejects(f.handler()({...f.call,normalizationContext:context}),refused('INVALID_ARGUMENTS'));
  for(const key of ['actorRole','tenantId','include_superseded'])await assert.rejects(f.handler()({...f.call,request:{...f.request,[key]:'capiro_admin'}}),refused('INVALID_ARGUMENTS'));
  await assert.rejects(f.handler()({...f.call,argumentsSha256:'0'.repeat(64)}),refused('INVALID_ARGUMENTS'));
  assert.equal(f.state.credentials,0);assert.equal(f.state.fetches,0);
 });
 test(`${id}: current decision/subject/policy/source mismatches refuse before credentials`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.operation='other@0.2.0',
   a=>a.decision.actor.actorId='other',a=>a.decision.decisionId='00000000-0000-4000-8000-000000000001',a=>a.decision.policyRevision='c'.repeat(64),
   a=>a.decision.scopes=[],a=>a.claims.scopes[0].tenantId='other',a=>a.subject.policyRevision='c'.repeat(64),a=>a.sourceIds=['other']]){
   const f=acquisitionFixture(id),call=structuredClone(f.call);mutate(call.authority);
   await assert.rejects(f.handler()(call),refused('ACCESS_DENIED'));assert.equal(f.state.credentials,0);assert.equal(f.state.fetches,0);
  }
 });
 test(`${id}: every credential correlation plus both native credentials is checked`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','argumentsSha256','requestSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=acquisitionFixture(id);f.state.mutateCredentials=r=>{r[key]=key==='expiresAtMs'?f.now():null;};
   await assert.rejects(f.handler()(f.call),refused('ACCESS_DENIED'));assert.equal(f.state.fetches,0);
  }
 });
 test(`${id}: current non-admin contact leakage refuses instead of local redaction`,async()=>{
  for(const actorRole of ['standard_user','user_admin','client_portal_user'])for(const key of ['email','phone','parentOffice','department']){
   const f=acquisitionFixture(id,{actorRole});rows(f)[0][key]='synthetic@example.invalid';
   await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));assert.equal(f.state.fetches,1);
  }
 });
 test(`${id}: legitimate admin projection stays native`,async()=>{
  const f=acquisitionFixture(id,{actorRole:'capiro_admin'});Object.assign(rows(f)[0],{email:'stored@example.invalid',phone:'123',parentOffice:'Office',department:'Dept'});
  if(f.result.person)f.result.person.metadata={uploadedDirectoryContact:{phone:' 123 ',parentOffice:'Office',department:'Dept'}};
  const output=JSON.parse(await f.handler()(f.call));assert.deepEqual(output.result,f.result);
 });
 test(`${id}: native HTTP refusal and audit failure are not retried or turned into empty evidence`,async()=>{
  for(const status of [400,401,403,404,500,503]){
   const f=acquisitionFixture(id);f.state.status=status;
   await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));assert.equal(f.state.fetches,1);
  }
  const f=acquisitionFixture(id);await assert.rejects(f.handler({fetchImpl:async()=>{f.state.fetches++;throw Error('PRIVATE audit or transport failure');}})(f.call),refused('INTERNAL_ERROR'));
  assert.equal(f.state.fetches,1);
 });
 test(`${id}: malformed raw shape, extra fields and substituted tool are withheld`,async()=>{
  for(const mutate of [r=>r.tool='other',r=>r.extra=true,r=>delete rows({result:r})[0].phone,r=>rows({result:r})[0].firstSeenAt='not-a-date']){
   const f=acquisitionFixture(id);mutate(f.result);await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));
  }
 });
 test(`${id}: original deadline, credential expiry and cancellation cannot release late bytes`,async()=>{
  const f=acquisitionFixture(id);f.state.afterFetch=()=>{f.state.now+=1001;};await assert.rejects(f.handler()(f.call),refused('DEADLINE'));
  const expired=acquisitionFixture(id);expired.state.now+=1001;await assert.rejects(expired.handler()(expired.call),refused('DEADLINE'));assert.equal(expired.state.credentials,0);
  const pre=acquisitionFixture(id),controller=new AbortController();controller.abort();await assert.rejects(pre.handler()({...pre.call,signal:controller.signal}),refused('CANCELLED'));assert.equal(pre.state.credentials,0);
  const future=acquisitionFixture(id);future.call.authority.claims.issuedAt=new Date(future.now()+1).toISOString();await assert.rejects(future.handler()(future.call),refused('ACCESS_DENIED'));assert.equal(future.state.credentials,0);
 });
}
test('search uses canonical query/q preference, selector caps, defaults and bounded count semantics',async()=>{
 const f=acquisitionFixture(operationIds[0],{request:{query:' ',q:' Synthetic ',service:'Army',role:'PM',peCode:'PE-1',page:2,limit:2}});
 Object.assign(f.result.data[0],{service:'Army',role:'PM',peSecondary:['PE-1']});f.result.total=2;
 const output=JSON.parse(await f.handler()(f.call));assert.deepEqual(JSON.parse(f.state.wire.options.body),f.request);
 assert.deepEqual(f.normalized.input,{query:'Synthetic',service:'Army',role:'PM',peCode:'PE-1',page:2,limit:2});
 assert.deepEqual(output.result,f.result);assert.equal(f.normalized.metadata.countScope,'paged-fuzzy-candidates-before-filters');
 f.result.total=3;await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));
});
test('search model role selector never supplies current actor role',async()=>{
 const f=acquisitionFixture(operationIds[0],{request:{role:'capiro_admin'}});f.result.data[0].role='capiro_admin';
 await f.handler()(f.call);assert.deepEqual(f.state.proof.normalizationContext,{actorRole:'standard_user'});
 f.result.data[0].email='stored@example.invalid';await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));
});
test('detail uses normalized UUID, retains superseded identity and full native source array',async()=>{
 const f=acquisitionFixture(operationIds[1],{request:{id:` ${personId.toUpperCase()} `}});f.result.person.status='superseded';
 f.result.person.sources=Array.from({length:65},(_,i)=>({...f.result.person.sources[0],id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`}));
 const output=JSON.parse(await f.handler()(f.call));assert.deepEqual(JSON.parse(f.state.wire.options.body),{id:personId});assert.deepEqual(output.result,f.result);
 f.result.person.id='00000000-0000-0000-0000-000000000002';await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));
});
test('detail rejects non-admin top-level upload metadata but retains opaque source metadata',async()=>{
 const f=acquisitionFixture(operationIds[1]);f.result.person.sources[0].metadata={uploadedDirectoryContact:{untrusted:'opaque'}};
 await f.handler()(f.call);
 for(const key of ['uploadedDirectoryContact','uploadedDirectoryPrevious']){
  f.result.person.metadata={[key]:{}};await assert.rejects(f.handler()(f.call),refused('INVALID_RESULT'));
 }
});
test('configuration is inert and rejects endpoint/delegated/role authority extensions',()=>{
 const f=acquisitionFixture();for(const extra of [{endpoints:{}},{delegatedTransport:{read(){}}},{readCurrentRole(){}},{getRole(){}}])assert.throws(()=>f.handler(extra));
 for(const origin of ['http://core.example.invalid','https://core.example.invalid/path','https://user:pass@core.example.invalid'])assert.throws(()=>f.handler({origin}));
 assert.equal(f.state.fetches,0);assert.equal(f.state.credentials,0);
 assert.throws(()=>createAcquisitionPersonnelHandlers(f.configuration,[{id:'list_global_datasets',version:'0.2.0'}]));
});
test('hostile own-data boundaries reject without invoking accessors',async()=>{
 const f=acquisitionFixture();let hooks=0;
 const config=Object.defineProperty({...f.configuration},'origin',{enumerable:true,get(){hooks++;return 'https://core.example.invalid';}});assert.throws(()=>createAcquisitionPersonnelHandlers(config,[f.operation]));
 for(const key of ['authority','normalizationContext']){
  const call=Object.defineProperty({...f.call},key,{enumerable:true,get(){hooks++;return f.call[key];}});await assert.rejects(f.handler()(call));
 }
 f.state.mutateCredentials=r=>Object.defineProperty(r,'bearerToken',{enumerable:true,get(){hooks++;return 'PRIVATE';}});
 await assert.rejects(f.handler()(f.call));assert.equal(hooks,0);assert.equal(f.state.fetches,0);
});
test('strict receiving bytes enforce type, content length, UTF8 and claim budget',async()=>{
 for(const response of [()=>new Response('{}',{headers:{'content-type':'text/plain'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'3'}}),
  ()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-encoding':'gzip'}})]){
  const f=acquisitionFixture();f.state.response=response;await assert.rejects(f.handler()(f.call));
 }
 const f=acquisitionFixture();f.call.authority.claims.budgets.maxOutputBytes=10;await assert.rejects(f.handler()(f.call),refused('RESOURCE_LIMIT'));
});
test('parked credentials, fetch and response body obey owned bounded deadline and body cleanup',async()=>{
 for(const stage of ['credentials','fetch','body']){
  const f=acquisitionFixture();let cancelled=false;
  const changes={maxRequestMs:15,...(stage==='credentials'?{getCredentials:()=>new Promise(()=>{})}:stage==='fetch'?{fetchImpl:()=>new Promise(()=>{})}:{fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}})})};
  await assert.rejects(f.handler(changes)(f.call),refused('DEADLINE'));if(stage==='body')assert.equal(cancelled,true);
 }
});
test('family is passive, uses canonical operations and leaves production descriptors unavailable',()=>{
 const f=acquisitionFixture(),handlers=family.createHandlers(f.configuration);
 assert.equal(family.id,'acquisition-personnel');assert.equal(family.sourceDirectory,'acquisition-personnel');
 assert.deepEqual(handlers.map(h=>h.operation.id),operationIds);for(const h of handlers){
  assert.equal(typeof h.execute,'function');const descriptor=acquisitionFixture(h.operation.id).contract.descriptor;
  assert.equal(descriptor.handler,null);assert.equal(descriptor.availability,'unimplemented');assert.equal(descriptor.qualification,'pending');
 }
 assert.equal(f.state.credentials,0);assert.equal(f.state.fetches,0);
});
