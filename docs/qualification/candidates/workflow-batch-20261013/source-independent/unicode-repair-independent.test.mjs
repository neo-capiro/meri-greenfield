/** Independent private mail boundary controls; full source and grant owners unchanged. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';import {createServer} from 'node:http';import {once} from 'node:events';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const load=path=>import(pathToFileURL(root+'/'+path));
const {createMailBodySection,assertMailBodySection}=await load('packages/contracts/retrieval-0.2/mail-utf16.mjs');
const {createMailFixture,uuid}=await load('apps/gateway/sources/mail/test/fixtures.mjs');
const {createMailReadHandler}=await load('apps/gateway/sources/mail/handler.mjs');
const {createMailHttpAdapter}=await load('apps/gateway/sources/mail/http-adapter.mjs');
const {createCurrentToolAuthority}=await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createToolDispatch}=await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex'),clone=x=>structuredClone(x);
function source(full,limit=1){
 const f=createMailFixture('mail.read_thread');f.args.messageId=uuid('9');f.args.maxCharacters=limit;
 const state={revoked:false},counts={fetch:0,reserve:0,settle:0,uncertain:0},wire=[];let reservation=0;const reserved=new Set(),settled=new Set();
 function page(selection){const p=f.page(selection),row=p.messages[0];
  row.contentSha256=sha(full);row.section=createMailBodySection(full,selection.bodyOffset,selection.maxCharacters);
  p.nextBodyOffsets=row.section.hasMore?[{messageId:row.messageId,bodyOffset:row.section.endExclusive}]:[];p.coverage.truncated=row.section.hasMore;
  state.changePage?.(p);return p;
 }
 const config={...f.config,fetchImpl:async(url,options)=>{counts.fetch++;wire.push({url,options});const body=JSON.parse(options.body);const p=page(body.input);state.afterFetch?.();return new Response(JSON.stringify(p),{headers:{'content-type':'application/json'}});}};
 const authority=createCurrentToolAuthority({now:()=>f.state.now,maxFactBytes:1048576,ports:{async verifyCapability(){if(state.revoked)throw Error('SYNTHETIC_REVOKED');return JSON.stringify(f.claims);},async currentRun(){return JSON.stringify({binding:f.binding,policyRevision:f.authority.policyRevision,deadlineMs:f.authority.deadlineMs,checkedAtMs:f.state.now});},async authorizeBusiness(){return JSON.stringify({decision:f.authority.decision,subject:f.subject,grants:f.contract.descriptor.requiredGrants});},async authorizeSources(){return JSON.stringify({sourceIds:f.authority.sourceIds,enabled:true,policyRevision:f.authority.policyRevision,checkedAtMs:f.state.now});}}});
 const gateway=fetchImpl=>createToolDispatch({catalog:{entry:()=>({contract:f.contract,descriptor:f.contract.descriptor,execute:createMailReadHandler({operation:f.operation,adapter:createMailHttpAdapter({...config,...(fetchImpl?{fetchImpl}:{})}),now:()=>f.state.now})}),discoverable:()=>[]},authority,budget:{async reserve({reservationId}){assert.equal(reserved.has(reservationId),false);reserved.add(reservationId);counts.reserve++;return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){assert.equal(reserved.has(reservationId),true);assert.equal(settled.has(reservationId),false);settled.add(reservationId);counts.settle++;return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){counts.uncertain++;}},limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:1000,maxCleanupMs:30},now:()=>f.state.now,newId:()=>`90000000-0000-4000-8000-${String(++reservation).padStart(12,'0')}`,sourceEnabled:true});
 const g=gateway();return {f,state,counts,wire,page,gateway,run:(bodyOffset=0,active=g)=>active.execute(JSON.stringify({operation:f.operation,arguments:{...f.args,bodyOffset}}),'SYNTHETIC_OPAQUE')};
}
test('Independent all-offset corpus keeps bounded original UTF16 positions, exact scalar slices and positive progress',()=>{
 const corpus=['','ABC','😀','A😀B','😀😀','A😀𐐷e\u0301Z','👩\u200d💻\r\n汉字🧪','\u0000\ufeff\uffff😀'];let cases=0;
 for(const full of corpus)for(let offset=0;offset<=full.length+2;offset++)for(const limit of [1,2,3,4,8,2000,6000]){
  const p=createMailBodySection(full,offset,limit),requestedStart=Math.min(offset,full.length),requestedEnd=Math.min(full.length,offset+limit);
  assertMailBodySection(p,offset,limit);assert.equal(p.text,full.slice(p.start,p.endExclusive));assert.equal(p.text.isWellFormed(),true);assert.equal(p.totalCodeUnits,full.length);
  assert.ok(p.start===requestedStart||p.start===requestedStart-1);if(p.start!==requestedStart)assert.equal(p.text.codePointAt(0)>0xffff,true);
  assert.ok(p.endExclusive===requestedEnd||p.endExclusive===requestedEnd-1||limit===1&&p.endExclusive===requestedEnd+1);
  assert.ok(p.text.length<=limit+1);assert.equal(p.hasMore,p.endExclusive<full.length);
  if(offset<full.length)assert.ok(p.endExclusive>offset);else assert.deepEqual([p.start,p.endExclusive,p.text,p.hasMore],[full.length,full.length,'',false]);cases++;
 }console.log(JSON.stringify({case:'all-offset Unicode corpus',cases}));
});
test('Sequential scalar paging reconstructs combining/ZWJ/astral text and original SHA without overlap',()=>{
 const full='A😀👩\u200d💻e\u0301𐐷Z';for(let limit=1;limit<=9;limit++){
  let offset=0,joined='',pages=0;while(offset<full.length){const p=createMailBodySection(full,offset,limit);assert.equal(p.start,offset);assert.ok(p.endExclusive>offset);joined+=p.text;offset=p.endExclusive;assert.ok(++pages<=full.length);}
  assert.equal(joined,full);assert.equal(sha(joined),sha(full));
 }
});
test('BMP-only producer output remains the exact original requested span',()=>{
 for(const full of ['','ordinary\r\ntext','e\u0301汉字'])for(let offset=0;offset<=full.length+1;offset++)for(let limit=1;limit<=8;limit++){
  const p=createMailBodySection(full,offset,limit);assert.equal(p.start,Math.min(offset,full.length));assert.equal(p.endExclusive,Math.min(full.length,offset+limit));
 }
});
test('Six-thousand-unit edge and explicit mid-pair requests remain bounded and well formed',()=>{
 const full='😀'+'a'.repeat(6000)+'😀Z',p=createMailBodySection(full,1,6000);assert.equal(p.start,0);assert.equal(p.endExclusive,6001);assert.equal(p.text.length,6001);assertMailBodySection(p,1,6000);
 const crossing=createMailBodySection('a'.repeat(1999)+'😀DECISIVE',0,2000);assert.equal(crossing.endExclusive,1999);assert.equal(crossing.text.length,1999);assert.equal(crossing.hasMore,true);
});
test('Lone surrogates and malformed helper inputs refuse without replacement or hostile conversion',()=>{
 for(const text of ['\ud800','\udfff','A\ud800B','A\udfffB'])assert.throws(()=>createMailBodySection(text,0,1));
 for(const offset of [-1,0.5,NaN,Infinity])assert.throws(()=>createMailBodySection('😀',offset,1));
 for(const limit of [0,0.5,6001,NaN])assert.throws(()=>createMailBodySection('😀',0,limit));
 let touched=0;assert.throws(()=>createMailBodySection({toString(){touched++;return '😀';}},0,1));assert.equal(touched,0);
});
test('Actual canonical page refuses lone surrogates, arbitrary gaps, backward spans and expanded ASCII',()=>{
 const x=source('😀ABCDE',1),selection=x.f.contract.normalizeInput(x.f.args,{nowMs:x.f.state.now}).input,base=x.page(selection);
 for(const mutate of [p=>p.messages[0].section.text='\ud83d',p=>p.messages[0].section.text='\ude00',p=>p.messages[0].section.start=-1,p=>p.messages[0].section.endExclusive=4,p=>p.messages[0].section.hasMore=false,p=>p.nextBodyOffsets[0].bodyOffset++,p=>p.messages[0].section.unit='unicode-scalar',p=>p.messages[0].section={start:0,endExclusive:2,totalCodeUnits:7,text:'ab',unit:'utf16-code-unit',hasMore:true}]){
  const bad=clone(base);mutate(bad);assert.throws(()=>x.f.contract.assertOutput(bad,{request:x.f.args}));
 }
 const ascii=source('ABCDE',4),input=ascii.f.contract.normalizeInput(ascii.f.args,{nowMs:ascii.f.state.now}).input,bad=ascii.page(input);
 bad.messages[0].section.endExclusive=2;bad.messages[0].section.text='AB';bad.nextBodyOffsets[0].bodyOffset=2;assert.throws(()=>ascii.f.contract.assertOutput(bad,{request:ascii.f.args}));
});
test('Unknown/missing body disclosure keeps prior offset/null cursor rules and does not get a pair expansion',()=>{
 assert.doesNotThrow(()=>assertMailBodySection({start:7,endExclusive:7,totalCodeUnits:null,text:null,hasMore:null},7,1));
 assert.throws(()=>assertMailBodySection({start:7,endExclusive:9,totalCodeUnits:null,text:'😀',hasMore:null},7,1));
 assert.throws(()=>assertMailBodySection({start:6,endExclusive:8,totalCodeUnits:null,text:'😀',hasMore:null},7,1));
});
for(const limit of [1,2,3,2000])test('Actual gateway budget'+limit+' releases each well-formed section and reconstructs immutable full SHA',async()=>{
 const full=limit===2000?'a'.repeat(1999)+'😀DECISIVE':'A😀𐐷e\u0301👩\u200d💻Z',x=source(full,limit);let offset=0,joined='',pages=0;
 do{const request={...x.f.args,bodyOffset:offset},expected=x.f.contract.normalizeInput(request,{nowMs:x.f.state.now}).argumentsSha256,p=JSON.parse(await x.run(offset)),row=p.messages[0];
  assert.equal(p.argumentsSha256,expected);assert.equal(row.section.start,offset);assert.equal(row.section.text.isWellFormed(),true);assert.equal(row.contentSha256,sha(full));assert.equal(row.recordVersionId,'synthetic-message-v1');assert.deepEqual(row.scopes,x.f.subject.scopes);assert.equal(p.evidenceReady,false);
  joined+=row.section.text;offset=row.section.endExclusive;if(row.section.hasMore)assert.equal(p.nextBodyOffsets[0].bodyOffset,offset);else assert.deepEqual(p.nextBodyOffsets,[]);assert.ok(++pages<=full.length+1);
 }while(offset<full.length);assert.equal(joined,full);assert.equal(sha(joined),sha(full));assert.equal(x.counts.settle,pages);assert.equal(x.counts.uncertain,0);
});
test('Explicit mid-pair gateway request keeps original input digest and actual source overlap',async()=>{
 const x=source('😀TAIL',1),request={...x.f.args,bodyOffset:1},expected=x.f.contract.normalizeInput(request,{nowMs:x.f.state.now}).argumentsSha256,p=JSON.parse(await x.run(1));
 assert.equal(p.argumentsSha256,expected);assert.deepEqual([p.messages[0].section.start,p.messages[0].section.endExclusive,p.messages[0].section.text],[0,2,'😀']);assert.equal(p.nextBodyOffsets[0].bodyOffset,2);assert.equal(x.counts.settle,1);
});
test('Revocation after a Unicode section still refuses release and preserves uncertain accounting',async()=>{
 const x=source('😀TAIL',1);x.state.afterFetch=()=>{x.state.revoked=true;};await assert.rejects(x.run(),/ACCESS_DENIED/);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Actual loopback Fetch uses the canonical producer helper and unmodified request/hash/authority protocol',async()=>{
 const full='a'.repeat(1999)+'😀DECISIVE',x=source(full,2000),observed=[];
 const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);observed.push(body);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(x.page(body.input)));});server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();
 try{const gateway=x.gateway((_url,options)=>fetch('http://127.0.0.1:'+address.port+'/mail',options));const first=JSON.parse(await x.run(0,gateway)),last=JSON.parse(await x.run(first.nextBodyOffsets[0].bodyOffset,gateway));assert.equal(first.messages[0].section.text+last.messages[0].section.text,full);assert.equal(x.counts.settle,2);assert.equal(observed[0].input.maxCharacters,2000);assert.equal(observed[1].input.bodyOffset,1999);assert.deepEqual(Object.keys(observed[0]).sort(),['input','metadata']);assert.equal(Object.hasOwn(observed[0],'authority'),false);assert.equal(hash(first).length,64);}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));assert.equal(server.listening,false);}
});
