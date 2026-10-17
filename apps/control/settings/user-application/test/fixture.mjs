/** SYNTHETIC identity, Core Fetch and store boundaries around actual membership, settings and API owners. No live service or database. */
import {createCoreMembershipGate} from '../../../product-access/core-membership.mjs';
import {createSettingsStoreDouble} from '../../test/fixtures.mjs';
import {createUserPreferencesService} from '../../user-service.mjs';
import {createUserPreferencesApplication} from '../index.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../../documents.mjs';
export const CLIENT='00000000-0000-4000-8000-000000000001';
export const NOW=Date.parse('2026-10-17T02:00:00.000Z');
export function fixture({maxResponseBytes=16384}={}){
 const state={now:NOW,requests:[],identities:[],status:'active',revision:'member1',writes:0,reads:0,afterRead:null,afterSave:null,afterMembership:null};
 const identity=credential=>({tenantId:'tenant-'+credential,actorId:'actor-'+credential});
 const receipt=credential=>({...identity(credential),status:state.status,role:'standard_user',permissions:[],clientIds:[CLIENT],membershipRevision:state.revision,checkedAtMs:state.now,expiresAtMs:state.now+5000});
 const gate=createCoreMembershipGate({origin:'https://core.synthetic.invalid',now:()=>state.now,limits:{maxRequestMs:1000,maxFactBytes:65536},
  identityContext:{async verifyIdentity(call){state.identities.push(call);if(!['A','B'].includes(call.credential))throw Error('synthetic rejected token');return {principal:identity(call.credential),identityRevision:'identity',checkedAtMs:state.now,expiresAtMs:state.now+5000};}},
  async fetchImpl(url,options){state.requests.push({url,options});const response=Response.json(receipt(options.headers.authorization.slice(7)));await state.afterMembership?.();return response;}});
 const persistence=createSettingsStoreDouble(),store={
  async read(value){state.reads++;const result=await persistence.read(value);await state.afterRead?.(value);return result;},
  async save(value){state.writes++;const result=await persistence.save(value);await state.afterSave?.(value);return result;}};
 let sequence=10;const newId=()=>`00000000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`;
 const service=createUserPreferencesService({store,newId});
 const application=createUserPreferencesApplication({gate,service,now:()=>state.now,limits:{maxRequestMs:1000,maxRequestBytes:8192,maxResponseBytes}});
 const call=(operation,body={},credential='A',extra={})=>application.handle(new Request('https://meri.synthetic.invalid/api/settings/user/'+operation,
  {method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body),...extra}));
 return {state,identity,receipt,gate,persistence,store,newId,service,application,call,preferences:{...USER_PREFERENCE_DEFAULTS,notifications:{...USER_PREFERENCE_DEFAULTS.notifications}}};
}
