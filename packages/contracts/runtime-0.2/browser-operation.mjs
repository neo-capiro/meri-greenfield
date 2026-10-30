/** Closed internal descriptor for ONE dispatched browser call.
 *
 * The intent journal stores exactly {operation,argumentsSha256}; this module owns the preimage behind
 * argumentsSha256 and the domain-separated identity behind the row's delivery id, so a browser
 * EXECUTION row can never be read as an approval proposal and vice versa, even though both use the
 * `browser:` delivery prefix.
 *
 * Preimage (canonical JSON, keys sorted by canonicalize):
 *   { schema:'meri-browser-operation-descriptor/1',
 *     binding:<the COMPLETE RunBinding: tenant, actor, conversation, run, attempt, worker, writerFence>,
 *     requestId:<64 hex MCP request identity, NOT an SDK tool-use id>,
 *     tool:<browser tool name>,
 *     inputSha256:<canonicalSha256(args)>,
 *     policySha256:<the effective browser policy digest of that run>,
 *     scopes:<the canonical scopes of that run> }
 * No clock, lease, expiry or 'now' value is part of the preimage: a retry after a restart recomputes
 * the same identity, and an advancing time can never fork a second row for the same call.
 */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';

export const BROWSER_OPERATION_DESCRIPTOR_SCHEMA='meri-browser-operation-descriptor/1';
export const BROWSER_OPERATION='browser.action';
export const BROWSER_OPERATION_CONTRACT=Object.freeze({id:'browser_action',version:'0.2.0'});
export const BROWSER_EXECUTION_DOMAIN='meri-browser-execution/1';
export const BROWSER_APPROVAL_DOMAIN='meri-browser-approval/1';
const HEX=/^[0-9a-f]{64}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('BROWSER_OPERATION_REFUSED');
const hex=value=>{if(typeof value!=='string'||!HEX.test(value))deny();return value;};

/** One closed descriptor. Every field comes from the authenticated run/current owners, never a caller. */
export function assertBrowserOperationDescriptor(raw){
 let d;try{d=own(data(raw),['schema','binding','requestId','tool','inputSha256','policySha256','scopes']);}catch{deny();}
 if(d.schema!==BROWSER_OPERATION_DESCRIPTOR_SCHEMA)deny();
 try{validateShape('RunBinding',data(d.binding));}catch{deny();}
 if(typeof d.tool!=='string'||!d.tool||d.tool.length>128)deny();
 if(!Array.isArray(d.scopes)||d.scopes.length===0||d.scopes.length>100)deny();
 for(const scope of d.scopes){try{validateShape('Scope',data(scope));}catch{deny();}
  if(scope.tenantId!==d.binding.tenantId)deny();}
 return Object.freeze({schema:BROWSER_OPERATION_DESCRIPTOR_SCHEMA,binding:Object.freeze(data(d.binding)),
  requestId:hex(d.requestId),tool:d.tool,inputSha256:hex(d.inputSha256),policySha256:hex(d.policySha256),
  scopes:Object.freeze(d.scopes.map(scope=>Object.freeze(data(scope))))});
}
/** The stable digest the journal stores. It is the ONLY browser content in the SQL record. */
export const browserOperationArgumentsSha256=descriptor=>canonicalSha256(assertBrowserOperationDescriptor(descriptor));
/** The SQL record: exactly the two keys the approved table constraint allows. */
export function browserOperationRecord(descriptor){
 return Object.freeze({operation:BROWSER_OPERATION_CONTRACT,argumentsSha256:browserOperationArgumentsSha256(descriptor)});
}
/** Domain-separated delivery identity. An execution id and an approval id never collide, even for the
 * same run and the same request, because the domain tag differs. */
const delivery=(domain,binding,requestId)=>{
 validateShape('RunBinding',data(binding));
 const digest=canonicalSha256({domain,binding:data(binding),requestId:hex(requestId)});
 return `browser:${digest}`;
};
export const browserExecutionDeliveryId=({binding,requestId})=>delivery(BROWSER_EXECUTION_DOMAIN,binding,requestId);
/** Approval proposals are a DIFFERENT identity domain on purpose: they key on the SDK's toolUseId and the
 * deterministic proposal id, never on the MCP requestId that identifies browser EXECUTION custody. */
export function browserApprovalDeliveryId({binding,toolUseId,proposalId}){
 validateShape('RunBinding',data(binding));
 if(typeof toolUseId!=='string'||toolUseId.length===0||toolUseId.length>512||!/^\S+$/u.test(toolUseId))deny();
 if(typeof proposalId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(proposalId))deny();
 const digest=canonicalSha256({domain:BROWSER_APPROVAL_DOMAIN,binding:data(binding),toolUseId,proposalId});
 return `browser:${digest}`;
}
/** The deterministic proposal identity for one browser approval: the same binding, SDK tool-use and subject
 * always name the same proposal, so a repeat recovery is not a new proposal. */
export function browserPreparationProposalId({binding,toolUseId,subjectSha256}){
 validateShape('RunBinding',data(binding));
 if(typeof toolUseId!=='string'||toolUseId.length===0||!/^\S+$/u.test(toolUseId))deny();
 if(typeof subjectSha256!=='string'||!/^[0-9a-f]{64}$/u.test(subjectSha256))deny();
 const h=canonicalSha256({domain:'meri-browser-approval-proposal/1',binding:data(binding),toolUseId,subjectSha256});
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
/** True only for a row this module owns: the prefix AND the execution domain derivation. */
export function isBrowserExecutionDeliveryId(deliveryId,binding,requestId){
 try{return typeof deliveryId==='string'&&deliveryId===browserExecutionDeliveryId({binding,requestId});}catch{return false;}
}
