/** Synthetic Core for run-bound read delegation: the behaviour Meri relies on (FABLE-RUN-BOUND-READ-DELEGATION-20261018.md
 * §3-§9), modelled in memory over the scripted Meri owner state (reservations, run state). No live credential, key or route. */
import {createHash,randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {READ_TOKEN_CEILINGS,READ_TOKEN_REISSUES,READ_DELEGATION_LIMITS,READ_TOKEN_SCHEME} from '../contract.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const DELEGATION=/^\/api\/clio\/application-authority\/read-delegations\/([a-f0-9-]{36})\/(tokens|current|revocations)$/u;

export function delegationCoreFixture({now,binding,clientId,runDeadlineMs,principal,reservations,liveBearers,serviceSecret='SYNTHETIC_SERVICE',authority,tools}){
 const state={delegations:new Map(),tokens:new Map(),slots:new Map(),calls:[],runState:'running',dropTokenResponses:0,failRevokes:0,createStatus:null,
  createExpiry:null,checkRefClientId:clientId,mode:'off',consent:null,unavailable:false,withholdAtRelease:false,role:'standard_user'};
 const active=d=>d&&d.state==='active'&&now()<Math.min(d.expiresAtMs,runDeadlineMs)&&['queued','starting','running'].includes(state.runState);
 function consume(header,{kind,path,bodySha256}){
  const t=state.tokens.get(header.slice(READ_TOKEN_SCHEME.length+1)),d=t&&state.delegations.get(t.delegationId);
  if(!t||t.consumed||t.superseded||now()>=t.expiresAtMs||t.kind!==kind||t.path!==path||t.bodySha256!==bodySha256)return [null,json({error:'token'},401)];
  if(!active(d))return [null,json({error:'changed'},409)];
  t.consumed=true;return [{t,d},null];
 }
 function receipt(d,conversation){
  const identityRevision=sha(JSON.stringify({user:principal.actorId,delegation:d.id,revision:d.revision}));
  return {schemaVersion:1,delegationId:d.id,principal,identityRevision,actorRole:state.role,membershipRevision:'b'.repeat(64),clientIds:[d.clientId],
   ...(conversation?{conversation:{conversationId:d.binding.conversationId,selectedClientId:d.clientId,contextRevision:'d'.repeat(64)}}:{}),
   checkedAtMs:now(),expiresAtMs:Math.min(now()+30000,d.expiresAtMs,runDeadlineMs)};
 }
 async function fetchImpl(url,init){
  const path=new URL(url).pathname,headers=init.headers??{},bytes=init.body===undefined?Buffer.alloc(0):Buffer.from(init.body),authorization=headers.authorization;
  const scheme=typeof authorization==='string'?authorization.split(' ')[0]:null;state.calls.push({path,scheme,headers:{...headers}});
  if(state.unavailable&&(path.includes('/read-delegation')||scheme===READ_TOKEN_SCHEME))return json({error:'unavailable'},404);
  const delegated=scheme===READ_TOKEN_SCHEME;
  // A read token is never admitted on identity, context or membership.
  if(delegated&&/\/application-authority\/(identity|context|membership)$/u.test(path))return json({error:'token'},401);
  const service=headers['x-internal-service-secret']===serviceSecret;
  if(path==='/api/clio/application-authority/read-delegations'){
   if(!service)return json({error:'service'},401);if(state.createStatus)return json({error:'refused'},state.createStatus);
   const body=JSON.parse(bytes);
   if(body.mode==='attended'&&(scheme!=='Bearer'||!liveBearers.has(authorization.slice(7))))return json({error:'session'},401);
   if(body.mode==='unattended'&&(authorization!==undefined||!state.consent||state.consent.state!=='active'||state.consent.id!==body.consentId))return json({error:'consent'},403);
   const expected={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,attemptId:binding.attemptId,writerFence:binding.writerFence};
   if(hash(body.binding)!==hash(expected)||body.clientId!==clientId)return json({error:'binding'},403);
   const {supersedes,...identity}=body,key=hash(identity);
   const same=[...state.delegations.values()].find(d=>d.key===key&&d.state==='active'&&!supersedes);if(same)return json({schemaVersion:1,delegationId:same.id,expiresAtMs:same.expiresAtMs,checkedAtMs:now()});
   if(supersedes){const old=state.delegations.get(supersedes);if(old)old.state='superseded';}
   const bound=body.mode==='attended'?Math.min(now()+READ_DELEGATION_LIMITS.attendedMaxMs,runDeadlineMs):Math.min(now()+READ_DELEGATION_LIMITS.occurrenceMaxMs,runDeadlineMs,state.consent.expiresAtMs);
   const d={id:randomUUID(),key,mode:body.mode,binding:body.binding,clientId:body.clientId,revision:1,state:'active',issuedAtMs:now(),expiresAtMs:state.createExpiry?state.createExpiry(bound):bound,request:body};
   state.delegations.set(d.id,d);return json({schemaVersion:1,delegationId:d.id,expiresAtMs:d.expiresAtMs,checkedAtMs:now()},201);
  }
  const route=DELEGATION.exec(path);
  if(route&&route[2]==='tokens'){
   if(!service)return json({error:'service'},401);const d=state.delegations.get(route[1]);if(!active(d))return json({error:'changed'},409);
   const body=JSON.parse(bytes),{retryOf,...request}=body,requestSha256=hash(request),slotKey=`${binding.runId}|${body.callKey}`;
   let slot=state.slots.get(slotKey);
   if(!slot){slot={counts:{current:0,tool:0,mode:0,reference:0},reissues:{current:0,tool:0,mode:0,reference:0}};state.slots.set(slotKey,slot);}
   if(body.kind==='tool'){const r=reservations.get(body.callKey);
    if(state.rejectTool||!r||r.state!=='UNKNOWN'||r.run_id!==binding.runId||hash(r.operation)!==hash(body.operation)||r.arguments_sha256!==body.argumentsSha256)return json({error:'reservation'},403);}
   const prior=retryOf?[...state.tokens.values()].find(t=>t.requestSha256===retryOf&&!t.consumed&&!t.superseded):null;
   if(retryOf){if(!prior||slot.reissues[body.kind]>=READ_TOKEN_REISSUES)return json({error:'retry'},429);prior.superseded=true;slot.reissues[body.kind]++;}
   else{if(slot.counts[body.kind]>=READ_TOKEN_CEILINGS[body.kind])return json({error:'ceiling'},429);slot.counts[body.kind]++;}
   const token=`synthetic-read-token-${randomUUID()}`,expiresAtMs=Math.min(now()+READ_DELEGATION_LIMITS.tokenMaxMs,d.expiresAtMs);
   state.tokens.set(token,{token,delegationId:d.id,kind:body.kind,callKey:body.callKey,path:body.path,bodySha256:body.bodySha256,requestSha256,expiresAtMs,consumed:false,superseded:false});
   if(state.dropTokenResponses>0){state.dropTokenResponses--;return json({error:'lost'},503);}
   return json({schemaVersion:1,token,expiresAtMs});
  }
  if(route&&route[2]==='current'){
   if(!service||!delegated)return json({error:'credential'},401);
   const [use,refused]=consume(authorization,{kind:'current',path,bodySha256:sha(bytes)});if(refused)return refused;
   if(use.d.id!==route[1])return json({error:'target'},403);
   return json(receipt(use.d,JSON.parse(bytes).conversation===true));
  }
  if(route&&route[2]==='revocations'){
   if(!service)return json({error:'service'},401);if(state.failRevokes>0){state.failRevokes--;return json({error:'down'},500);}
   const d=state.delegations.get(route[1]);if(d)d.state='revoked';return json({schemaVersion:1,state:'revoked'});
  }
  if(delegated&&path==='/api/clio/clients/check-ref'){
   if(!service)return json({error:'service'},401);const [,refused]=consume(authorization,{kind:'reference',path,bodySha256:sha(bytes)});if(refused)return refused;
   return json({ok:true,clientId:state.checkRefClientId},201);
  }
  if(delegated&&path==='/api/clio/application-authority/read-mode-observation'){
   if(!service)return json({error:'service'},401);const [,refused]=consume(authorization,{kind:'mode',path,bodySha256:sha(bytes)});if(refused)return refused;
   const body=JSON.parse(bytes);return json({operation:body.operation,requestSha256:body.requestSha256,principal,surface:'chat',evidenceAccuracyMode:state.mode});
  }
  if(delegated&&path.startsWith('/api/clio/tools/')){
   if(!service)return json({error:'service'},401);const [use,refused]=consume(authorization,{kind:'tool',path,bodySha256:sha(bytes)});if(refused)return refused;
   const r=reservations.get(use.t.callKey);if(!r||r.state!=='UNKNOWN')return json({error:'reservation'},403);
   const response=await tools(url,init);
   // Before release: the delegation, its expiry and the run are re-read; any change withholds the result.
   if(state.withholdAtRelease||!active(state.delegations.get(use.d.id)))return json({error:'changed'},409);
   return response;
  }
  return path.startsWith('/api/clio/tools/')?tools(url,init):authority(url,init);
 }
 return {state,fetchImpl};
}
