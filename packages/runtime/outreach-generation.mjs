/** Core owns the immutable recipient unit, instructions, schema and final semantic validation. */
import {own,data} from '../contracts/commands-0.2/execution-boundary.mjs';
export const outreachFailure=()=>Object.assign(Error('OUTREACH_GENERATION_REFUSED'),{code:'OUTREACH_GENERATION_REFUSED'});
const fail=()=>{throw outreachFailure();};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n;
export function outreachSelection(raw){
 const v=data(own(raw,['generationJobId','itemId','conversationId','clientId','requestId','prompt','outputSchema','generationKey','revision']));
 if(![v.generationJobId,v.conversationId,v.requestId].every(uuid)||v.clientId!==null&&!uuid(v.clientId)||!uuid(v.itemId)||!text(v.generationKey,768)||!text(v.prompt,100000)||!v.prompt.trim()||!Number.isSafeInteger(v.revision)||v.revision<0)fail();
 if(Buffer.byteLength(JSON.stringify({requestId:v.requestId,prompt:v.prompt}))>131072||Buffer.byteLength(JSON.stringify(v.outputSchema))>131072)fail();
 if(v.outputSchema===null||typeof v.outputSchema!=='object'||Array.isArray(v.outputSchema)||v.outputSchema.type!=='object')fail();
 // Core emits a closed local schema. Never let a schema select a network resource.
 function local(value){if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(['$ref','$dynamicRef'].includes(key)&&(typeof child!=='string'||!child.startsWith('#/')))fail();local(child);}}
 local(v.outputSchema);return v;
}
export const outreachIdentity=v=>({generationJobId:v.generationJobId,itemId:v.itemId,conversationId:v.conversationId,requestId:v.requestId});
export function assertOutreachRequest(selection,{binding,request,selectedClientId}){
 const v=outreachSelection(selection);
 if(v.conversationId!==binding.conversationId||v.requestId!==request.requestId||v.prompt!==request.prompt||v.clientId!==selectedClientId||request.skill||request.windowRequest)fail();
 return v;
}

export const outreachPromptHint=value=>typeof value==='string'&&value.startsWith('[Capiro Outreach recipient unit v1]\n');
