/** Current canonical read subject. Historical review fixtures remain immutable evidence. */
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {prepare} from '../binding.mjs';
import {envelope as currentEnvelope} from '../fixtures.mjs';
export {hash,validateShape};
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=Date.parse('2026-10-12T12:00:00.000Z');
const binding=()=>({tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
const scopes=()=>[{tenantId:'synthetic-tenant',kind:'client',resourceId:id(10),policyRevision:'revision-1'}];
export function context(){return {lookupId:id(20),resultReference:id(21),requestId:id(22),binding:binding(),scopes:scopes(),selectedClientId:id(10),deliveryJson:JSON.stringify({context:{binding:binding()},producer:{namespace:'synthetic-review',executionId:'synthetic-task'},deliveryId:'synthetic-lookup'}),slots:{started:{eventId:id(30),sequence:41},terminal:{eventId:id(31),sequence:42}},deadlineMs:NOW+10000};}
export const readContext=()=>({currentBinding:binding(),scopes:scopes(),deadlineMs:NOW+10000});
export function envelope(request={},c=context()){const out=currentEnvelope(prepare(request,c,NOW));out.result.requestId=c.requestId;return out;}
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
