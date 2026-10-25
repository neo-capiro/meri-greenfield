/** Mounted native action composition with actual typed source handlers, SQL adapters, metadata and approval owners. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {standaloneFixture,id} from './standalone-tasks-fixture.mjs';
import {createTaskLookupPoolFixture} from '../../../control/task-lookup/postgres-fixture.mjs';
import {createStandaloneActionApplication} from '../standalone-tasks.mjs';
import {nativeScopedPage} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
export {id};
export function actionFixture({maxResponseBytes=262144,retention}={}){
 const f=standaloneFixture({maxResponseBytes,retention}),lookup=createTaskLookupPoolFixture();
 Object.assign(f.binding,{tenantId:id(80),actorId:id(81)});f.scopes[0].tenantId=f.binding.tenantId;
 const original=f.context.pool,pool={options:original.options,async connect(){const base=await original.connect(),actions=await lookup.pool.connect();return {async query(q,args){
  const text=typeof q==='string'?q:q.text;
  if(text==='BEGIN'||text.startsWith('BEGIN ISOLATION')){await actions.query('BEGIN');return base.query(q,args);}
  if(text==='COMMIT'||text==='ROLLBACK'){await actions.query(text);return base.query(q,args);}
  if(text.includes('meri_task_lookup')||text.startsWith('SELECT pg_advisory_xact_lock'))return actions.query(q,args);
  return base.query(q,args);
 },release(){base.release();actions.release();}};}};
 const state=Object.assign(f.state,{sourceCalls:0,wire:[],nativeCredential:'synthetic-native',afterSource:null});
 f.sessions.nativeCredentialFor=()=>{if(state.revoked||!state.nativeCredential)throw Error('revoked');return {credential:state.nativeCredential,expiresAtMs:state.now+60000};};
 const selectedClientId=id(5),native=nativeScopedPage();native.clientId=selectedClientId;
 const row=native.actions[0];row.clientId=selectedClientId;row.sourceProof.currentClientId=selectedClientId;
 const core=Object.fromEntries(Object.entries(row).filter(([key])=>!['recordKind','recommendation','acceptedAsTask','nativeCompletion','sourceProof'].includes(key)));
 row.sourceProof.contentSha256=createHash('sha256').update(JSON.stringify(core)).digest('hex');
 const actionReadTransport={async readSecret(){return Buffer.from('synthetic-core-service');},async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.wire.push({path,body,authorization:init.headers.authorization});
  assert.equal(init.headers.authorization,'Bearer '+state.nativeCredential);
  const identity={principal:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},identityRevision:'a'.repeat(64),checkedAtMs:state.now,expiresAtMs:state.now+30000};
  if(path.endsWith('/identity'))return Response.json(identity);
  if(path.endsWith('/current'))return Response.json({...identity,role:'standard_user',permissions:[],clientIds:[selectedClientId],membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:f.binding.conversationId,selectedClientId});
  if(path.endsWith('/check-ref'))return Response.json({ok:true,clientId:selectedClientId},{status:201});
  assert.equal(path,'/api/clio/tools/actions.query');assert.equal(init.headers['x-internal-service-secret'],'synthetic-core-service');state.sourceCalls++;
  const selection=body.input.selection,page=structuredClone(native);Object.assign(page.scope,{actionItemId:selection.actionItemId,status:selection.status,sort:selection.sort,limit:selection.limit,cursorApplied:selection.cursorApplied});
  await state.afterSource?.(page);return Response.json(page);
 }};
 const context={...f.context,pool,configuration:{...f.context.configuration,reads:{enabled:true,serviceSecretFile:'/synthetic'},intents:{enabled:true,core:{origin:'https://core.invalid',serviceSecretFile:'/synthetic'}},native:{maxResponseBytes}}};
 const app=createStandaloneActionApplication({...f,context,actionReadTransport});
 const request=(route,body)=>new Request('https://meri.invalid/api/action-followthrough/'+route,{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify(body)});
 return {...f,state,context,lookup,native,actionReadTransport,app,request,call:(route,body)=>app.handle(request(route,body))};
}
