/** Actual MCP/control/read adapter with synthetic Core responses; no provider, SQL or AWS. */
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../../../../runtime/reads-composer.mjs';
import {createNativeReadsClient} from '../../../../runtime/reads-client.mjs';
import {createExecutionBinding} from '../../../../control/conversations/execution-boundary.mjs';
import {versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createMailFixture,uuid,NOW} from '../../../../gateway/sources/mail/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
export {NOW};
export const MAIL_OPERATIONS=['mail.list_messages','mail.search_messages','mail.read_thread'].map(id=>({id,version:'0.2.0'}));
export const SESSION='71000000-0000-4000-8000-000000000091';
export async function generalReadFixture({client=false,id='mail.search_messages',operations=MAIL_OPERATIONS}={}){
 const scenes=new Map(MAIL_OPERATIONS.map(op=>[op.id,createMailFixture(op.id,{client})])),source=scenes.get(id),binding=source.binding,calls=[],records=new Map();
 let enabled=true,parkFetch;
 let rows=[{id:source.mailboxId,tenantId:binding.tenantId,createdByUserId:binding.actorId,provider:'microsoft_365',status:'disabled'},
  {id:uuid('7'),tenantId:binding.tenantId,createdByUserId:binding.actorId,provider:'zoom',status:'connected'}],revoked=false,afterPage,status=200;
 const scopes=[{tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?source.clientId:binding.actorId,policyRevision:source.subject.policyRevision}];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:client?source.clientId:null,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations,maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['mail'],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:enabled,readFamilies:['mail'],activeReadOperations:operations};}},
  memoryContexts:{forTask(){throw Error('Memory is not selected');},forMail(task){assert.equal(task.clientId,current.selectedClientId);return {
   async retain({record}){records.set(hash(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:hash(record.key),previousSha256:record.previousSha256,checkedAtMs:source.state.now});},
   async loadPrevious({key}){return JSON.stringify({record:records.get(hash(key)),checkedAtMs:source.state.now});},
  };}},
  async fetchImpl(url,options){
   const path=new URL(url).pathname;calls.push(path);assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   if(path==='/api/engagement/integrations'){assert.equal(options.method,'GET');assert.equal(options.headers['x-internal-service-secret'],undefined);return Response.json(rows,{status});}
   const selected=scenes.get(path.slice('/api/clio/tools/'.length));assert.ok(selected,path);assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   const correlation=JSON.parse(Buffer.from(options.headers['x-meri-read-correlation'],'base64url').toString());
   assert.deepEqual(correlation.subject.scopes,[...scopes,{tenantId:binding.tenantId,kind:'mailbox',resourceId:source.mailboxId,policyRevision:current.policyRevision}]);
   assert.equal(Object.hasOwn(correlation.subject,'authorizationDecisionId'),false);
   if(parkFetch)await parkFetch(options.signal);
   selected.state.now=source.state.now;const page=selected.page(JSON.parse(options.body).input,correlation);afterPage?.();return Response.json(page);
  }});
 assert.deepEqual(composer.missing,[]);
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}};
 const mount=()=>{const app=composer.createReadsRuntime({execution,binding,approvedReads});return createNativeReadsClient({origin:'https://control.example.invalid',credential:'SYNTHETIC_EXECUTION',binding,approvedReads,now:()=>source.state.now,fetchImpl:(url,init)=>app.handle(new Request(url,init))});};
 async function execute(args=source.args){
  // A new HTTP owner per request proves continuation does not depend on its cache.
  const app=composer.createReadsRuntime({execution,binding,approvedReads});
  const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const availability=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));if(availability.status!==200)return availability;
  const a=await availability.json();return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation:source.operation,arguments:args,deliveryId:'synthetic',installationId:a.installation.installationId,executionCatalogSha256:a.installation.executionCatalogSha256}));
 }
 return {source,calls,records,execute,binding,scopes,operation:source.operation,search:scenes.get('mail.search_messages').args,policy:current.policyRevision,now:()=>source.state.now,deadlineMs:identity.expiresAtMs,mount,enabled:value=>{enabled=value;},park:fn=>{parkFetch=fn;},rows:fn=>{rows=fn(rows);},revoke:()=>{revoked=true;},after:fn=>{afterPage=fn;},status:n=>{status=n;}};
}

export async function mountReads(f,{policy={generalReads:true},port=f.mount(),deadlineMs=f.deadlineMs,...rest}={}){
 const runtime=await createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy:assertCapabilityPolicy(policy),port,now:f.now,deadlineMs,...rest});
 if(runtime===null)return null;
 const client=new Client({name:'synthetic-sdk',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
 await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
 const hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0];let n=0;
 /** Delivers PreToolUse then, if not denied, the MCP call with the hook's updated input. */
 async function call(name,args,{toolUseId=`toolu_synthetic_${n++}`,sessionId=SESSION,signal}={}){
  const decision=await hook({hook_event_name:'PreToolUse',session_id:sessionId,tool_name:`mcp__meri_reads__${name}`,tool_use_id:toolUseId,tool_input:{arguments:args}},undefined,{signal:new AbortController().signal});
  if(decision.hookSpecificOutput.permissionDecision==='deny')return {denied:decision.hookSpecificOutput.permissionDecisionReason};
  return client.callTool({name,arguments:decision.hookSpecificOutput.updatedInput},undefined,signal?{signal}:undefined);
 }
 return {runtime,client,hook,call,async close(){await client.close();await runtime.close();}};
}
