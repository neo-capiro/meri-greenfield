/** Real control/read/compiler/proposal owners; scripted SQL and Core HTTP only. */
import {randomUUID} from 'node:crypto';
import {assembleControl} from '../../control.mjs';
import {agentcoreControlFixture} from '../../test/agentcore-fixture.mjs';
import {createReadsOwner} from '../../reads-owner.mjs';
import {createReadsApplication} from '../../reads-http.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {storeFixture} from '../../../control/conversations/test/store-fixture.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {runtimeFixture} from '../../../worker/conversation/skills/test/runtime-fixture.mjs';
import {reportRuntimeFixture} from './report-production-fixture.mjs';
import {registerDocumentIntentOwner} from '../../artifacts/intent-binding.mjs';
import {createTaskSelectedSkills} from '../task.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};

export async function compositionFixture(skillId='quick_skill.commitments_audit',options={}){
 const f=options.report===undefined?runtimeFixture(skillId):reportRuntimeFixture(options.report),c=f.configuration,base=storeFixture(),intents=createPreparedSchedulePoolFixture(),metadata=createMetadataPoolFixture();
 // Existing SQL protocol fixtures are joined at their actual schema boundaries.
 // This does not claim PostgreSQL transaction or contention qualification.
 const pool={options:{connectionTimeoutMillis:25000,query_timeout:25000},async connect(){
  const b=await base.pool.connect(),i=await intents.pool.connect(),m=await metadata.pool.connect();let snapshot;
  return {async query(sql,params){const text=typeof sql==='string'?sql:sql.text;
   if(text.startsWith('BEGIN')){snapshot=structuredClone(metadata.rows);await b.query('BEGIN');await i.query(text);return {rows:[]};}
   if(text==='ROLLBACK'){metadata.rows.clear();for(const [k,v]of snapshot)metadata.rows.set(k,v);await b.query(text);return i.query(text);}
   if(text==='COMMIT'||text.startsWith('SET LOCAL')){await b.query(text);return i.query(text);}
   if(text.includes('meri_commands.approval_metadata'))return m.query(sql);
   if(text.includes('meri_intents.preparations'))return i.query(text,params);
   if(text.startsWith('SELECT e.* FROM meri_conversations.events e JOIN')){const sequence=r=>(base.state.runs.get([r.event.binding.tenantId,r.event.binding.conversationId,r.event.binding.runId].join(':'))?.sequence_base??0)+r.sequence;const rows=[...base.state.events.values()].flat().filter(r=>r.event.binding.tenantId===params[0]&&r.event.binding.conversationId===params[1]&&sequence(r)>params[2]).sort((a,b)=>sequence(a)-sequence(b)).slice(0,params[3]);return {rows:rows.map(r=>({...structuredClone(r),tenant_id:r.event.binding.tenantId,conversation_id:r.event.binding.conversationId,run_id:r.event.binding.runId}))};}
   return b.query(sql,params);
  },release(error){try{m.release(error);}finally{try{i.release(error);}finally{b.release(error);}}}};
 }};
 const configuration=agentcoreControlFixture().configuration;
 configuration.sourceEnabled=true;configuration.versions=c.versions;configuration.limits.requestMs=3000;
 configuration.reads={defaultCongress:119};configuration.agentcore.maxOutputBytes=f.context.maxBytes;
 const operations=f.install.operations,approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations,maxExecuteMs:3000,maxRequestBytes:131072,maxResponseBytes:2097152};
 configuration.agentcore.approvedReads=approvedReads;
 const {versions:unused,...identity}=createExecutionBinding({binding:c.binding,versions:c.versions,plan:{synthetic:'selected-composition'},expiresAtMs:c.now()+60000,runtimeSessionId:'synthetic-'+hash(c.binding)});
 const state={revoked:false,readCalls:0,blockedRead:null,readStarted:null,abortedReads:0,authCalls:0,availabilityError:false,scopesOverride:null,installationCatalogSha256:hash(catalog)};
 const execution={async authenticate({binding,credential,signal}){
  state.authCalls++;signal?.throwIfAborted();if(state.revoked||credential!=='synthetic-execution'||hash(binding)!==hash(c.binding))throw Error('EXECUTION_AUTHORITY_REFUSED');
  return {execution:identity,state:'running',scopes:state.scopesOverride??c.scopes,selectedClientId:f.selection.subject.entityIds[0],policyRevision:c.scopes[0].policyRevision};
 }};
 const snapshot=()=>({installation:{installationId:f.install.installationId,baseCatalogSha256:state.installationCatalogSha256,executionCatalogSha256:f.install.executionCatalogSha256,operations,checkedAtMs:c.now(),expiresAtMs:identity.expiresAtMs},discovery:{binding:c.binding,policyRevision:c.scopes[0].policyRevision,operations,checkedAtMs:c.now(),expiresAtMs:identity.expiresAtMs}});
 const createReadsRuntime=({binding,execution,approvedReads})=>createReadsApplication({approvedReads,now:c.now,owner:createReadsOwner({binding,execution,approvedReads,now:c.now,createGateway:()=>({
  async readAvailability(){if(state.availabilityError)throw Error('SOURCE_UNAVAILABLE');return snapshot();},async execute(input){state.readCalls++;
   if(state.blockedRead){state.readStarted?.resolve();return new Promise((resolve,reject)=>{const abort=()=>{state.abortedReads++;reject(input.signal.reason);};input.signal.addEventListener('abort',abort,{once:true});state.blockedRead.promise.then(value=>{input.signal.removeEventListener('abort',abort);resolve(value);},reject);});}
   return c.gateway.execute(input);
  },
 })})});
 const client={workflow:{async start(){throw Error('No workflow in selected private request');},getHandle(){throw Error('No workflow handle');}}};
 const assembly=assembleControl({configuration,pool,client,native:{async call(){throw Error('No legacy native call');}},execution,now:c.now,createReadsRuntime,
  ...(options.revisionOwner===undefined?{}:{productPortsFactory:context=>{registerDocumentIntentOwner(context,()=>[],undefined,undefined,options.revisionOwner);return {};}})});
 const binding=c.binding,scopes=c.scopes,createdAt=new Date(c.now()).toISOString();
 const run={binding,state:'queued',scopes,createdAt,policyRevision:scopes[0].policyRevision,versions:c.versions},conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision:run.policyRevision};
 await assembly.store.accept({conversation,run,request:c.request,event:{contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
 for(const state of ['starting','running'])await assembly.store.append(binding,{eventId:randomUUID(),createdAt,type:'run.status',data:{state,reasonCode:null}},()=>{});
 async function rpc(operation,input,{signal,credential='synthetic-execution'}={}){
  const response=await assembly.application.handle(new Request('https://control.invalid/internal/conversations/'+operation,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(input),...(signal?{signal}:{})}));
  const value=await response.json();if(response.status!==200)throw Object.assign(Error(value.error?.code??'HTTP_REFUSED'),{status:response.status});return value;
 }
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{call:rpc}});
 const prepare=()=>task.prepare(Object.fromEntries(['binding','versions','request','scopes'].map(k=>[k,c[k]])));
 return {f,base,intents,metadata,assembly,task,state,pool,configuration,execution,createReadsRuntime,rpc,prepare,async close(){await task.close();await assembly.close();}};
}
