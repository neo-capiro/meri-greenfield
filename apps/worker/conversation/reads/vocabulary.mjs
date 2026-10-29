// @ts-check
/** The single vocabulary that joins a Core procedure capability grant to the Capiro read it names.
 *
 * One catalog operation is spelled three ways in this repository: its canonical dotted id (`mail.list_messages`),
 * the SDK tool name the read server registers and the model sees (`mail_list_messages`, allowed as
 * `mcp__meri_reads__mail_list_messages`), and the alias the catalog itself declares (`list_emails`) — which is the
 * name Core's capability registry projects for that read. This module resolves all three to the one operation they
 * name, so a procedure grant matches exactly the read it names. It answers only "is this name one of that read's own
 * declared spellings", so an unknown name matches nothing and no operation can be added by a grant.
 *
 * The aliases are read from the frozen catalog; nothing is hand-written here.
 */
import catalog from '../../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
const SPELLINGS=new Map();
for(const descriptor of catalog.operations){
 const id=descriptor.operation.id,spellings=new Set([id,id.replaceAll('.','_'),...(Array.isArray(descriptor.aliases)?descriptor.aliases:[])]);
 for(const spelling of spellings)SPELLINGS.set(spelling,spellings);
}
/** Every spelling of the operation `value` names, or null when it names no catalog operation.
 * @param {unknown} value @returns {ReadonlySet<string>|null} */
export const readOperationSpellings=value=>typeof value==='string'?SPELLINGS.get(value)??null:null;
/** The bare read name of an SDK tool entry: the read server registers `mcp__meri_reads__<name>`.
 * @param {unknown} value @returns {string|null} */
export function bareReadToolName(value){
 if(typeof value!=='string')return null;
 return /^mcp__[a-z0-9_]+__(.+)$/u.exec(value)?.[1]??value;
}
/** True when `value` names any Capiro read operation, under any of its spellings. @param {unknown} value */
export const isCapiroReadTool=value=>readOperationSpellings(bareReadToolName(value))!==null;
/** True only when `granted` names this read under one of its own spellings.
 * @param {readonly string[]} granted @param {unknown} value */
export function procedureGrantsRead(granted,value){
 const spellings=readOperationSpellings(bareReadToolName(value));
 if(spellings===null)return false;
 for(const spelling of spellings)if(granted.includes(spelling))return true;
 return false;
}
