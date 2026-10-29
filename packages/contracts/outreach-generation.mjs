/** Outreach launch wire only. Core owns the recipient claim; these checks grant no authority. */
import {receiveConversationSessionReceipt} from './dist/conversation-session.mjs';
export const outreachGenerationStartMetadata=Object.freeze({version:'1.0.0',path:'/api/outreach-generation/start',method:'POST',requestBytes:2048,responseBytes:8192});
const invalid=()=>{throw Error('OUTREACH_GENERATION_WIRE_INVALID');};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)invalid();const out={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!('value'in d))invalid();out[k]=d.value;}return out;}
export function requireOutreachGenerationStartRequest(value){const v=object(value,['generationJobId','itemId']);if(!uuid(v.generationJobId)||!uuid(v.itemId))invalid();return Object.freeze(v);}
export function receiveOutreachGenerationStartResponse(status,jsonText,expected,at){
 const ids=requireOutreachGenerationStartRequest({generationJobId:expected.generationJobId,itemId:expected.itemId});
 if(typeof jsonText!=='string'||new TextEncoder().encode(jsonText).byteLength>outreachGenerationStartMetadata.responseBytes)invalid();let raw;try{raw=JSON.parse(jsonText);}catch{invalid();}
 if(status===202){const v=object(raw,['state','generationJobId','itemId','conversationId','requestId','session']);if(v.state!=='requested'||v.generationJobId!==ids.generationJobId||v.itemId!==ids.itemId||!uuid(v.conversationId)||!uuid(v.requestId))invalid();
  const client=v.session?.context?.selectedClientId,context={tenantId:v.session?.context?.tenantId,actorId:v.session?.context?.actorId,conversationId:v.conversationId,selectedClientId:client,scopeKind:client===null?'general':'client'};
  const encode=v=>new TextEncoder().encode(JSON.stringify(v));const session=receiveConversationSessionReceipt(encode(v.session),encode(context),at);return Object.freeze({...v,session});}
 const error=object(object(raw,['error']).error,['code']),codes=status===400?['OUTREACH_GENERATION_REFUSED']:status===401?['SESSION_REFUSED']:status===503?['OUTREACH_GENERATION_UNAVAILABLE','OUTREACH_GENERATION_UNKNOWN']:[];
 if(!codes.includes(error.code))invalid();return Object.freeze({error:Object.freeze(error)});
}
