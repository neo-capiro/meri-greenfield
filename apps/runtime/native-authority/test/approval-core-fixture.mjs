/** SYNTHETIC Core for the P-INT-10 approval routes: fake `POST /api/clio/approvals/native/{record,decision}` following
 * capiro-backend b7c6e9cf `NativeApprovalService` (approver == authenticated user == binding actor, immutable decision keyed on
 * (tenant, proposalId), decision reads compare only tenant/actor/conversation/run). No network, live Core or credential. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {CORE_APPROVAL_ROUTES} from '../approval-forwarder.mjs';
export const CORE_ORIGIN='https://core.synthetic.invalid',SECRET='synthetic-approvals-service-secret';
const same=(a,b)=>hash(a)===hash(b);
/** `state`: {bearers:{<nativeCredential>:{tenantId,userId}}, serviceSecret, coreNow(), requests:[], rewrite?, contentType?}. */
export function approvalCore(state){
 const decisions=new Map();
 function record(ctx,body){
  const {proposal,decision,approver,binding}=body,b=proposal.command.binding;
  if(approver.tenantId!==ctx.tenantId||approver.actorId!==ctx.userId||!same(approver,proposal.requiredApprover)||b.tenantId!==ctx.tenantId||b.actorId!==ctx.userId)return [403,{message:'Native approval refused'}];
  if(!same(binding,b))return [409,{message:'Approval binding differs from the proposal'}];
  if(proposal.command.action!=='task.create')return [409,{message:'Approval action is not supported'}];
  const now=state.coreNow();if(Date.parse(proposal.expiresAt)<=now)return [409,{message:'Approval proposal expired'}];
  const revisions=new Set(proposal.command.scopes.map(s=>s.policyRevision));if(revisions.size!==1)return [409,{message:'Approval scopes must share one tenant and policy revision'}];
  const key=`${ctx.tenantId}:${proposal.proposalId}`;
  if(!decisions.has(key))decisions.set(key,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision,decidedAt:new Date(Math.max(now,Date.parse(proposal.createdAt))).toISOString(),expiresAt:proposal.expiresAt,approver:{tenantId:ctx.tenantId,actorId:ctx.userId},policyRevision:[...revisions][0],binding:b});
  const stored=decisions.get(key);if(stored.commandSha256!==proposal.commandSha256)return [409,{message:'Approval proposal already decided for another command'}];
  const {binding:_,...d}=stored;return [200,{decision:d,checkedAtMs:state.coreNow(),revoked:false}];
 }
 function decision(ctx,body){
  const {proposalId,commandSha256,binding}=body;if(binding.tenantId!==ctx.tenantId||binding.actorId!==ctx.userId)return [403,{message:'Native approval refused'}];
  const stored=decisions.get(`${ctx.tenantId}:${proposalId}`);
  if(!stored||stored.commandSha256!==commandSha256||stored.binding.actorId!==binding.actorId||stored.binding.conversationId!==binding.conversationId||stored.binding.runId!==binding.runId)return [200,{decision:null,checkedAtMs:state.coreNow(),revoked:false}];
  const {binding:_,...d}=stored;return [200,{decision:d,checkedAtMs:state.coreNow(),revoked:false}];
 }
 async function fetchImpl(url,init){
  const entry={url,headers:{...init.headers},body:JSON.parse(init.body)};state.requests.push(entry);
  if(init.method!=='POST'||init.redirect!=='error'||init.credentials!=='omit')return new Response('',{status:400});
  if(init.headers['x-internal-service-secret']!==(state.serviceSecret??SECRET))return new Response(JSON.stringify({message:'service identity'}),{status:403,headers:{'content-type':'application/json'}});
  const ctx=state.bearers[(init.headers.authorization??'').replace(/^Bearer /u,'')];
  if(!ctx)return new Response(JSON.stringify({message:'unauthorized'}),{status:401,headers:{'content-type':'application/json'}});
  let status,body;
  if(url===CORE_ORIGIN+CORE_APPROVAL_ROUTES.record)[status,body]=record(ctx,entry.body);
  else if(url===CORE_ORIGIN+CORE_APPROVAL_ROUTES.decision)[status,body]=decision(ctx,entry.body);
  else return new Response('',{status:404});
  if(state.rewrite)[status,body]=await state.rewrite(status,body,entry);
  return new Response(JSON.stringify(body),{status,headers:{'content-type':status===200?state.contentType??'application/json':'application/json'}});
 }
 return {fetchImpl,decisions};
}
