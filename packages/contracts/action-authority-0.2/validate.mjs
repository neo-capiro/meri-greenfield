/** Private proposed Capiro/Meri authority wire. No public package registration or transport. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const applicationAuthorityRoutes=Object.freeze({identity:'/api/clio/application-authority/identity',context:'/api/clio/application-authority/context'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,sha=/^[0-9a-f]{64}$/u;
const refuse=()=>{throw Error('INVALID_APPLICATION_AUTHORITY');};
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;
function principal(p){own(p,['tenantId','actorId']);if(!text(p.tenantId)||!text(p.actorId))refuse();}
function times(r){if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<0||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.checkedAtMs)refuse();}
export function assertAuthorityIdentityRequest(value){return data(own(value,[]));}
export function assertAuthorityContextRequest(value){const v=data(value);own(v,['identitySha256','conversationId','clientId']);if(typeof v.identitySha256!=='string'||!sha.test(v.identitySha256)||['conversationId','clientId'].some(k=>typeof v[k]!=='string'||!uuid.test(v[k])))refuse();return v;}
export function assertAuthorityIdentityReceipt(value){const v=data(value);own(v,['principal','identityRevision','checkedAtMs','expiresAtMs']);principal(v.principal);times(v);if(!text(v.identityRevision))refuse();return v;}
export function assertAuthorityContextReceipt(value){const v=data(value);own(v,['identitySha256','principal','identityRevision','conversationId','selectedClientId','contextRevision','checkedAtMs','expiresAtMs']);principal(v.principal);times(v);if(typeof v.identitySha256!=='string'||!sha.test(v.identitySha256)||!text(v.identityRevision)||!text(v.contextRevision)||['conversationId','selectedClientId'].some(k=>typeof v[k]!=='string'||!uuid.test(v[k])))refuse();return v;}
