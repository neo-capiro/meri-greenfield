/** Correlation of an intent response with the request the caller captured, and internal consistency of what the server retained.
 * Nothing here approves, executes or authorizes anything; every check only refuses a response that does not describe the request. */
import canonicalize from 'canonicalize';
import {fail} from './boundary.mjs';
const sha=async value=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalize(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const conflict=()=>fail('INTENTS_CORRELATION');
const instant=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)conflict();return at;};
/** The retained proposal must describe itself: its hash is the canonical hash of its command, it belongs to the requested conversation and tenant. */
async function proposal(value,conversationId){
 const command=value.command;
 if(await sha(command)!==value.commandSha256||value.requiredApprover.tenantId!==command.binding.tenantId||command.binding.conversationId!==conversationId||
  command.scopes.some(scope=>scope.tenantId!==command.binding.tenantId)||instant(value.expiresAt)<=instant(value.createdAt))conflict();
}
function decision(value,retained){
 instant(value.decidedAt);instant(value.expiresAt);
 if(value.proposalId!==retained.proposalId||value.commandSha256!==retained.commandSha256)conflict();
}
function outcome(value,retained){
 if(value.receipt.commandSha256!==retained.commandSha256||value.receipt.commandId!==retained.command.commandId)conflict();
}
/** `phase` is derived server-side from execution evidence first, then the current decision, then expiry (approval.mjs item()). */
function phase(item){
 const {decision:d,execution,phase:p}=item;
 if(execution!==null&&typeof execution==='object'){if(p!==execution.state)conflict();return;}
 if(d!==null&&typeof d==='object'){if(p!==d.decision)conflict();return;}
 if(!(d===null?['awaiting_approval','expired']:['expired','unknown_decision']).includes(p))conflict();
}
async function item(value,conversationId){
 instant(value.createdAt);
 if(!Object.hasOwn(value,'proposal'))return;
 await proposal(value.proposal,conversationId);
 if(value.decision!==null&&typeof value.decision==='object')decision(value.decision,value.proposal);
 if(value.execution!==null&&typeof value.execution==='object'&&value.execution.state==='completed')outcome(value.execution.outcome,value.proposal);
 phase(value);
}
export async function list(value,request){
 const limit=request.limit??20;
 if(value.conversationId!==request.conversationId||value.intents.length>limit)conflict();
 const ids=value.intents.map(entry=>entry.deliveryId);
 if(new Set(ids).size!==ids.length)conflict();
 // The journal returns a full page plus a cursor naming its last entry, or no cursor.
 if(value.next!==null&&(value.intents.length!==limit||value.next!==ids.at(-1)))conflict();
 for(const entry of value.intents)await item(entry,request.conversationId);
 return value;
}
export function decide(value,request){
 if(value.deliveryId!==request.deliveryId||value.proposalId!==request.proposalId)conflict();
 const d=value.decision;instant(d.decidedAt);instant(d.expiresAt);
 if(d.proposalId!==request.proposalId||d.commandSha256!==request.commandSha256||d.decision!==request.decision)conflict();
 if((value.status==='rejected')!==(request.decision==='rejected'))conflict();
 if(value.status==='executed'&&value.outcome.receipt.commandSha256!==request.commandSha256)conflict();
 return value;
}
