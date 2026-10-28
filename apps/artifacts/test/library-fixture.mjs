/** Real durable metadata/service owners over the existing scripted SQL/CAS fixture. No external effects. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactService} from '../service.mjs';import {record,commit,sqlFixture,NOW,id} from '../storage/test/sql-fixture.mjs';
export {id,NOW};
export function libraryRecord(n,{conversationId=id(1),actorId='synthetic-actor',clientId=id(500),artifactId=id(n+1000),parentVersionId=null}={}){
 const r=record(n,parentVersionId);Object.assign(r.version.binding,{conversationId,actorId});r.version.artifactId=artifactId;r.version.createdAt=new Date(NOW-n*1000).toISOString();
 r.version.scopes=[{tenantId:r.version.binding.tenantId,kind:clientId===null?'private-user':'client',resourceId:clientId??actorId,policyRevision:'synthetic-policy'}];r.version.object.scopes=structuredClone(r.version.scopes);return r;
}
export async function libraryFixture(){const sql=sqlFixture(),a=libraryRecord(10),b=libraryRecord(20,{conversationId:id(2)}),c=libraryRecord(30,{conversationId:id(3),clientId:id(501)}),d=libraryRecord(40,{actorId:'colleague',conversationId:id(4)});for(const r of[a,b,c,d])await sql.create().commit(commit(r));
 const state={clock:NOW,calls:[],denied:new Set(),releaseDenied:new Set(),unavailable:false,originHook:null},context={binding:structuredClone(a.version.binding),scopes:structuredClone(a.version.scopes),evidence:[],assets:[],deadlineMs:NOW+60000,maxBytes:1048576};
 const options={validators:v,versions:sql.create(),now:()=>state.clock,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),objects:{async get(){assert.fail('library read bytes');},async put(){assert.fail('library wrote bytes');}},executor:{async execute(){assert.fail('library generated');}},retention:sql.retention,
  async authorize(x){return {receiptId:'current',decision:'allow',action:x.action,binding:structuredClone(x.binding),scopesSha256:v.hash(x.scopes),resourceSha256:v.hash(x.resource),requestSha256:x.requestSha256,expiresAtMs:Math.min(x.deadlineMs,NOW+50000)};},
  async authorizeOrigin({phase,version}){state.calls.push({phase,versionId:version.versionId,conversationId:version.binding.conversationId});await state.originHook?.({phase,version});if(state.unavailable)throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});if(state.denied.has(version.binding.conversationId)||phase==='release'&&state.releaseDenied.has(version.binding.conversationId))throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
   return {versionSha256:v.hash(version),principal:{tenantId:version.binding.tenantId,actorId:version.binding.actorId},conversationId:version.binding.conversationId,selectedClientId:version.scopes[0].kind==='client'?version.scopes[0].resourceId:null,identityRevision:'identity1',contextRevision:'context1',scopesSha256:v.hash(version.scopes),checkedAtMs:state.clock,expiresAtMs:NOW+40000};}};
 return {sql,a,b,c,d,state,context,options,owner:change=>createArtifactService({...options,...change}),query:{scope:'owner',limit:2,cursor:null}};
}
