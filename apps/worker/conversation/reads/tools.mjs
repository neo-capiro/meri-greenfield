// @ts-check
/** Descriptor → SDK tool definition for one available read. Names, descriptions, hints and annotations derive only
 * from the canonical catalog descriptor (FABLE-GENERAL-READ-TOOLS-20261015 §2.1); nothing is hand-written per tool.
 * Legacy aliases are never exposed as names. */
import {tool} from '@anthropic-ai/claude-agent-sdk';
import {z} from 'zod';
import {sdkToolName} from '../skills/mcp.mjs';
import {advertisedArguments} from './schema.mjs';
export const READ_SERVER_NAME='meri_reads';
export const READ_TOOL_PREFIX=`mcp__${READ_SERVER_NAME}__`;
const MAX_DESCRIPTION=2048,MAX_LIMITS=4;
/** @param {{operation:{id:string,version:string}}} row */
export const readToolName=row=>`${READ_TOOL_PREFIX}${sdkToolName(row.operation)}`;
/** @param {any} d */
function description(d,mode){
 const lines=[`${d.displayName}. ${d.whenToUse}`];
 if(d.limitations?.length)lines.push(`Limits: ${d.limitations.slice(0,MAX_LIMITS).join(' ')}`);
 for(const example of d.negativeExamples??[])lines.push(`Do not: ${example}`);
 lines.push(`Canonical input schema ${d.inputSchema.id}, SHA256 ${d.inputSchema.sha256}${mode==='envelope'?' (supply it as the arguments object; the gateway validates it)':''}.`);
 lines.push('Supply literal arguments only; credentials and scope authority remain with the gateway.');
 const text=lines.join('\n');return text.length>MAX_DESCRIPTION?text.slice(0,MAX_DESCRIPTION):text;
}
/** @param {{operation:{id:string,version:string},descriptor:any}} row @param {(raw:any,extra:any)=>Promise<any>} handler @param {boolean} alwaysLoad */
export function defineReadTool(row,handler,alwaysLoad){
 const d=row.descriptor,advertised=advertisedArguments(d.inputSchema);
 const shape={arguments:advertised.arguments,_meriInvocation:z.string().optional().describe('Reserved correlation supplied only by the trusted SDK hook')};
 const searchHint=(d.positiveExamples??[]).join(' ').slice(0,512);
 const definition=tool(sdkToolName(row.operation),description(d,advertised.mode),shape,handler,{annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},alwaysLoad,...(searchHint?{searchHint}:{})});
 return Object.freeze({definition,mode:advertised.mode,shape});
}
/** The SDK leaves a tool out of its list when its input schema cannot become JSON Schema; that is a configuration
 * failure here, never a silent omission. @param {Record<string,z.ZodType>} shape */
export function assertConvertible(shape){
 try{z.toJSONSchema(z.object(shape),{io:'input'});}catch{throw Object.assign(Error('READ_SCHEMA_CONFIGURATION'),{code:'READ_SCHEMA_CONFIGURATION'});}
}
