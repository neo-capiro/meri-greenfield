/** Actual frozen receiving/transport over synthetic HTTP JSON; no native/provider/DB/SDK execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisclosuresHandlers} from '../handler.mjs';
import {createHandlers} from '../../../general-reads/families/disclosures.mjs';
import {setup,ids} from './fixture.mjs';
const json=value=>JSON.parse(JSON.stringify(value));
for(const id of ids){
 test(`${id}: exact raw native JSON and private carrier preserve stored observations`,async()=>{
  const f=setup(id),before=structuredClone(f.call),out=JSON.parse(await f.handler()(f.call));
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:f.normalized.argumentsSha256,result:json(f.page)});
  assert.deepEqual(f.call,before);assert.equal(out.result.total,0);assert.equal(out.result.data.length,1,'independent count is not snapshot completeness');
  assert.equal(Object.hasOwn(out.result,'complete'),false);assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
 });
 test(`${id}: fixed flat POST and allowlisted native headers bind both request and canonical digest`,async()=>{
  const f=setup(id);await f.handler()(f.call);const [wire]=f.wire,[proof]=f.proofs;
  assert.equal(wire.url,`https://core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.request);
  assert.deepEqual(Object.keys(wire.options.headers).sort(),['authorization','x-internal-service-secret','accept','accept-encoding','x-meri-deadline-at','content-type'].sort());
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,f.hash(f.request));assert.equal(proof.argumentsSha256,f.normalized.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
 });
 test(`${id}: missing broker stays unavailable with no HTTP fallback`,async()=>{
  const f=setup(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);assert.equal(f.proofs.length,0);
 });
 test(`${id}: current decision and scope corruption refuse before credentials`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.operation='other@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.policyRevision='c'.repeat(64),a=>a.decision.scopes=[],a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other']){
   const f=setup(id),call=structuredClone(f.call);mutate(call.authority);
   await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);assert.equal(f.proofs.length,0);
  }
  const future=setup(id);future.call.authority.claims.issuedAt=new Date(future.now()+1).toISOString();await assert.rejects(future.handler()(future.call),{message:'ACCESS_DENIED'});assert.equal(future.proofs.length,0);assert.equal(future.wire.length,0);
 });
 test(`${id}: model authority, nonempty context and argument digest substitution refuse before I/O`,async()=>{
  const f=setup(id);
  for(const request of [{tenantId:'other'},{actorRole:'capiro_admin'},{clientId:'core-client'}, {cursor:'invented'}])await assert.rejects(f.handler()({...f.call,request}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call,normalizationContext:{actorId:'invented'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call,argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});assert.equal(f.wire.length,0);assert.equal(f.proofs.length,0);
 });
 test(`${id}: every credential echo and both required native credentials are checked`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=setup(id);f.state.credentialMutator=receipt=>{if(key==='expiresAtMs')receipt[key]=f.now();else if(['bearerToken','serviceSecret'].includes(key))receipt[key]='';else receipt[key]=null;};
   await assert.rejects(f.handler()(f.call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: HTTP200 domain errors, non200 and invented completeness are withheld`,async()=>{
  for(const responseFactory of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403}),page=>Response.json({...page,complete:true})]){
   const f=setup(id);f.state.responseFactory=responseFactory;await assert.rejects(f.handler()(f.call),{message:'INVALID_RESULT'});
  }
 });
 test(`${id}: pre-abort and original deadline prevent credentials and source calls`,async()=>{
  const f=setup(id);await assert.rejects(f.handler()({...f.call,signal:AbortSignal.abort()}),{message:'CANCELLED'});f.state.now=f.authority.deadlineMs;await assert.rejects(f.handler()(f.call),{message:'DEADLINE'});assert.equal(f.proofs.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: output bound and cancellation after HTTP withhold bytes`,async()=>{
  const f=setup(id);await assert.rejects(f.handler({maxResponseBytes:16})(f.call),{message:'RESOURCE_LIMIT'});
  const g=setup(id),controller=new AbortController();g.state.afterFetch=()=>controller.abort();await assert.rejects(g.handler()({...g.call,signal:controller.signal}),{message:'CANCELLED'});
 });
 test(`${id}: per-call credential hook preserves the exact original call and never falls back`,async()=>{
  const f=setup(id),{getCredentials,...config}=f.configuration;let observed;
  const execute=createDisclosuresHandlers({...config,credentialsForCall:(operation,call)=>{observed={operation,call};return getCredentials;}},[f.operation])[0].execute;
  const out=JSON.parse(await execute(f.call));assert.equal(observed.call,f.call);assert.deepEqual(observed.operation,f.operation);assert.equal(out.result.tool,id);
  await assert.rejects(createDisclosuresHandlers({...config,credentialsForCall:()=>undefined},[f.operation])[0].execute(f.call),{message:'UNAVAILABLE'});
  assert.equal(f.wire.length,1);
 });
}
test('native alias/clip/year/page normalization runs once against the original validated request',async()=>{
 for(const [id,request,expected] of [
  ['search_sec_filings',{query:' ',companyName:' Issuer ',formType:'A'.repeat(19)+' B',limit:'2.9'},{query:'Issuer',formType:'A'.repeat(19)+' ',limit:2}],
  ['search_fara_registrations',{registrantName:null,registrant:' Agent ',country:' France ',status:'A'.repeat(19)+' B'},{registrantName:'Agent',country:'France',status:'A'.repeat(19)+' ',limit:20}],
  ['search_lda_filings',{clientName:' ',query:' Public Client ',issueCode:null,issue:' DEF ',year:'0',page:'2.9',limit:'2.9'},{clientName:'Public Client',issueCode:'DEF',page:2,limit:2}],
 ]){const f=setup(id,request);assert.deepEqual(f.normalized.input,expected);await f.handler()(f.call);assert.deepEqual(f.wire[0].body,request);assert.equal(f.proofs[0].requestSha256,f.hash(request));}
});
test('LDA Number/null projection and non-client public registry identity survive without Decimal reconstruction',async()=>{
 const f=setup('search_lda_filings');for(const amount of [null,0,-1.25,10000000000000000]){f.page.data[0].income=amount;const out=JSON.parse(await f.handler()(f.call));assert.equal(out.result.data[0].income,amount);assert.equal(out.result.data[0].clientId,17);}
});
test('SEC/FARA date projection and LDA nullable timestamps retain actual HTTP ISO serialization',async()=>{
 const sec=setup('search_sec_filings'),out=JSON.parse(await sec.handler()(sec.call));assert.equal(out.result.data[0].filingDate,'2026-10-12T00:00:00.000Z');
 sec.page.data[0].filingDate=new Date('2026-10-12T12:00:00.000Z');await assert.rejects(sec.handler()(sec.call),{message:'INVALID_RESULT'});
 const fara=setup('search_fara_registrations');assert.equal(JSON.parse(await fara.handler()(fara.call)).result.data[0].registrationDate,null);
 const lda=setup('search_lda_filings');lda.page.data[0].dtPosted=null;assert.equal(JSON.parse(await lda.handler()(lda.call)).result.data[0].dtPosted,null);
});
test('finite family/configuration admission is inert and rejects ambiguity or invented routes',()=>{
 const f=setup();assert.deepEqual(createHandlers(f.configuration).map(row=>row.operation.id).sort(),[...ids].sort());assert.equal(f.wire.length,0);
 for(const operations of [[],[f.operation,f.operation],[{id:'generic_disclosures',version:'0.2.0'}],[{...f.operation,version:'0.1.0'}]])assert.throws(()=>createDisclosuresHandlers(f.configuration,operations));
 assert.throws(()=>createDisclosuresHandlers({...f.configuration,credentialsForCall:()=>{}},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createDisclosuresHandlers({...f.configuration,delegatedTransport:{}},[f.operation]));
 let effects=0;assert.throws(()=>createDisclosuresHandlers({get origin(){effects++;return f.configuration.origin;},now:f.now},[f.operation]));assert.equal(effects,0);
});
