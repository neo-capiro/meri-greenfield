// @ts-check
/** Intent rows → SDK tool definitions. One tool per intent name (for example `request_document`), whose `operation`
 * selects among that tool's available capabilities. Descriptions derive only from canonical catalog descriptors.
 * Annotations are never read-only: every intent prepares a proposal or draft and is reviewed before any effect. */
import {tool} from '@anthropic-ai/claude-agent-sdk';
import {z} from 'zod';
import {intentDescriptor,intentToolName} from './catalog.mjs';
const MAX_DESCRIPTION=4096;
export const INTENT_ANNOTATIONS=Object.freeze({readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false});
/** @param {readonly import('./catalog.mjs').IntentRow[]} rows */
function description(rows){
 const lines=['Prepare a write request for the user to review. This never applies a change: it returns an immutable proposal that the user must approve in Meri, or an immutable draft version.'];
 for(const r of rows){const d=intentDescriptor(r.operation);
  lines.push(`operation "${r.operation.id}": ${d.displayName}. ${d.whenToUse}`);
  for(const example of d.negativeExamples??[])lines.push(`  Do not: ${example}`);
  lines.push(`  arguments follow canonical input schema ${d.inputSchema.id}, SHA256 ${d.inputSchema.sha256}; the owner validates them.`);}
 lines.push('Supply literal arguments only; identity, tenant, approval and scope authority come from the trusted run, never from arguments.');
 const text=lines.join('\n');return text.length>MAX_DESCRIPTION?text.slice(0,MAX_DESCRIPTION):text;
}
/** @param {string} name intent tool name @param {readonly import('./catalog.mjs').IntentRow[]} rows available rows of this tool
 * @param {(raw:any,extra:any)=>Promise<any>} handler */
export function defineIntentTool(name,rows,handler){
 const ids=/** @type {[string,...string[]]} */(rows.map(r=>r.operation.id));
 const shape={operation:z.enum(ids),arguments:z.record(z.string(),z.unknown()).describe('The canonical request object for the selected operation'),
  _meriInvocation:z.string().optional().describe('Reserved correlation supplied only by the trusted SDK hook')};
 z.toJSONSchema(z.object(shape),{io:'input'});
 return Object.freeze({name:intentToolName(name),definition:tool(name,description(rows),shape,handler,{annotations:INTENT_ANNOTATIONS,alwaysLoad:true})});
}
