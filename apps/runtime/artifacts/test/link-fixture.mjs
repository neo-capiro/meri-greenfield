/** Scripted canonical document and session owners for the download-link tests: synthetic replies only, no storage or network. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDownloadLinkApplication,createSuppressionGeneration} from '../index.mjs';
import {createServingGate} from '../../../control/retention/reconciliation.mjs';
export const T=1_800_000_000_000,key=Buffer.alloc(32,5),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const tenantId='tenant-a',conversationId='00000000-0000-4000-8000-0000000000c1',artifactId='00000000-0000-4000-8000-0000000000a1',versionId='00000000-0000-4000-8000-0000000000b1';
const binding=actorId=>({tenantId,actorId,conversationId,runId:'00000000-0000-4000-8000-0000000000d1',attemptId:'00000000-0000-4000-8000-0000000000e1',workerId:'00000000-0000-4000-8000-0000000000f1',writerFence:1});
export function journalOf(rows=new Map()){return {rows,get:async key=>{rows.onGet?.(key);return rows.get(key)??null;}};}
export function harness({bytes=Buffer.from('synthetic workbook bytes'),servedBytes=bytes,inspectSha=sha(bytes),sessionExpiresAtMs=T+600000,ttlMs=60000}={}){
 const clock={t:T},calls=[],journal=journalOf(),serving=createServingGate(),served={bytes:servedBytes},authority={revoked:false,policyRevision:'a'.repeat(64),expiresAtMs:sessionExpiresAtMs};
 const documents={async handle(request){const path=new URL(request.url).pathname,body=await request.text();calls.push({path,authorization:request.headers.get('authorization'),length:request.headers.get('content-length'),body});
  if(Number(request.headers.get('content-length'))!==Buffer.byteLength(body))return Response.json({error:{code:'INVALID_CONTENT_LENGTH'}},{status:400});
  if(path==='/api/documents/inspect')return calls.inspectRefused?Response.json({error:{code:'ACCESS_DENIED'}},{status:403}):Response.json({version:{versionId:JSON.parse(body).versionId,artifactId,binding:{tenantId,conversationId},object:{sha256:inspectSha,bytes:bytes.length}},inspection:{}});
  if(path==='/api/documents/download'){if(calls.downloadRefused)return Response.json({error:{code:'ACCESS_DENIED',outcome:'READ_UNAVAILABLE'}},{status:403,headers:{'cache-control':'no-store'}});calls.onDownload?.();return new Response(new ReadableStream({pull(controller){calls.onBodyRead?.();controller.enqueue(new Uint8Array(served.bytes));controller.close();}}),{status:200,headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="w.xlsx"','cache-control':'no-store'}});}
  return Response.json({error:{code:'NOT_FOUND'}},{status:404});}};
 const actors={'action_session_a':'actor-a','action_session_b':'actor-b'};
 const sessions={async authenticateSession({credential}){if(!actors[credential]||authority.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});return {credential};},
  async readCurrentState({authentication}){if(authority.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});return {binding:binding(actors[authentication.credential]),scopes:[{kind:'client',tenantId,resourceId:'client-1',policyRevision:authority.policyRevision}],selectedClientId:'client-1',expiresAtMs:authority.expiresAtMs};}};
 const app=createDownloadLinkApplication({documents,sessions,key,generation:createSuppressionGeneration({journal,serving}),now:()=>clock.t,ttlMs,maxRequestMs:5000});
 const post=(route,body,credential='action_session_a')=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const issue=async()=>{const r=await post('links/issue',{versionId});assert.equal(r.status,200,await r.clone().text());return r.json();};
 return {clock,calls,journal,serving,served,authority,app,post,issue,bytes,documents,sessions};
}
