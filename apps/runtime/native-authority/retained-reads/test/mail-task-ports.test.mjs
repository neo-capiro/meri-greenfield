/** Explicit provider/authority/continuation stand-ins; no production admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createCurrentToolAuthority} from '../../../../gateway/authorization/current-tool-authority.mjs';
import {createToolDispatch} from '../../../../gateway/dispatch/tool-dispatch.mjs';
import {createMailFixture,NOW,uuid} from '../../../../gateway/sources/mail/test/fixtures.mjs';
import {createMailMondayTaskPorts} from '../mail-monday-task-ports.mjs';

const origin='https://core.synthetic.invalid';
const operations=['mail.list_messages','mail.search_messages','mail.read_thread'].map(id=>({id,version:'0.2.0'}));
async function scene(){
 const fixtures=new Map(operations.map(op=>[op.id,createMailFixture(op.id,{client:true})]));
 const f=fixtures.get(operations[0].id),state={credentials:0,fetches:0,reserved:0,settled:0,contexts:0,revoked:false,
  changePage:null,credentialExpired:false,unavailable:false,revokeOnRetain:false};
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:f.subject.scopes,
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.authority.policyRevision}},
  approvedReads:{schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations,
   maxExecuteMs:2000,maxRequestBytes:65536,maxResponseBytes:1048576}};
 const retained=new Map(),owners=new WeakMap(),owner={
  async loadPrevious({key}){assert.equal(owners.get(this),retained);
   return JSON.stringify({record:retained.get(canonicalSha256(key))??null,checkedAtMs:f.state.now});},
  async retain({record}){assert.equal(owners.get(this),retained);retained.set(canonicalSha256(record.key),record);
   if(state.revokeOnRetain)state.revoked=true;
   return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),
    previousSha256:record.previousSha256,checkedAtMs:f.state.now});},
 };owners.set(owner,retained);
 const configuration={coreOrigin:origin,familyIds:['mail'],now:()=>f.state.now,
  mailContextPortsForTask:({binding,clientId,scopes,policyRevision,expiresAtMs})=>{
   state.contexts++;assert.deepEqual(binding,f.binding);assert.equal(clientId,f.clientId);
   assert.deepEqual(scopes,f.subject.scopes);assert.equal(policyRevision,f.authority.policyRevision);
   assert.equal(expiresAtMs,NOW+5000);return owner;
  },
  fetchImpl:async(url,options)=>{
   state.fetches++;assert.equal(new URL(url).origin,origin);
   assert.match(options.headers.authorization,/^CapiroMeriRead /);
   if(state.unavailable)return Response.json({code:'MAIL_RETAINED_SOURCE_UNAVAILABLE'},{status:503});
   const id=new URL(url).pathname.slice('/api/clio/tools/'.length),source=fixtures.get(id);
   const page=source.page(JSON.parse(options.body).input);
   // The real Core producer projects only each message's mailbox scope.
   for(const message of page.messages)message.scopes=source.subject.scopes.filter(scope=>scope.kind==='mailbox');
   state.changePage?.(page);return Response.json(page);
  }};
 const getSignedSourceCredentials=async pins=>{state.credentials++;
  const source=fixtures.get(pins.operation.id);return {...source.credentials(pins),invocationId:pins.invocationId,
   authorizationScheme:'CapiroMeriRead',target:pins.target,correlationSha256:pins.correlationSha256,
   expiresAtMs:state.credentialExpired?f.state.now:pins.deadlineMs};
 };
 const composed=createMailMondayTaskPorts(configuration)({task,getSignedSourceCredentials});
 const handlers=await createGeneralReadFamilyHandlers({families:composed.families,now:configuration.now,newId:()=>uuid('e')});
 const authority=createCurrentToolAuthority({ports:{
  async verifyCapability(){return JSON.stringify(f.claims);},
  async currentRun(){return JSON.stringify({binding:f.binding,policyRevision:f.authority.policyRevision,
   deadlineMs:NOW+5000,checkedAtMs:f.state.now});},
  async authorizeBusiness({operation}){
   if(state.revoked)throw Error('SYNTHETIC_REVOKED');
   const source=fixtures.get(operation.id);return JSON.stringify({decision:source.authority.decision,
    subject:source.subject,grants:source.contract.descriptor.requiredGrants});
  },
  async authorizeSources(){return JSON.stringify({sourceIds:['mail'],enabled:true,
   policyRevision:f.authority.policyRevision,checkedAtMs:f.state.now});},
 },now:configuration.now,maxFactBytes:1048576});
 const entries=new Map(operations.map(operation=>{
  const contract=fixtures.get(operation.id).contract;
  return [`${operation.id}@${operation.version}`,{contract,descriptor:contract.descriptor,
   execute:handlers.get(`${operation.id}@${operation.version}`).execute}];
 }));
 const dispatch=createToolDispatch({catalog:{entry:op=>entries.get(`${op.id}@${op.version}`)??null,discoverable:()=>[]},
  authority,budget:{async reserve({reservationId}){state.reserved++;return JSON.stringify({reservationId,decision:'reserved'});},
   async settle({reservationId}){state.settled++;return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){}},
  limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:2000,maxCleanupMs:30},
  now:configuration.now,newId:()=>uuid('e'),sourceEnabled:true,invocationId:'synthetic_mail_1',...composed.contextPorts});
 const run=(id,args=fixtures.get(id).args)=>dispatch.execute(JSON.stringify({operation:{id,version:'0.2.0'},arguments:args}),'SYNTHETIC_CAPABILITY');
 return {f,fixtures,state,task,configuration,composed,getSignedSourceCredentials,handlers,retained,run};
}

test('mail composition requires pre-admitted mailbox scopes and a genuine continuation callback',async()=>{
 const s=await scene();assert.equal(s.state.credentials,0);assert.equal(s.state.fetches,0);
 assert.deepEqual([...s.handlers.keys()].sort(),operations.map(op=>`${op.id}@${op.version}`).sort());
 for(const op of operations)assert.equal(s.composed.families.mail.endpoints[op.id],`${origin}/api/clio/tools/${op.id}`);
 assert.throws(()=>createMailMondayTaskPorts({...s.configuration,mailContextPortsForTask:undefined}),/CONFIGURATION/);
 const create=createMailMondayTaskPorts(s.configuration),before=s.state.contexts;
 const clientOnly={...s.task,scopes:s.task.scopes.filter(scope=>scope.kind==='client')};
 assert.throws(()=>create({task:clientOnly,getSignedSourceCredentials:s.getSignedSourceCredentials}),/UNAVAILABLE/);
 assert.throws(()=>create({task:{...s.task,original:{binding:s.task.binding,expiresAtMs:NOW}},
  getSignedSourceCredentials:s.getSignedSourceCredentials}),/UNAVAILABLE/);
 assert.equal(s.state.contexts,before);assert.equal(s.state.credentials,0);assert.equal(s.state.fetches,0);
});

for(const id of ['mail.list_messages','mail.search_messages'])test(`${id} reaches actual dispatcher and preserves mailbox/folder paging`,async()=>{
 const s=await scene(),f=s.fixtures.get(id),args={...f.args,folder:'inbox'};
 const first=JSON.parse(await s.run(id,args));
 assert.equal(first.hasMore,true);assert.equal(first.selection.folder,'inbox');assert.equal(first.evidenceReady,false);
 const second=JSON.parse(await s.run(id,{...args,offset:first.nextOffset,asOf:first.queryScope.asOfInclusive}));
 assert.equal(second.hasMore,false);assert.equal(second.nextOffset,null);
 assert.equal(second.messages[0].mailboxId,s.f.mailboxId);assert.equal(second.messages[0].scopes.length,1);
 assert.equal(second.messages[0].scopes[0].kind,'mailbox');assert.equal(s.retained.size,1);
 assert.equal(s.state.reserved,2);assert.equal(s.state.settled,2);
});

test('mail thread exact body window survives its canonical signed handler and actual dispatcher',async()=>{
 const s=await scene(),result=JSON.parse(await s.run('mail.read_thread'));
 assert.equal(result.kind,'mail-thread-source-page');assert.equal(result.messages[0].bodyCompleteness,'full');
 assert.equal(result.messages[0].mailboxId,s.f.mailboxId);assert.equal(result.evidenceReady,false);
 assert.equal(s.state.settled,1);
});

test('an empty mail owner page retains partial freshness and makes no absence claim',async()=>{
 const s=await scene();s.f.state.total=0;
 const result=JSON.parse(await s.run('mail.list_messages'));
 assert.deepEqual(result.messages,[]);assert.equal(result.hasMore,false);
 assert.equal(result.sources[0].freshness,'unknown');assert.equal(result.sources[0].status,'partial');
 assert.equal(result.coverage.enumeration,'unknown');assert.deepEqual(result.negativeAssertion,{kind:'none'});
 assert.equal(result.evidenceReady,false);assert.equal(s.retained.size,0);
});

for(const field of ['mailbox','folder','client'])test(`mail result cannot substitute ${field} scope`,async()=>{
 const s=await scene();s.state.changePage=page=>{
  if(field==='mailbox')page.messages[0].mailboxId=uuid('f');
  if(field==='folder')page.selection.folder='sent';
  if(field==='client')page.messages[0].clientId=uuid('f');
 };
 await assert.rejects(s.run('mail.list_messages',{...s.f.args,folder:'inbox'}));assert.equal(s.state.settled,0);
});

test('mail source unavailable, expired credentials and revocation never return empty success',async()=>{
 const unavailable=await scene();unavailable.state.unavailable=true;
 await assert.rejects(unavailable.run('mail.list_messages'));assert.equal(unavailable.state.settled,0);
 const expired=await scene();expired.state.credentialExpired=true;
 await assert.rejects(expired.run('mail.list_messages'));assert.equal(expired.state.fetches,0);
 const revoked=await scene();revoked.state.revokeOnRetain=true;
 await assert.rejects(revoked.run('mail.list_messages'));assert.equal(revoked.state.fetches,1);
});

test('model mailbox authority, foreign task scopes and inert owner substitutions refuse',async()=>{
 const s=await scene();await assert.rejects(s.run('mail.list_messages',{...s.f.args,mailboxId:uuid('f')}));
 assert.equal(s.state.credentials,0);assert.equal(s.state.fetches,0);
 const create=createMailMondayTaskPorts(s.configuration);
 const foreign={...s.task,scopes:s.task.scopes.map(scope=>scope.kind==='mailbox'?{...scope,tenantId:'foreign'}:scope)};
 assert.throws(()=>create({task:foreign,getSignedSourceCredentials:s.getSignedSourceCredentials}));
 for(const factory of [()=>({loadPrevious:async()=>{}}),async()=>({loadPrevious:async()=>{},retain:async()=>{}})]){
  const configured=createMailMondayTaskPorts({...s.configuration,mailContextPortsForTask:factory});
  assert.throws(()=>configured({task:s.task,getSignedSourceCredentials:s.getSignedSourceCredentials}),/CONFIGURATION/);
 }
});
