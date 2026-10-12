/** Independent synthetic ports through canonical contracts, authority and dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.MAIL_GATEWAY_REVIEW_ROOT?pathToFileURL(`${process.env.MAIL_GATEWAY_REVIEW_ROOT}/`):new URL('../../../',import.meta.url);
const load=p=>import(new URL(p,root));
const {canonicalSha256}=await load('packages/contracts/validate.mjs');
const contracts=await load('packages/contracts/retrieval-0.2/validate.mjs');
const {createToolDispatch}=await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {createCurrentToolAuthority}=await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createSourceDisabledGateway}=await load('apps/gateway/index.mjs');
const NOW=Date.parse('2026-10-12T04:00:00Z'), ANCHOR='2026-10-11T04:00:00.000Z';
const id=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const clone=v=>JSON.parse(JSON.stringify(v));
const stable=s=>{const {authorizationDecisionId:ignored,...rest}=s;return rest;};
const drain=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const limits={maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:1500,maxCleanupMs:30};
// Literal hashes of these two synthetic normalized first selections. Production
// must use the canonical contract; this test does not implement a filter digest.
const filterPins={list:'233bebb882105e20337d618803b01ad71e54c786cd379945c6dc05d2f5cff965',search:'7d13404ccbbba337cee48e0aeb09b86c8a518afce42381ad6fd357f4d6226d7a'};

function fixture(kind='list'){
  const operation={id:`mail.${kind}_messages`,version:'0.2.0'};
  const args={subject:{kind:'personal'},limit:1,...(kind==='search'?{query:' alpha '}:{})};
  const events=[],stored=new Map(),state={now:NOW,checks:0,total:3,revoked:false};
  const binding={tenantId:id('1'),actorId:id('2'),conversationId:id('3'),runId:id('4'),attemptId:id('5'),workerId:id('6'),writerFence:1};
  const scope={tenantId:binding.tenantId,kind:'mailbox',resourceId:id('9'),policyRevision:'mail-review-policy'};
  const subject={kind:'personal',entityType:'user',entityIds:[binding.actorId],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id('a'),policyRevision:scope.policyRevision,scopes:[scope],rosterVersionId:null};
  const claims={capabilityId:id('7'),issuer:'independent-synthetic',audience:'meri-gateway',binding,actions:['tool.read'],scopes:[scope],issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:scope.policyRevision,budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:1,maxOutputBytes:65536}};
  const contract=contracts.resolveOperationContract(operation),descriptor=contract.descriptor;
  const authorityPorts={
    async verifyCapability(){events.push('capability');if(state.revoked)throw Error('synthetic denial');return JSON.stringify(claims);},
    async currentRun(){events.push('run');return JSON.stringify({binding,policyRevision:scope.policyRevision,deadlineMs:state.deadline??NOW+10000,checkedAtMs:state.now});},
    async authorizeBusiness({input}){events.push('policy');state.inputs??=[];state.inputs.push(clone(input));if(state.rotate)subject.authorizationDecisionId=id(String(state.checks));
      return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${operation.id}@${operation.version}`,scopes:subject.scopes,policyRevision:scope.policyRevision,evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},subject,grants:descriptor.requiredGrants});},
    async authorizeSources(){events.push('sources');return JSON.stringify({sourceIds:[...new Set(descriptor.sourceRequirements.map(x=>x.sourceId))],enabled:true,policyRevision:scope.policyRevision,checkedAtMs:state.now});}
  };
  const actual=createCurrentToolAuthority({ports:authorityPorts,now:()=>state.now,maxFactBytes:65536});
  const authority={identify(call){state.limitDeadline=call.limitDeadline;return actual.identify(call);},check(call){state.checks++;state.beforeCheck?.(state.checks);return actual.check(call);}};
  const budget={
    async reserve({reservationId}){events.push('reserve');state.beforeReserve?.();return JSON.stringify({reservationId,decision:'reserved'});},
    async settle({reservationId}){events.push('settle');state.beforeSettle?.();return JSON.stringify({reservationId,decision:'settled'});},
    async markUncertain(){events.push('uncertain');}
  };
  const contextPorts={
    async loadPrevious(call){events.push('load');state.loadCall=call;const receipt={record:stored.get(canonicalSha256(call.key))??null,checkedAtMs:state.now};return state.rawLoad??JSON.stringify(state.changeLoad?state.changeLoad(clone(receipt)):receipt);},
    async retain(call){events.push('retain');state.retainCall=call;state.record=clone(call.record);stored.set(canonicalSha256(call.record.key),clone(call.record));const receipt={decision:'retained',keySha256:canonicalSha256(call.record.key),previousSha256:call.record.previousSha256,checkedAtMs:state.now};return state.rawRetain??JSON.stringify(state.changeRetain?state.changeRetain(clone(receipt)):receipt);}
  };
  const entry={descriptor,contract,async execute(call){events.push('handler');state.call=call;
    const selection=call.input,offset=selection.offset,total=state.total,anchor=selection.asOf??ANCHOR;
    const message={sourceId:'mail',mailboxId:scope.resourceId,threadId:id('8'),messageId:id(['d','c','b'][offset]??'e'),recordVersionId:null,citationId:null,scopes:[scope],removed:false,connectionStatus:'disconnected',readHandle:`synthetic-read-${offset}`,internetMessageId:`<synthetic-${offset}@example.invalid>`,clientId:null,receivedAt:anchor,sentAt:null,createdAt:anchor,effectiveAt:anchor,subjectText:'Synthetic preview',preview:{kind:'incomplete-preview',text:'incomplete',fullSizeKnown:false},from:{email:null,name:null},to:[],cc:[],toTruncated:false,ccTruncated:false};
    const messages=total===0?[]:[message],more=total===null?null:offset+messages.length<total;
    const page={kind:'mail-candidate-source-page',contractVersion:'0.2.0',operation,requestId:id('e'),traceId:id('f'),binding:call.authority.binding,subject:call.authority.subject,window:{basis:'unbounded'},argumentsSha256:call.argumentsSha256,appliedFilters:[],sources:[{sourceId:'mail',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:anchor,freshness:'unknown'}],coverage:{sourcesRequested:['mail'],sourcesChecked:['mail'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:total,returnedCount:messages.length,truncated:more===true,historySupport:'bounded',limitations:['Synthetic incomplete stored candidates.']},selection,filterSha256:filterPins[kind],order:'effectiveAt-desc-nullslast_messageId-desc',snapshotVersionId:null,queryScope:{asOfInclusive:anchor,storedCreatedAtEndInclusive:anchor,effectiveStartInclusive:null,missingEffectiveDates:'included'},messages,totalMatches:total,hasMore:more,nextOffset:more===true?offset+messages.length:null,threadGroups:kind==='list'?messages.map(m=>({mailboxId:m.mailboxId,threadId:m.threadId,messageIds:[m.messageId]})):null,returnedThreadGroupCount:kind==='list'?messages.length:null,continuation:{cursor:null,requiredReads:messages.map(m=>m.readHandle),remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
    return JSON.stringify(state.changeOutput?state.changeOutput(page):page);
  }};
  const create=changes=>createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[entry]},authority,budget,limits,now:()=>state.now,newId:()=>id('b'),sourceEnabled:true,mailContextPorts:contextPorts,...changes});
  const request=patch=>JSON.stringify({operation,arguments:{...args,...patch}});
  return {kind,operation,args,events,stored,state,binding,subject,scope,claims,authorityPorts,budget,contextPorts,contract,entry,create,request};
}
async function seeded(kind='list'){
  const f=fixture(kind);const first=JSON.parse(await f.create().execute(f.request({}),'synthetic'));
  assert.equal(first.nextOffset,1);assert.equal(f.events.filter(x=>x==='retain').length,1);
  f.events.length=0;f.state.checks=0;return f;
}
const nextArgs={offset:1,asOf:ANCHOR};
async function denied(f,patch={},changes={}){await assert.rejects(f.create(changes).execute(f.request(patch),'synthetic'),/^GatewayDenied: (INVALID_ARGUMENTS|ACCESS_DENIED|INVALID_RESULT|DEADLINE|CANCELLED|BUDGET_UNCERTAIN|GATEWAY_CONFIGURATION|RESOURCE_LIMIT)$/);}

for(const kind of ['list','search'])test(`mail independent: canonical ${kind} three-page continuation`,async()=>{
  const f=fixture(kind),outputs=[];
  for(let offset=0;offset<3;offset++)outputs.push(JSON.parse(await f.create().execute(f.request(offset?{offset,asOf:ANCHOR}:{}),'synthetic')));
  assert.deepEqual(outputs.map(x=>x.nextOffset),[1,2,null]);assert.equal(f.events.filter(x=>x==='load').length,2);assert.equal(f.events.filter(x=>x==='retain').length,2);
  assert.equal(f.events.filter(x=>x==='handler').length,3);assert.equal(f.events.filter(x=>x==='settle').length,3);assert.equal(f.events.includes('uncertain'),false);
  for(const p of outputs){assert.equal(p.coverage.enumeration,'unknown');assert.equal(p.snapshotVersionId,null);assert.equal(p.evidenceReady,false);assert.deepEqual(p.negativeAssertion,{kind:'none'});assert.equal(p.continuation.requiredReads.length,1);}
  assert.equal(f.state.call.input.folder,'all');assert.equal(f.state.call.input.withinDays,null);
  if(kind==='search')assert.equal(f.state.call.input.query,'alpha');
});

test('mail independent: stable key retains exact full page and immutable snapshots',async()=>{
  const f=await seeded();const record=f.state.record;
  assert.deepEqual(record.key.binding,f.binding);assert.deepEqual(record.key.operation,f.operation);assert.deepEqual(record.key.subject,stable(f.subject));
  assert.equal(record.previousSha256,canonicalSha256(record.previousPage));assert.equal(record.previousPage.subject.authorizationDecisionId,f.subject.authorizationDecisionId);
  assert.deepEqual(record.key.selection,{subject:{kind:'personal'},limit:1,folder:'all',withinDays:null,offset:1,asOf:ANCHOR});
  assert.ok(record.expiresAtMs<=NOW+limits.maxRequestMs);assert.equal(Object.isFrozen(f.state.retainCall.record),true);assert.equal(Object.isFrozen(f.state.retainCall.record.previousPage.subject),true);
  assert.throws(()=>{f.state.retainCall.record.previousPage.messages[0].preview.text='rewrite';},TypeError);
  await f.create().execute(f.request(nextArgs),'synthetic');assert.equal(Object.isFrozen(f.state.loadCall.key.selection),true);assert.equal(Object.isFrozen(f.state.call.input),true);
});

test('mail independent: first-page current decision IDs may rotate',async()=>{
  const f=fixture();f.state.rotate=true;const out=JSON.parse(await f.create().execute(f.request({}),'synthetic'));
  assert.equal(out.subject.authorizationDecisionId,id('3'));assert.equal(f.state.checks,5);assert.equal(f.events.includes('settle'),true);
});

test('mail independent: full previous/current page decision mismatch still refuses',async()=>{
  const f=await seeded();f.subject.authorizationDecisionId=id('b');await denied(f,nextArgs);
  assert.equal(f.events.includes('load'),true);assert.equal(f.events.includes('handler'),true);assert.equal(f.events.includes('settle'),false);assert.equal(f.events.includes('uncertain'),true);
});

for(const total of [0,1,null])test(`mail independent: terminal or unknown total ${total} never retains invented continuation`,async()=>{
  const f=fixture();f.state.total=total;const out=JSON.parse(await f.create().execute(f.request({}),'synthetic'));
  assert.equal(out.nextOffset,null);assert.equal(f.events.includes('retain'),false);assert.equal(out.evidenceReady,false);assert.deepEqual(out.negativeAssertion,{kind:'none'});
});

test('mail independent: malformed shapes refuse before ports and semantic input before business effects',async()=>{
  for(const patch of [{previousPage:{}},{context:{}},{binding:{}},{subject:{kind:'personal',authorizationDecisionId:id('a')}},{offset:1},{offset:10001,asOf:ANCHOR},{limit:0},{asOf:null}]){
    const f=fixture();await denied(f,patch);assert.deepEqual(f.events,patch.offset===1?['capability','run']:[],JSON.stringify(patch));
  }
  let touched=0;const object=new Proxy({},{get(){touched++;throw Error('get');},ownKeys(){touched++;throw Error('keys');}});
  const f=fixture();await assert.rejects(f.create().execute(object,'synthetic'),/INVALID_ARGUMENTS/);assert.equal(touched,0);assert.deepEqual(f.events,[]);
});

test('mail independent: missing context ports refuse without reservation or handler',async()=>{
  const f=fixture();await denied(f,{}, {mailContextPorts:undefined});assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('handler'),false);
});

const corruptions={
  missing:r=>({...r,record:null}), digest:r=>{r.record.previousSha256='a'.repeat(64);return r;},
  keyBinding:r=>{r.record.key.binding.writerFence++;return r;},keyOperation:r=>{r.record.key.operation.id='mail.search_messages';return r;},keyPolicy:r=>{r.record.key.policyRevision='other';return r;},keySubject:r=>{r.record.key.subject.entityIds=[id('d')];return r;},keySelection:r=>{r.record.key.selection.offset++;return r;},
  staleReceipt:r=>{r.checkedAtMs=NOW-1;return r;},futureReceipt:r=>{r.checkedAtMs=NOW+1;return r;},expired:r=>{r.record.expiresAtMs=NOW;return r;},futureRecorded:r=>{r.record.recordedAtMs=NOW+1;return r;},extended:r=>{r.record.expiresAtMs=NOW+10001;return r;},extra:r=>({...r,extra:true})
};
for(const [name,change]of Object.entries(corruptions))test(`mail independent: retained ${name} refuses before budget/effect`,async()=>{
  const f=await seeded();f.state.changeLoad=change;await denied(f,nextArgs);assert.equal(f.events.includes('handler'),false);assert.equal(f.events.includes('reserve'),false);
});

for(const name of ['anchor','pageDecision','nextOffset','selection','window'])test(`mail independent: rehashed retained ${name} cannot bypass canonical continuation`,async()=>{
  const f=await seeded();f.state.changeLoad=r=>{const p=r.record.previousPage;
    if(name==='anchor')p.queryScope.asOfInclusive='2026-10-10T04:00:00.000Z';
    if(name==='pageDecision')p.subject.authorizationDecisionId=id('d');
    if(name==='nextOffset')p.nextOffset=2;
    if(name==='selection')p.selection.limit=2;
    if(name==='window')p.window={basis:'calendar',startInclusive:ANCHOR,endExclusive:'2026-10-12T04:00:00.000Z'};
    r.record.previousSha256=canonicalSha256(p);return r;};
  await denied(f,nextArgs);assert.equal(f.events.includes('settle'),false);
});

test('mail independent: raw context field accessors are rejected without invocation',async()=>{
  for(const stage of ['load','retain']){let reads=0;const f=stage==='load'?await seeded():fixture();
    const raw={};Object.defineProperty(raw,'record',{enumerable:true,get(){reads++;throw Error('record getter');}});
    f.contextPorts[stage==='load'?'loadPrevious':'retain']=async()=>raw;
    await denied(f,stage==='load'?nextArgs:{});assert.equal(reads,0);assert.equal(f.events.includes('settle'),false);
  }
});

for(const name of ['receiptDigest','receiptKey','stale','extra','oversized'])test(`mail independent: retained acknowledgment ${name} suppresses settlement`,async()=>{
  const f=fixture();f.state.changeRetain=r=>{if(name==='receiptDigest')r.previousSha256='a'.repeat(64);if(name==='receiptKey')r.keySha256='a'.repeat(64);if(name==='stale')r.checkedAtMs=NOW-1;if(name==='extra')r.extra=true;return r;};
  if(name==='oversized')f.state.rawRetain=' '.repeat(65537);
  await denied(f);assert.equal(f.events.includes('settle'),false);assert.equal(f.events.includes('uncertain'),true);
});

for(const stage of ['load','retain','settle'])test(`mail independent: revoked authority after ${stage} never releases`,async()=>{
  const f=stage==='load'?await seeded():fixture();const port=stage==='settle'?f.budget:f.contextPorts,method=stage==='load'?'loadPrevious':stage,original=port[method];
  port[method]=async call=>{const result=await original(call);f.state.revoked=true;return result;};
  await denied(f,stage==='load'?nextArgs:{});if(stage==='load')assert.equal(f.events.includes('reserve'),false);
  if(stage==='retain'||stage==='settle'){assert.equal(f.events.includes('settle'),true);assert.equal(f.events.includes('uncertain'),false,'historical settled liability stays settled');}
});

async function parkedCase(stage,cancel=false){
  const f=stage==='load'?await seeded():fixture();
  if(!cancel)f.state.beforeCheck=n=>{if(n===(stage==='load'?1:4))f.state.deadline=NOW+40;};
  const port=stage==='settle'?f.budget:f.contextPorts,method=stage==='load'?'loadPrevious':stage,original=port[method],entered=deferred(),held=deferred();
  let signal;port[method]=async call=>{f.events.push(`park:${stage}`);signal=call.signal;entered.resolve();await held.promise;return original(call);};
  const controller=new AbortController();let result=false,error;
  const pending=f.create().execute(f.request(stage==='load'?nextArgs:{}),'synthetic',controller.signal).then(()=>{result=true;},e=>{error=e.message;});
  let watchdog;try{
    await Promise.race([entered.promise,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('port not entered')),700);})]);clearTimeout(watchdog);
    if(cancel)controller.abort();
    await Promise.race([pending,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('request remained pending')),700);})]);clearTimeout(watchdog);
    assert.equal(error,cancel?'CANCELLED':'DEADLINE');assert.equal(signal.aborted,true);assert.equal(result,false);
    const before=f.events.length;held.resolve();await drain();await drain();assert.deepEqual(f.events.slice(before),[stage],'late returned port cannot start any next effect');
    assert.equal(f.events.includes('uncertain'),stage!=='load');
  }finally{clearTimeout(watchdog);controller.abort();held.resolve();await pending;}
}
for(const stage of ['load','retain','settle'])for(const cancel of [false,true])test(`mail independent: ${cancel?'cancellation':'fresh release deadline'} bounds parked ${stage}`,()=>parkedCase(stage,cancel));

test('mail independent: budget-shortened lifetime bounds retained expiry',async()=>{
  const f=fixture();f.state.beforeReserve=()=>f.state.limitDeadline(NOW+300);await f.create().execute(f.request({}),'synthetic');assert.equal(f.state.record.expiresAtMs,NOW+300);
});

test('mail independent: source-disabled canonical catalog never reaches supplied ports',async()=>{
  const f=fixture();const gateway=createSourceDisabledGateway({authorityPorts:f.authorityPorts,budget:f.budget,limits,now:()=>NOW,newId:()=>id('b')});
  const catalog=JSON.parse(readFileSync(new URL('packages/contracts/retrieval-0.2/catalog.json',root)));
  assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,45);
  for(const row of catalog.operations){assert.equal(row.availability,'unimplemented');assert.equal(row.handler,null);await assert.rejects(gateway.execute(JSON.stringify({operation:row.operation,arguments:{}}),'synthetic'),/UNAVAILABLE/);}
  assert.deepEqual(await gateway.discover(),[]);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(f.events,[]);
});


test('mail independent: context port proxy/accessor admission is inert',async()=>{
  for(const proxy of [false,true]){let touched=0;const f=fixture();
    const ports=proxy?new Proxy({},{get(){touched++;throw Error('get');},getPrototypeOf(){touched++;throw Error('prototype');},ownKeys(){touched++;throw Error('keys');}}):{retain:async()=>''};
    if(!proxy)Object.defineProperty(ports,'loadPrevious',{enumerable:true,get(){touched++;throw Error('load getter');}});
    await denied(f,{}, {mailContextPorts:ports});assert.equal(touched,0);assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('handler'),false);
  }
});

test('mail independent: shortened retained expiry bounds the next parked authority port',async()=>{
  const f=await seeded();f.state.changeLoad=r=>{r.record.expiresAtMs=NOW+40;return r;};
  const entered=deferred(),held=deferred(),original=f.authorityPorts.verifyCapability;let parkedSignal;
  f.authorityPorts.verifyCapability=async(...args)=>{if(f.state.checks===2){f.events.push('park:authority');parkedSignal=args[1].signal;entered.resolve();await held.promise;}return original(...args);};
  const controller=new AbortController();let failure,result=false;
  const pending=f.create().execute(f.request(nextArgs),'synthetic',controller.signal).then(()=>{result=true;},e=>{failure=e.message;});
  let timer;try{
    await Promise.race([entered.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('authority port not entered')),700);})]);clearTimeout(timer);
    await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('retained deadline did not bound authority')),700);})]);clearTimeout(timer);
    assert.equal(failure,'DEADLINE');assert.equal(parkedSignal.aborted,true);assert.equal(result,false);assert.equal(f.events.includes('reserve'),false);
    const at=f.events.length;held.resolve();await drain();await drain();assert.deepEqual(f.events.slice(at),['capability'],'late authority completion has no subsequent business port');
  }finally{clearTimeout(timer);controller.abort();held.resolve();await pending;}
});

test('mail independent: candidate output cannot promote previews or omit decisive reads',async()=>{
  for(const mutate of [p=>p.evidenceReady=true,p=>p.negativeAssertion={kind:'absence'},p=>p.coverage.enumeration='complete',p=>p.snapshotVersionId='fabricated',p=>p.continuation.requiredReads=[],p=>p.messages[0].preview.fullSizeKnown=true]){
    const f=fixture();f.state.changeOutput=p=>{mutate(p);return p;};await denied(f);assert.equal(f.events.includes('retain'),false);assert.equal(f.events.includes('settle'),false);assert.equal(f.events.includes('uncertain'),true);
  }
});
