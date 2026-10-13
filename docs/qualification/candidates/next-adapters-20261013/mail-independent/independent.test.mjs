import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;if(!root)throw Error('Exact reviewed source root required');
const module=path=>import(pathToFileURL(root+'/'+path));
const {createMailHttpAdapter}=await module('apps/gateway/sources/mail/http-adapter.mjs');
const {createMailReadHandler}=await module('apps/gateway/sources/mail/handler.mjs');
const {createMailFixture,bodyText,NOW,uuid}=await module('apps/gateway/sources/mail/test/fixtures.mjs');
const {canonicalSha256:hash}=await module('packages/contracts/validate.mjs');
const {createCurrentToolAuthority}=await module('apps/gateway/authorization/current-tool-authority.mjs');
const {createToolDispatch}=await module('apps/gateway/dispatch/tool-dispatch.mjs');
const clone=x=>structuredClone(x);
function fixture(id='mail.list_messages',opts={}){
 const f=createMailFixture(id,opts);
 f.authority.decision={decisionId:f.subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},operation:id+'@0.2.0',scopes:clone(f.subject.scopes),policyRevision:f.authority.policyRevision,evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_CURRENT_ALLOWED'};
 return f;
}
const response=page=>new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});
const execute=(f,config={},call=f.call())=>createMailReadHandler({operation:f.operation,adapter:createMailHttpAdapter({...f.config,...config}),now:()=>f.state.now})(call);
function dispatcher(f,config={}){
 let revoked=false,n=0;const counts={reserved:0,settled:0,uncertain:0,credentials:0};const retained=new Map();
 const entry={descriptor:f.contract.descriptor,contract:f.contract,execute:createMailReadHandler({operation:f.operation,adapter:createMailHttpAdapter({...f.config,...config,getCredentials:async pins=>{counts.credentials++;return f.credentials(pins);}}),now:()=>f.state.now})};
 const authority=createCurrentToolAuthority({ports:{async verifyCapability(){return JSON.stringify(f.claims);},async currentRun(){return JSON.stringify({binding:f.binding,policyRevision:f.authority.policyRevision,deadlineMs:NOW+10000,checkedAtMs:f.state.now});},async authorizeBusiness(){if(revoked)throw Error('revoked');return JSON.stringify({decision:f.authority.decision,subject:f.subject,grants:f.contract.descriptor.requiredGrants});},async authorizeSources(){return JSON.stringify({sourceIds:['mail'],enabled:true,policyRevision:f.authority.policyRevision,checkedAtMs:f.state.now});}},now:()=>f.state.now,maxFactBytes:1048576});
 const mailContextPorts={async retain({record}){retained.set(hash(record.key),clone(record));return JSON.stringify({decision:'retained',keySha256:hash(record.key),previousSha256:record.previousSha256,checkedAtMs:f.state.now});},async loadPrevious({key}){return JSON.stringify({record:retained.get(hash(key)),checkedAtMs:f.state.now});}};
 const d=createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[]},authority,budget:{async reserve({reservationId}){counts.reserved++;return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){counts.settled++;return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){counts.uncertain++;}},limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:1000,maxCleanupMs:30},now:()=>f.state.now,newId:()=>uuid(String(++n)),sourceEnabled:true,mailContextPorts});
 return {counts,retained,revoke:()=>revoked=true,execute:args=>d.execute(JSON.stringify({operation:f.operation,arguments:args}), 'synthetic-read-capability')};
}
test('Borrowed adapter read preserves its original receiver',async()=>{
 const f=fixture();const adapter={read(call){assert.strictEqual(this,adapter);return f.page(call.input,call.authority);}};
 const handler=createMailReadHandler({operation:f.operation,adapter,now:()=>NOW});
 const result=JSON.parse(await handler(f.call()));assert.equal(result.evidenceReady,false);
});
for(const [name,mutate] of [
 ['broker audience',f=>f.claims.audience='meri-broker'],
 ['command-only actions',f=>f.claims.actions=['command.execute']],
 ['denied decision',f=>f.authority.decision.decision='denied'],
 ['decision ID substitution',f=>f.authority.decision.decisionId=uuid('f')],
 ['decision scope omission',f=>f.authority.decision.scopes=[]],
])test('Direct internal mail port refuses incoherent '+name+' before credential lookup',async()=>{
 const f=fixture();mutate(f);let error;try{await execute(f);}catch(e){error=e.message;}
 console.log(JSON.stringify({case:'direct authority '+name,error,credentialCalls:f.credentialCalls.length,fetchCalls:f.wire.length}));
 assert.ok(error,'Structural effect-authority mismatch must fail admission');assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
for(const [name,mutate] of [['broker audience',f=>f.claims.audience='meri-broker'],['command-only actions',f=>f.claims.actions=['command.execute']],['denied decision',f=>f.authority.decision.decision='denied']])
test('Actual canonical dispatcher denies '+name+' before source credentials',async()=>{
 const f=fixture();mutate(f);const d=dispatcher(f);await assert.rejects(d.execute(f.args),/ACCESS_DENIED/);assert.equal(d.counts.credentials,0);assert.equal(d.counts.reserved,0);
});
test('Actual dispatcher first and retained later pages preserve full subject/anchor and explicit incomplete evidence',async()=>{
 const f=fixture(),d=dispatcher(f);const first=JSON.parse(await d.execute(f.args));
 assert.equal(first.evidenceReady,false);assert.equal(d.retained.size,1);
 const second=JSON.parse(await d.execute({...f.args,offset:first.nextOffset,asOf:first.queryScope.asOfInclusive}));
 assert.equal(second.selection.offset,1);assert.equal(second.queryScope.asOfInclusive,first.queryScope.asOfInclusive);assert.deepEqual(second.subject,first.subject);
 assert.equal(second.evidenceReady,false);assert.deepEqual(second.negativeAssertion,{kind:'none'});assert.equal(d.counts.reserved,2);assert.equal(d.counts.settled,2);
});
test('Malformed nested later-page mailbox cannot pass actual dispatcher release',async()=>{
 const f=fixture();let corrupt=false;
 const d=dispatcher(f,{fetchImpl:async(url,options)=>{const p=f.page(JSON.parse(options.body).input);if(corrupt)p.messages[0].mailboxId=uuid('f');return response(p);}});
 const first=JSON.parse(await d.execute(f.args));corrupt=true;
 await assert.rejects(d.execute({...f.args,offset:1,asOf:first.queryScope.asOfInclusive}),/INVALID_RESULT/);
 assert.equal(d.counts.settled,1);assert.equal(d.counts.uncertain,1);
});
test('Current authority revocation after source bytes blocks dispatcher release/settlement',async()=>{
 const f=fixture();let d;d=dispatcher(f,{fetchImpl:async()=>{const p=f.page();d.revoke();return response(p);}});
 await assert.rejects(d.execute(f.args),/ACCESS_DENIED/);assert.equal(d.counts.reserved,1);assert.equal(d.counts.settled,0);assert.equal(d.counts.uncertain,1);
});
test('Split UTF8 response chunks retain late decisive full-body Unicode and original version/hash',async()=>{
 const f=fixture('mail.read_thread');f.args.maxCharacters=6000;const page=f.page(),raw=new TextEncoder().encode(JSON.stringify(page)),emoji=new TextEncoder().encode('😀');
 let boundary=-1;for(let i=0;i<raw.length-emoji.length;i++)if(emoji.every((x,n)=>raw[i+n]===x)){boundary=i+2;break;}assert.ok(boundary>0);
 const result=JSON.parse(await execute(f,{fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(raw.slice(0,boundary));c.enqueue(raw.slice(boundary));c.close();}}),{headers:{'content-type':'application/json','content-length':String(raw.length)}})}));
 assert.equal(result.messages[0].section.text,bodyText);assert.match(result.messages[0].section.text,/committee approved/);assert.equal(result.messages[0].contentSha256,page.messages[0].contentSha256);assert.equal(result.messages[0].recordVersionId,page.messages[0].recordVersionId);assert.equal(result.evidenceReady,false);
});
test('UTF16 one-unit sections may split astral text and recombine without verified upgrade',async()=>{
 const f=fixture('mail.read_thread'),start=bodyText.length-2;
 const args={...f.args,messageId:uuid('9'),bodyOffset:start,maxCharacters:1};
 const first=JSON.parse(await execute(f,{},f.call(args)));const last=JSON.parse(await execute(f,{},f.call({...args,bodyOffset:start+1})));
 assert.equal(first.messages[0].section.text.length,1);assert.equal(last.messages[0].section.text.length,1);assert.equal(first.messages[0].section.text+last.messages[0].section.text,'😀');assert.equal(first.messages[0].section.hasMore,true);assert.equal(last.messages[0].section.hasMore,false);assert.equal(last.evidenceReady,false);
});
test('Hostile credential data getters and Proxy reflection refuse without Fetch',async()=>{
 const f=fixture();let effects=0;
 await assert.rejects(execute(f,{getCredentials:()=>{const c=f.credentials({operation:f.operation,input:f.input(),metadata:null,argumentsSha256:hash(f.input()),requestSha256:hash({input:f.input(),metadata:null}),binding:f.binding,subject:f.subject,sourceIds:['mail'],policyRevision:f.authority.policyRevision});Object.defineProperty(c,'bearerToken',{enumerable:true,get(){effects++;return 'unexpected';}});return c;}}));
 assert.equal(effects,0);
 let promiseThenReads=0,reflectionEffects=0;
 await assert.rejects(execute(f,{getCredentials:()=>new Proxy({},{get(t,k){if(k==='then'){promiseThenReads++;return undefined;}reflectionEffects++;throw Error('unexpected');},ownKeys(){reflectionEffects++;throw Error('unexpected');}})}));
 assert.equal(reflectionEffects,0);assert.equal(f.wire.length,0);
 console.log(JSON.stringify({case:'native Promise assimilation versus inert DTO guard',promiseThenReads,reflectionEffects,credentialGetterEffects:effects}));
});
test('Caller input/authority accessor and Proxy refuse before credentials',async()=>{
 const f=fixture();let effects=0;
 const call=f.call();Object.defineProperty(call,'authority',{enumerable:true,get(){effects++;return f.authority;}});
 await assert.rejects(execute(f,{},call));await assert.rejects(execute(f,{},new Proxy({},{ownKeys(){effects++;throw Error('unexpected');}})));
 assert.equal(effects,0);assert.equal(f.credentialCalls.length,0);
});
test('Opaque request digest/metadata receipt edits refuse before Fetch',async()=>{
 const f=fixture();for(const mutate of [c=>c.requestSha256=hash({input:f.input(),metadata:{invented:true}}),c=>c.metadata={inputDigest:hash(f.input())},c=>c.binding.writerFence++]){
  await assert.rejects(execute(f,{getCredentials:pins=>{const c=f.credentials(pins);mutate(c);return c;}}),/ACCESS_DENIED/);
 }assert.equal(f.wire.length,0);
});
for(const [name,headers,bytes] of [
 ['short content-length',{'content-length':'1'},new TextEncoder().encode('{}')],
 ['invalid UTF8',{},new Uint8Array([0xc3,0x28])],
 ['compressed body',{'content-encoding':'gzip'},new TextEncoder().encode('{}')],
])test('Actual Response '+name+' refuses and unlocks owned body',async()=>{
 const f=fixture();let acquired;
 await assert.rejects(execute(f,{fetchImpl:async()=>acquired=new Response(bytes,{headers:{'content-type':'application/json',...headers}})}));
 assert.equal(acquired.body.locked,false);
});
test('Malformed response status cancels an unread owned body without waiting on transport cancellation',async()=>{
 const f=fixture();let cancelled=0;
 await assert.rejects(execute(f,{fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}}),{status:403,headers:{'content-type':'application/json'}})}),/INVALID_RESULT/);
 assert.equal(cancelled,1);
});
