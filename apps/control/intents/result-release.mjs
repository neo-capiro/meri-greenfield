/** Current canonical result-release authorization. LOCAL PROPOSAL: the trusted startup must supply this owner;
 * listing availability or retaining a proposal never supplies authority. Original grant expiry is journaled once. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
const deny=()=>{throw intentFault('ACCESS_DENIED');};
const conversation=(a,b)=>['tenantId','actorId','conversationId'].every(k=>a?.[k]===b?.[k]);
function scopes(raw,binding){
 if(!Array.isArray(raw)||!raw.length||raw.length>100)deny();
 for(const s of raw){validateShape('Scope',s);if(s.tenantId!==binding.tenantId)deny();}
 if(new Set(raw.map(hash)).size!==raw.length)deny();return raw;
}
function resultScopes(owner,result,original){
 if(owner==='command'){
  if(result.status!=='approval_required'||hash(result.proposal?.command?.binding)!==hash(original.binding))deny();
  return result.proposal.command.scopes;
 }
 if(owner==='document'){
  if(result.status!=='draft'||hash(result.version?.binding)!==hash(original.binding))deny();return result.version.scopes;
 }
 if(owner==='schedule'){
  if(result.status!=='approval_required'||result.proposal?.projection?.owner?.tenantId!==original.binding.tenantId)deny();
  return result.proposal.projection.scopes;
 }
 return deny();
}
export function createIntentResultRelease({authority,binding,now}){
 const port=authority===undefined?undefined:own(authority,['check']);
 if(port!==undefined&&typeof port.check!=='function')throw intentFault('INTENT_CONFIGURATION');
 const available=port!==undefined;
 async function check({operation,deliveryId,argumentsSha256,original,result,life}){
  if(!available)throw intentFault('UNAVAILABLE');
  let prior=null;
  if(original!==null){
   prior=data(own(original,['binding','scopes','expiresAtMs']));validateShape('RunBinding',prior.binding);
   if(!conversation(prior.binding,binding)||!Number.isSafeInteger(prior.expiresAtMs)||prior.expiresAtMs<=now())deny();
   scopes(prior.scopes,binding);life.limitDeadline(prior.expiresAtMs);
  }
  const selection=data({binding,operation,deliveryId,argumentsSha256,original:prior,resultSha256:result===null?null:hash(result)}),started=now();
  const receipt=data(own(await life.run(signal=>port.check.call(authority,{selection,selectionSha256:hash(selection),signal,limitDeadline:life.limitDeadline})),
   ['authorized','selectionSha256','binding','scopes','checkedAtMs','expiresAtMs']));
  const at=now();
  if(receipt.authorized!==true||receipt.selectionSha256!==hash(selection)||hash(receipt.binding)!==hash(binding)||
   !Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=at)deny();
  scopes(receipt.scopes,binding);life.limitDeadline(receipt.expiresAtMs);life.check();
  return {receipt,prior};
 }
 return Object.freeze({available,
  async capture(call){const {receipt}=await check({...call,original:null,result:null});return data({binding,scopes:receipt.scopes,expiresAtMs:receipt.expiresAtMs});},
  async release({owner,result,...call}){
   const {receipt,prior}=await check({...call,result});if(prior===null)deny();
   const ss=scopes(resultScopes(owner,result,prior),binding),originalScopes=new Set(prior.scopes.map(hash)),currentScopes=new Set(receipt.scopes.map(hash));
   if(ss.some(s=>!originalScopes.has(hash(s))||!currentScopes.has(hash(s))))deny();
   if(owner==='command'){
    const expiry=Date.parse(result.proposal.expiresAt);if(!Number.isSafeInteger(expiry)||expiry<=now())deny();call.life.limitDeadline(expiry);
   }
   call.life.check();return result;
  },
 });
}
