/** Concrete synthetic HTTP failure examples for the frontend handoff; no engine/network. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setup} from '../../../../../apps/control/action-followthrough/test/fixture.mjs';
import {createActionApplication} from '../../../../../apps/control/action-application/index.mjs';
import {createTaskCreateApprovalMetadataOwner,createPostgresApprovalMetadataStore} from '../../../../../apps/control/commands/approval-metadata/index.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../../../../apps/control/commands/approval-metadata/test/fixture.mjs';

async function capture(kind){
 const t=await setup(),sql=createMetadataPoolFixture();
 try{
  const policy=createMetadataPolicyFixture({binding:t.f.binding,scopes:t.f.scopes,requiredApprover:t.f.proposal.requiredApprover,expiresAt:t.f.proposal.expiresAt,now:t.clock});
  if(kind==='STORED_NOT_RELEASED')policy.state.denyPhase='before_release';
  const base=createPostgresApprovalMetadataStore({pool:sql.pool});
  const store=kind==='UNKNOWN'?{...base,async insert(...args){await base.insert(...args);throw new Error('synthetic lost insertion acknowledgement');}}:base;
  const owner=createTaskCreateApprovalMetadataOwner({store,commandContext:t.f.context,preparePolicy:policy.preparePolicy,now:t.clock});
  const commandOptions={...t.commandOptions,approvalMetadataOwner:owner};
  const lookupContext={lookupId:randomUUID(),resultReference:randomUUID(),requestId:randomUUID(),binding:t.f.binding,scopes:t.scopes,selectedClientId:t.clientId,
   deliveryJson:JSON.stringify({context:{binding:t.f.binding},producer:{namespace:'fixture',executionId:'wire'},deliveryId:'wire'}),
   slots:{started:{eventId:randomUUID(),sequence:100},terminal:{eventId:randomUUID(),sequence:101}},deadlineMs:t.readContext.deadlineMs};
  const app=createActionApplication({now:t.clock,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},resolveSession:async()=>({
   lookup:t.lookup,lookupContext,lookupCredential:t.issued.credential,readContext:t.readContext,commandOptions,
   authorizeExecution:async()=>{throw new Error('execution not admitted by this example');},expiresAtMs:t.readContext.deadlineMs,checkedAtMs:t.clock()})});
  const draft=await t.make().draft(t.wanted,{title:'Inspect a synthetic uncertain proposal',dueDate:null});
  const response=await app.handle(new Request('http://local.invalid/api/action-followthrough/prepare',{method:'POST',headers:{authorization:'Bearer synthetic-wire-example','content-type':'application/json'},body:JSON.stringify({draft})}));
  const body=await response.json();
  assert.equal(body.error.outcome,kind);assert.equal(sql.rows.size,1);assert.equal(t.f.state.fetches,0);
  return {scenario:kind,httpStatus:response.status,headers:{contentType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control')},body,
   observedSyntheticBoundary:{metadataRows:sql.rows.size,taskEffects:t.f.state.fetches},automaticRetryAllowed:false};
 }finally{t.identity.close();}
}
console.log(JSON.stringify({scope:'SYNTHETIC_WIRE_EXAMPLES_NOT_NATIVE_DATABASE_EVIDENCE',examples:[await capture('UNKNOWN'),await capture('STORED_NOT_RELEASED')]}));
