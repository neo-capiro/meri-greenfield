/** SYNTHETIC identity and Core-membership directory for product-access tests. */
import {createMembershipGate} from '../membership.mjs';
export const NOW=Date.parse('2026-10-16T12:00:00.000Z');
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
/** Mutable synthetic directory: token → identity, (tenant,actor) → membership. */
export function directory(){
 const d={now:NOW,tokens:new Map([['token-1',{tenantId:'tenant-one',actorId:'actor-1'}],['token-2',{tenantId:'tenant-two',actorId:'actor-9'}]]),members:new Map(),reads:0};
 d.member=(tenantId,actorId,over={})=>d.members.set(`${tenantId}/${actorId}`,{tenantId,actorId,status:'active',role:'member',permissions:[],clientIds:[id(901)],membershipRevision:'m1',...over});
 d.member('tenant-one','actor-1');d.member('tenant-two','actor-9',{clientIds:[id(902)]});
 d.gate=createMembershipGate({now:()=>d.now,limits:{maxRequestMs:2000,maxFactBytes:65536},
  verifyToken:async({credential})=>{const who=d.tokens.get(credential);if(!who)throw Error('invalid token');return {...who,checkedAtMs:d.now,expiresAtMs:d.now+60000};},
  readMembership:async({tenantId,actorId})=>{d.reads++;const m=d.members.get(`${tenantId}/${actorId}`);if(!m)throw Error('no membership row');return {...m,checkedAtMs:d.now,expiresAtMs:d.now+60000};}});
 return d;
}
