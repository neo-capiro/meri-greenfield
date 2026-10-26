/** Canonical issuance shape shared by CONTROL and the conversation browser receiver. */
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const principal={type:'string',minLength:1,maxLength:256};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function sessionContextSchema({general=false}={}){return object({tenantId:principal,actorId:principal,conversationId:uuid,runId:uuid,selectedClientId:general?{anyOf:[uuid,{type:'null'}]}:uuid});}
export function sessionReceiptSchema({general=false}={}){
 const receipt=object({credential:{type:'string',pattern:'^action_session_[A-Za-z0-9_-]{43}$'},expiresAtMs:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},context:sessionContextSchema({general})});
 // Only a fresh authenticated issuance may describe the initial journal's exact never-started rebind.
 // This is receipt data, never an input hint or authority supplied by the browser.
 receipt.properties.initialRunRebind=object({sourceRunId:uuid,targetRunId:uuid});
 return receipt;
}
export function conversationSessionSchema(){const client=sessionContextSchema(),general=sessionContextSchema({general:true});
 client.properties.scopeKind={const:'client'};client.required.push('scopeKind');
 general.properties.selectedClientId={type:'null'};general.properties.scopeKind={const:'general'};general.required.push('scopeKind');
 // Core bootstrap owns the conversation; CONTROL chooses the first run. Hints, when present, remain exact constraints.
 client.required=client.required.filter(key=>!['runId','conversationId'].includes(key));general.required=general.required.filter(key=>key!=='runId');
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:meri:conversation-session:1.0.0',$defs:{ConversationSessionReceipt:sessionReceiptSchema({general:true}),ConversationSessionExpectedContext:{oneOf:[client,general]}}};
}
