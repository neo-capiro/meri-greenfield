/** Core ca4de503's closed combined wire receipt. Data only; no authority is minted here. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HASH=/^[a-f0-9]{64}$/u;
const revisions=['identityRevision','membershipRevision','contextRevision'];
const refuse=()=>{throw Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{code:'RECEIPT_SHAPE'});};
export function currentRequest(raw){
 const v=data(own(raw,['conversationId','clientId'],['expect']));
 if(typeof v.conversationId!=='string'||typeof v.clientId!=='string'||!UUID.test(v.conversationId)||!UUID.test(v.clientId))refuse();
 if(v.expect!==undefined){own(v.expect,[],revisions);if(Object.values(v.expect).some(r=>typeof r!=='string'||!HASH.test(r)))refuse();}
 return v;
}
export function currentReceipt(raw){
 const v=data(own(raw,['principal','role','permissions','clientIds',...revisions,'conversationId','selectedClientId','checkedAtMs','expiresAtMs']));
 own(v.principal,['tenantId','actorId']);
 if(!['standard_user','user_admin','capiro_admin'].includes(v.role)||Array.isArray(v.clientIds)&&v.clientIds.every(id=>typeof id==='string'&&UUID.test(id))&&!v.clientIds.includes(v.selectedClientId))throw Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:403,code:'RECEIPT_ROLE_OR_CLIENT'});
 if(Object.values(v.principal).some(id=>typeof id!=='string'||!id||id.length>256)||
  !['standard_user','user_admin','capiro_admin'].includes(v.role)||revisions.some(k=>typeof v[k]!=='string'||!HASH.test(v[k]))||
  !UUID.test(v.conversationId)||!UUID.test(v.selectedClientId)||
  !Array.isArray(v.permissions)||v.permissions.length>64||new Set(v.permissions).size!==v.permissions.length||v.permissions.some(p=>typeof p!=='string'||!/^[a-z][a-z0-9_.-]{0,63}$/u.test(p))||
  !Array.isArray(v.clientIds)||v.clientIds.length>4096||new Set(v.clientIds).size!==v.clientIds.length||v.clientIds.some(id=>typeof id!=='string'||!UUID.test(id))||!v.clientIds.includes(v.selectedClientId)||
  !Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<0||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=v.checkedAtMs)refuse();
 return v;
}
export const currentRevisions=receipt=>Object.fromEntries(revisions.map(key=>[key,receipt[key]]));
