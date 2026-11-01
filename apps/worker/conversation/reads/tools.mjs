// @ts-check
/** Descriptor → SDK tool definition for one available read. Names, hints and annotations derive only from the
 * canonical catalog descriptor (FABLE-GENERAL-READ-TOOLS-20261015 §2.1). The description is the descriptor's own
 * displayName/whenToUse/negative examples plus the family's reviewed guidance (`family-guidance.mjs`: what the family
 * covers and returns, how its result declares absent/partial/stale data, and the SQL-first routing sentence for
 * structured families). Registration-era catalog limitations that are false for a mounted read are never shown.
 * Per-operation live guidance preserves the argument/result detail and replacement limits owned by `guidance.mjs`.
 * Legacy aliases are never exposed as names. */
import {tool} from '@anthropic-ai/claude-agent-sdk';
import {z} from 'zod';
import {sdkToolName} from '../skills/mcp.mjs';
import {advertisedArguments} from './schema.mjs';
import {READ_FAMILY_GUIDANCE,SQL_FIRST_GUIDANCE,SQL_ABSENT_GUIDANCE} from './family-guidance.mjs';
import {readGuidance} from './guidance.mjs';
export const READ_SERVER_NAME='meri_reads';
export const READ_TOOL_PREFIX=`mcp__${READ_SERVER_NAME}__`;
/** 4096 holds the longest descriptor with every optional line: query_capiro_data@0.3.0 states the PostgreSQL contract
 * (`tools.test.mjs` proves nothing of the two SQL descriptors is dropped). */
export const MAX_DESCRIPTION=4096,MAX_LIMITS=4;
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
/** Catalog limitations that describe the registration row (null handler, pending qualification, frozen declared types),
 * not the data: true of the catalog, false of a read that is mounted and executing. Closed patterns, no source detail. */
const REGISTRATION_LIMITATION=/null handler|Pending (?:private )?contract only|no enabled source|remains? unqualified|remains? unverified|remain required|Source presence does not qualify|does not qualify native installation|Source requirements are design declarations|Local source validation does not qualify|Outputs are frozen declared types|generic gateway composition for this context remains unqualified/iu;
/** The descriptor limitations the model should still see. @param {any} d @returns {string[]} */
export const domainLimitations=d=>(d.limitations??[]).filter((/** @type {string} */l)=>!REGISTRATION_LIMITATION.test(l));
/** @param {{operation:{id:string,version:string}}} row */
export const readToolName=row=>`${READ_TOOL_PREFIX}${sdkToolName(row.operation)}`;
/** The model-facing description of one read. The mandatory lines (identity, coverage, returns, states, routing, schema
 * pin and the literal-arguments rule) always fit; optional limits and negative examples are added only while the whole
 * text stays within MAX_DESCRIPTION, so nothing is ever cut mid-sentence.
 * @param {any} d @param {string} family @param {{sqlPrimary:boolean}} options */
export function describeRead(d,family,{sqlPrimary}){
 const operational=readGuidance(sdkToolName(d.operation));
 const guidance=READ_FAMILY_GUIDANCE[family];if(!guidance)throw fault('READ_GUIDANCE_CONFIGURATION');
 const head=[`${d.displayName}. ${d.whenToUse}`,`Covers: ${guidance.covers}`,`Returns: ${guidance.returns}`,`Result states: ${guidance.states}`,...(operational?.usage??[]),
  ...(guidance.structured?[sqlPrimary?SQL_FIRST_GUIDANCE:SQL_ABSENT_GUIDANCE]:[])];
 const tail=[`Canonical input schema ${d.inputSchema.id}, SHA256 ${d.inputSchema.sha256}.`,'Supply literal arguments only; credentials and scope authority remain with the gateway.'];
 const limits=(operational?.limitations.length?operational.limitations:domainLimitations(d)).slice(0,MAX_LIMITS),optional=[...(limits.length?[`Limits: ${limits.join(' ')}`]:[]),...(d.negativeExamples??[]).map((/** @type {string} */example)=>`Do not: ${example}`)];
 const lines=[...head,...tail];
 if(lines.join('\n').length>MAX_DESCRIPTION)throw fault('READ_DESCRIPTION_LIMIT');
 for(const line of optional)if([...lines,line].join('\n').length<=MAX_DESCRIPTION)lines.splice(lines.length-tail.length,0,line);
 return lines.join('\n');
}
/** @param {{operation:{id:string,version:string},family:string,descriptor:any}} row @param {(raw:any,extra:any)=>Promise<any>} handler @param {boolean} alwaysLoad @param {{sqlPrimary:boolean}} [options] */
export function defineReadTool(row,handler,alwaysLoad,options={sqlPrimary:false}){
 const d=row.descriptor,advertised=advertisedArguments(d.inputSchema);
 const shape={arguments:advertised.arguments,_meriInvocation:z.string().optional().describe('Reserved correlation supplied only by the trusted SDK hook')};
 const searchHint=(d.positiveExamples??[]).join(' ').slice(0,512);
 const definition=tool(sdkToolName(row.operation),describeRead(d,row.family,options),shape,handler,{annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},alwaysLoad,...(searchHint?{searchHint}:{})});
 return Object.freeze({definition,mode:advertised.mode,shape});
}
/** The SDK leaves a tool out of its list when its input schema cannot become JSON Schema; that is a configuration
 * failure here, never a silent omission. @param {Record<string,z.ZodType>} shape */
export function assertConvertible(shape){
 try{z.toJSONSchema(z.object(shape),{io:'input'});}catch{throw Object.assign(Error('READ_SCHEMA_CONFIGURATION'),{code:'READ_SCHEMA_CONFIGURATION'});}
}
