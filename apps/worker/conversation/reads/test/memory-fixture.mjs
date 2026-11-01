/** Production worker MCP server -> control reads composer -> gateway signed memory adapter, over scripted Core pages
 * and eligibility receipts. No Core, database, provider or model call. */
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../../../../runtime/reads-composer.mjs';
import {createNativeReadsClient} from '../../../../runtime/reads-client.mjs';
import {createExecutionBinding} from '../../../../control/conversations/execution-boundary.mjs';
import {versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createClientKnowledgeFixture} from '../../../../gateway/sources/client-knowledge/test/fixtures.mjs';
export const MEMORY_OPERATION=Object.freeze({id:'search_memory',version:'0.2.0'});
/** @param {{client?:boolean}} [options] a selected-client conversation, or General */
export async function memoryReadFixture({client=false}={}){
 const scene=createClientKnowledgeFixture('search_memory',{client}),binding=scene.binding,calls=[];
 let enabled=true,eligible=true,page=null;
 const scopes=[{tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?scene.clientId:binding.actorId,policyRevision:scene.subject.policyRevision}];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:scene.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:client?scene.clientId:null,policyRevision:scene.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[MEMORY_OPERATION],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['client-knowledge-memory'],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>scene.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:enabled,readFamilies:['client-knowledge-memory'],activeReadOperations:[MEMORY_OPERATION]};}},
  async fetchImpl(url,options){
   const path=new URL(url).pathname;calls.push(path);const body=JSON.parse(options.body);
   assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   const correlation=JSON.parse(Buffer.from(options.headers['x-meri-read-correlation'],'base64url').toString());
   assert.deepEqual(correlation.normalizationContext,{tenantId:binding.tenantId,userId:binding.actorId});
   if(path==='/api/clio/tools/search_memory')return Response.json(page??scene.page(body.input));
   if(path==='/api/clio/tools/search_memory_eligibility'){
    // Core's passive eligibility helper: the exact pins back, one verdict per returned record.
    const {input,deadlineMs,...pins}=body;
    return Response.json({...pins,checkedAtMs:scene.state.now,expiresAtMs:Math.min(deadlineMs,scene.state.now+4000),records:body.records.map(record=>({...record,eligibleForRecall:eligible}))});
   }
   assert.fail(`unexpected Core path ${path}`);
  }});
 assert.deepEqual(composer.missing,[]);
 const execution={async authenticate(){return structuredClone(current);}};
 const mount=()=>{const app=composer.createReadsRuntime({execution,binding,approvedReads});return createNativeReadsClient({origin:'https://control.example.invalid',credential:'SYNTHETIC_EXECUTION',binding,approvedReads,now:()=>scene.state.now,fetchImpl:(url,init)=>app.handle(new Request(url,init))});};
 return {scene,binding,scopes,calls,clientId:scene.clientId,now:()=>scene.state.now,deadlineMs:identity.expiresAtMs,mount,
  enabled:(/** @type {boolean} */value)=>{enabled=value;},eligible:(/** @type {boolean} */value)=>{eligible=value;},page:(/** @type {any} */value)=>{page=value;}};
}
