/** Actual source mount/authority/budget dispatch; HTTP fixtures are synthetic only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import * as contracts from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createRuntimeCatalog} from '../catalog/runtime-catalog.mjs';
import {createSourceDisabledGateway} from '../index.mjs';
import {createOriginalTrackingSourceMount} from '../sources/original-tracking/mount.mjs';
import {fixture,NOW,uuid,limits} from './fixtures.mjs';
const CLIENT=uuid('9'),ACTION=uuid('8'),T=new Date(NOW).toISOString(),operations=['query_tasks','query_action_items'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function nativeTask(input) {
  const content={id:input.taskId??uuid('a'),title:'Synthetic task',body:'Synthetic tracked work',status:'todo',ownerUserId:input.ownerUserId??'synthetic-actor',
    dueDate:'2026-10-11T00:00:00.000Z',clientId:input.clientId,clientName:input.clientId===null?null:'Synthetic Client',meetingId:null,meetingTitle:null,
    contactId:null,mailThreadId:null,sourceType:null,sourceId:null,createdByUserId:'synthetic-actor',createdAt:T,updatedAt:T};
  return {...content,...(input.clientId===null?{overdue:true}:{}),recordKind:'native_task',recommendation:false,
    nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'Native status does not prove delivery.'},
    sourceProof:{version:1,owner:'engagement_tasks',sourceRecordId:content.id,currentClientId:content.clientId,sourceVersion:T,contentSha256:hash(content),linkedSources:[]}};
}
function nativeAction(input) {
  const content={id:input.actionItemId??ACTION,districtKey:null,clientId:input.clientId,clientName:'Synthetic Client',peCode:null,programId:null,deltaId:null,
    actionType:'protect_funding',issueTitle:'Synthetic issue',whatChanged:'Synthetic change',whyItMatters:'Synthetic relevance',recommendedAction:'Synthetic action',
    targetAudience:[],suggestedArtifactType:null,deadline:null,deadlineSource:null,ownerUserId:'synthetic-actor',priority:1,confidence:{},uncertainty:null,evidence:[],
    status:'new',dismissalReason:null,outcome:null,createdAt:T,updatedAt:T,title:'Synthetic issue',body:'Synthetic action'};
  return {...content,recordKind:'action_recommendation',recommendation:true,acceptedAsTask:false,
    nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'Recommendation is not an accepted or completed task.'},
    sourceProof:{version:1,owner:'action_recommendation',sourceRecordId:content.id,currentClientId:input.clientId,sourceVersion:T,contentSha256:hash(content),linkedSources:[]}};
}
function setup(id,args={clientId:CLIENT}) {
  const f=fixture(),operation={id,version:'0.2.0'},contract=contracts.resolveOperationContract(operation),wire=[];
  f.state.grants=['tool.read'];Object.assign(f.subject,{kind:args.clientId===undefined?'portfolio':'client',entityType:'client',entityIds:[CLIENT],
    rosterVersionId:args.clientId===undefined?'synthetic-current-authorized-roster':null});
  Object.assign(f.claims.scopes[0],{kind:args.clientId===undefined?'tenant':'client',resourceId:args.clientId===undefined?f.binding.tenantId:CLIENT});
  const original=f.ports.authorizeBusiness;
  f.ports.authorizeBusiness=async(...x)=>{const v=JSON.parse(await original(...x));v.decision.operation=`${id}@0.2.0`;return JSON.stringify(v);};
  f.ports.authorizeSources=async()=>JSON.stringify({sourceIds:contract.descriptor.sourceRequirements.map(s=>s.sourceId),enabled:f.state.sourceEnabled,
    policyRevision:f.claims.policyRevision,checkedAtMs:f.state.now});
  const normalizationContext=id==='query_tasks'?{nowMs:NOW,actorId:f.binding.actorId}:{actorId:f.binding.actorId};
  const normalized=contract.normalizeInput(args,normalizationContext),input=normalized.input,task=id==='query_tasks',rows=task?'tasks':'actions';
  const resumed=input.cursorApplied,total=resumed?50:1,scope=task?{kind:input.clientId===null?'authorized_tasks':'client',tenantId:f.binding.tenantId,actorUserId:f.binding.actorId,
    ownerUserId:input.ownerUserId,taskId:input.taskId,status:input.status,dueBefore:input.dueBefore,offset:resumed?25:0,limit:input.limit,cursorApplied:resumed}:
    {actionItemId:input.actionItemId,status:input.status,sort:input.sort,page:resumed?2:1,limit:input.limit,cursorApplied:resumed};
  const hasMore=task?scope.offset+1<total:scope.page*scope.limit<total,complete=!resumed&&!hasMore;
  const native={tool:id,generatedAt:T,clientId:input.clientId,total,returned:1,[rows]:[task?nativeTask(input):nativeAction(input)],scope,
    coverage:{sourceStatus:'healthy',sourceReason:null,complete,partial:!complete,paginationComplete:!hasMore,hasMore,nextCursor:hasMore?'OPAQUE-NEXT':null,
      totalIsExactForScope:true,absenceSupported:false,note:'Synthetic source assertion only.'}};
  const credential=pins=>{const {deadlineMs,signal,...value}=pins;return {...value,bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+10000};};
  const config={operation,sourceIdentity:contract.descriptor.sourceRequirements[0],origin:'https://original.example.invalid',now:()=>f.state.now,newId:()=>uuid('7'),
    maxRequestMs:300,maxResponseBytes:65536,getCredentials:async pins=>{f.calls.push('credentials');return credential(pins);},
    fetchImpl:async(url,options)=>{f.calls.push('http');wire.push({url,options});return new Response(JSON.stringify(native),{headers:{'content-type':'application/json'}});}};
  const direct=()=>({input:normalized.input,request:args,argumentsSha256:normalized.argumentsSha256,normalizationContext,
    authority:{binding:f.binding,subject:f.subject,claims:f.claims,policyRevision:f.claims.policyRevision,sourceIds:[config.sourceIdentity.sourceId],deadlineMs:NOW+10000,
      decision:{decisionId:f.subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},operation:`${id}@0.2.0`,scopes:f.subject.scopes,
        policyRevision:f.claims.policyRevision,evaluatedAt:T,decision:'allowed',reasonCode:'SYNTHETIC_ONLY'}}});
  const create=(changes={})=>{const mount=createOriginalTrackingSourceMount({...config,...changes});
    const entry={descriptor:contract.descriptor,contract,execute:mount.execute};
    return createToolDispatch({catalog:{entry:ref=>canonicalSha256(ref)===canonicalSha256(operation)?entry:null,discoverable:()=>[]},
      authority:f.authority,budget:f.budget,limits,now:()=>f.state.now,newId:()=>uuid('7'),sourceEnabled:true});};
  return {...f,operation,contract,config,native,wire,credential,direct,create,rows,run:(changes={},signal)=>create(changes).execute(JSON.stringify({operation,arguments:args}),'WORKER_CREDENTIAL',signal)};
}
for(const id of operations) {
  test(`${id}: actual mounted adapter decodes Fetch Response and preserves original identity/proofs`,async()=>{
    const f=setup(id),page=JSON.parse(await f.run());assert.equal(page.operation.id,id);assert.deepEqual(page[f.rows],f.native[f.rows]);
    assert.deepEqual(page.scope,f.native.scope);assert.deepEqual(page.pageCoverage,f.native.coverage);assert.deepEqual(page.binding,f.binding);assert.deepEqual(page.subject,f.subject);
    assert.equal(page.sources[0].sourceId,f.config.sourceIdentity.sourceId);assert.equal(page.sources[0].authority,'authoritative');assert.equal(page.sources[0].status,'partial');
    assert.equal(page.evidenceReady,false);assert.deepEqual(page.negativeAssertion,{kind:'none'});assert.equal(page.coverage.enumeration,'unknown');
    assert.equal(page.coverage.enumerableTotal,null);assert.equal(page.snapshotVersionId,null);assert.equal(page.sources[0].freshness,'unknown');assert.equal(page.sources[0].asOf,null);
    assert.equal(f.wire[0].url,`https://original.example.invalid/api/clio/tools/${id}`);assert.ok(!JSON.stringify(f.wire).includes('WORKER_CREDENTIAL'));
    assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.credentials,'omit');assert.ok(f.calls.indexOf('reserve')<f.calls.indexOf('credentials'));
    assert.equal(f.calls.filter(x=>x==='settle').length,1);
  });
  test(`${id}: native opaque cursor stays opaque and explicitly incomplete`,async()=>{
    const f=setup(id,{clientId:CLIENT,cursor:' OPAQUE ',limit:20}),page=JSON.parse(await f.run());assert.equal(JSON.parse(f.wire[0].options.body).cursor,'OPAQUE');
    assert.equal(page.scope.cursorApplied,true);assert.equal(page.coverage.truncated,true);assert.deepEqual(page.continuation,{cursor:null,requiredReads:[],remainingSources:[]});
    assert.equal(page.evidenceReady,false);
  });
  test(`${id}: native empty coverage assertion never becomes Meri absence evidence`,async()=>{
    const f=setup(id);Object.assign(f.native,{total:0,returned:0,[f.rows]:[]});f.native.coverage.absenceSupported=true;
    const page=JSON.parse(await f.run());assert.equal(page.pageCoverage.absenceSupported,true);assert.equal(page.evidenceReady,false);
    assert.deepEqual(page.negativeAssertion,{kind:'none'});assert.equal(page.coverage.enumeration,'unknown');assert.equal(page.sources[0].snapshotVersionId,null);
  });
  test(`${id}: exact native identity remains a filter in the authorized client scope`,async()=>{
    const identity=uuid('d'),f=setup(id,{clientId:CLIENT,[id==='query_tasks'?'taskId':'actionItemId']:identity}),page=JSON.parse(await f.run());
    assert.equal(page[f.rows][0].id,identity);assert.equal(page[f.rows][0].sourceProof.sourceRecordId,identity);assert.equal(page.subject.entityIds[0],CLIENT);
    assert.equal(JSON.parse(f.wire[0].options.body)[id==='query_tasks'?'taskId':'actionItemId'],identity);
  });
  test(`${id}: original source identity cannot be substituted with derived successor`,()=>{
    const f=setup(id);for(const sourceIdentity of [{sourceId:'action_items_complete',authority:'derived',purpose:'evidence'},
      {...f.config.sourceIdentity,authority:'derived'},{...f.config.sourceIdentity,sourceId:'foreign'}])assert.throws(()=>createOriginalTrackingSourceMount({...f.config,sourceIdentity}),/GATEWAY_CONFIGURATION/);
    assert.throws(()=>createOriginalTrackingSourceMount({...f.config,operation:{id:'actions.query',version:'0.2.0'}}),/GATEWAY_CONFIGURATION/);assert.deepEqual(f.calls,[]);
  });
  test(`${id}: fixed route and closed configuration are inert`,()=>{
    const f=setup(id);for(const origin of ['http://x.invalid','https://x.invalid/path','https://user:pass@x.invalid','https://x.invalid?q','https://x.invalid#x'])
      assert.throws(()=>createOriginalTrackingSourceMount({...f.config,origin}));assert.throws(()=>createOriginalTrackingSourceMount({...f.config,url:'x'}));assert.deepEqual(f.calls,[]);
  });
  test(`${id}: current revocation/fence/source/budget refusal precedes credential acquisition`,async()=>{
    for(const kind of ['revoked','fence','source','budget']){const f=setup(id);if(kind==='revoked')f.state.revoked=true;if(kind==='fence')f.state.fence=2;
      if(kind==='source')f.state.sourceEnabled=false;if(kind==='budget')f.budget.reserve=async()=>JSON.stringify({reservationId:uuid('0'),decision:'reserved'});
      await assert.rejects(f.run());assert.ok(!f.calls.includes('credentials'));assert.ok(!f.calls.includes('http'));}
  });
  test(`${id}: credential correlation binds full run, current subject, operation and original source`,async()=>{
    for(const change of [c=>c.binding.writerFence++,c=>c.binding.runId=uuid('c'),c=>c.subject.authorizationDecisionId=uuid('c'),c=>c.operation.id='actions.query',
      c=>c.sourceIdentity.authority='derived',c=>c.sourceIds=['action_items_complete'],c=>c.argumentsSha256='0'.repeat(64),c=>c.expiresAtMs=NOW]){
      const f=setup(id);await assert.rejects(f.run({getCredentials:async pins=>{const c=structuredClone(f.credential(pins));change(c);return c;}}));assert.ok(!f.calls.includes('http'));}
  });
  test(`${id}: hostile credential accessors and proxies never execute introspection`,async()=>{
    for(const kind of ['getter','proxy']){const f=setup(id);let effects=0;
      await assert.rejects(f.run({getCredentials:async pins=>{const c=f.credential(pins);if(kind==='getter')Object.defineProperty(c,'bearerToken',{enumerable:true,get(){effects++;return 'x';}});
        else return new Proxy(c,{get(t,k){if(k==='then')return undefined;effects++;return Reflect.get(t,k);},getPrototypeOf(){effects++;return Object.prototype;}});return c;}}));
      assert.equal(effects,0);assert.ok(!f.calls.includes('http'));}
  });
  test(`${id}: original rows, owner/proof and scope corruption cannot settle`,async()=>{
    for(const change of [p=>p.clientId=uuid('b'),p=>p.tool='actions.query',p=>p[frows(p)][0].sourceProof.owner='action_items_complete',
      p=>p[frows(p)][0].sourceProof.contentSha256='a'.repeat(64),p=>p[frows(p)][0].title='corrupt',p=>p.scope.limit=1,p=>p.coverage.complete=false,p=>p.extra=true]){
      const f=setup(id);change(f.native);await assert.rejects(f.run(),/INVALID_RESULT/);assert.ok(!f.calls.includes('settle'));assert.ok(f.calls.includes('uncertain'));}
  });
  test(`${id}: direct admission rejects forged authority/input before source effect`,async()=>{
    for(const change of [c=>c.authority.sourceIds=['action_items_complete'],c=>c.authority.claims.binding={...c.authority.binding,writerFence:2},
      c=>c.authority.decision.decision='denied',c=>c.authority.subject.authorizationDecisionId=uuid('b'),c=>c.input.limit=1,c=>c.argumentsSha256='f'.repeat(64)]){
      const f=setup(id),call=structuredClone(f.direct());change(call);await assert.rejects(createOriginalTrackingSourceMount(f.config).execute(call));assert.deepEqual(f.calls,[]);}
  });
  test(`${id}: mismatched operation and current client decision refuse without credentials`,async()=>{
    for(const change of [c=>c.authority.subject.entityIds=[uuid('b')],c=>c.authority.decision.operation='actions.query@0.2.0',
      c=>c.normalizationContext.actorId='foreign',c=>c.authority.claims.actions=[]]){
      const f=setup(id),call=structuredClone(f.direct());change(call);await assert.rejects(createOriginalTrackingSourceMount(f.config).execute(call));assert.deepEqual(f.calls,[]);}
  });
  test(`${id}: strict Fetch response protocol and body byte decoding retain uncertainty`,async()=>{
    for(const kind of ['status','media','encoding','length','overflow','utf8','json','fake']){
      const f=setup(id);await assert.rejects(f.run({maxResponseBytes:kind==='overflow'?64:65536,fetchImpl:async()=>kind==='fake'?{status:200,json:async()=>f.native}:
        new Response(kind==='utf8'?new Uint8Array([0xc3,0x28]):kind==='json'?'{':JSON.stringify(f.native),{status:kind==='status'?403:200,
          headers:{'content-type':kind==='media'?'text/html':'application/json',...(kind==='encoding'?{'content-encoding':'gzip'}:{}),...(kind==='length'?{'content-length':'1'}:{})}})}));
      assert.ok(!f.calls.includes('settle'));assert.ok(f.calls.includes('uncertain'));}
  });
  for(const stage of ['credentials','fetch','body'])test(`${id}: parked ${stage} expires and late body is retired`,async()=>{
    const f=setup(id),park=Promise.withResolvers();let pins,cancelled=false;const changes={maxRequestMs:20};
    if(stage==='credentials')changes.getCredentials=value=>{pins=value;return park.promise;};if(stage==='fetch')changes.fetchImpl=()=>park.promise;
    if(stage==='body')changes.fetchImpl=async()=>new Response(new ReadableStream({pull(){return park.promise;},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
    await assert.rejects(f.run(changes),/DEADLINE/);const before=[...f.calls];park.resolve(stage==='credentials'?f.credential(pins):stage==='fetch'?
      new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}):undefined);
    await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls,before);assert.ok(!f.calls.includes('settle'));if(stage!=='credentials')assert.equal(cancelled,true);
  });
  test(`${id}: revocation after read/settle prevents result release`,async()=>{
    for(const phase of ['read','settle']){const f=setup(id);if(phase==='settle'){const settle=f.budget.settle;f.budget.settle=async x=>{const ack=await settle(x);f.state.revoked=true;return ack;};}
      await assert.rejects(f.run(phase==='read'?{fetchImpl:async()=>{f.state.revoked=true;return new Response(JSON.stringify(f.native),{headers:{'content-type':'application/json'}});}}:{}),/ACCESS_DENIED/);
      assert.equal(f.calls.includes('settle'),phase==='settle');assert.equal(f.calls.includes('uncertain'),phase==='read');}
  });
  test(`${id}: cancellation cancels acquired body before settlement`,async()=>{
    const f=setup(id),controller=new AbortController();let cancelled=false;
    await assert.rejects(f.run({fetchImpl:async()=>{controller.abort();return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});}},controller.signal),/CANCELLED/);
    await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);assert.ok(!f.calls.includes('settle'));
  });
  test(`${id}: passive mount does not enable frozen catalog/production gateway`,async()=>{
    const f=setup(id),mount=createOriginalTrackingSourceMount(f.config),view=createRuntimeCatalog({catalogJson:JSON.stringify(catalog),contracts});
    assert.equal(mount.qualification,'pending');assert.equal(mount.availability,'source-implemented');assert.ok(mount.liveGate.includes('native original producer identity'));
    assert.equal(view.entry(f.operation),null);assert.equal(f.contract.descriptor.handler,null);assert.equal(f.contract.descriptor.availability,'unimplemented');
    const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')});
    await assert.rejects(gateway.execute(JSON.stringify({operation:f.operation,arguments:{clientId:CLIENT}}),'synthetic'),/UNAVAILABLE/);assert.deepEqual(f.calls,[]);
  });
}
function frows(page){return page.tool==='query_tasks'?'tasks':'actions';}
test('tasks: assignedToMe and overdue clock use trusted actor/default without model owner authority',async()=>{
  const f=setup('query_tasks',{clientId:CLIENT,assignedToMe:true,status:' OVERDUE '}),page=JSON.parse(await f.run());const body=JSON.parse(f.wire[0].options.body);
  assert.equal(page.selection.ownerUserId,f.binding.actorId);assert.equal(body.assignedToMe,true);assert.equal(body.status,'overdue');assert.equal(body.dueBefore,T);
  assert.ok(!Object.hasOwn(body,'ownerUserId'));
});
test('tasks: authorized portfolio scope preserves native overdue disclosure',async()=>{
  const f=setup('query_tasks',{}),page=JSON.parse(await f.run());assert.equal(page.subject.kind,'portfolio');assert.equal(page.scope.kind,'authorized_tasks');
  assert.equal(page.tasks[0].overdue,true);assert.equal(page.clientId,null);
});
test('tasks: frozen normalization clock survives adapter latency without reselecting overdue cutoff',async()=>{
  const f=setup('query_tasks',{clientId:CLIENT,status:'overdue'});f.state.now=NOW+50;
  const page=JSON.parse(await createOriginalTrackingSourceMount(f.config).execute(f.direct()));
  assert.equal(page.selection.dueBefore,T);assert.equal(JSON.parse(f.wire[0].options.body).dueBefore,T);assert.equal(page.sources[0].retrievedAt,new Date(NOW+50).toISOString());
});
test('original action: client-less mode remains unavailable and successor is untouched',async()=>{
  const f=setup('query_action_items');await assert.rejects(f.create().execute(JSON.stringify({operation:f.operation,arguments:{}}),'synthetic'));
  assert.ok(!f.calls.includes('reserve'));assert.ok(!f.calls.includes('credentials'));
  const successor=contracts.resolveOperationContract({id:'actions.query',version:'0.2.0'});assert.equal(successor.descriptor.sourceRequirements[0].authority,'derived');
  assert.equal(successor.descriptor.sourceRequirements[0].sourceId,'action_items_complete');assert.equal(f.contract.binding.supersededBy,'actions.query');
});
