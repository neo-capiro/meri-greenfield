// @ts-check
/** Model-facing `arguments` schema for one intent tool, derived from the canonical contract the owner validates
 * (the same guarantee `reads/schema.mjs` gives read tools, without a second copy of the proof).
 *
 * Each intent row's canonical descriptor names the exact input schema its owner validates. This module loads that
 * schema document from the canonical contract package, verifies the descriptor's byte pin, inlines `$ref`s,
 * converts it with zod and proves the result accepts nothing the canonical schema rejects; the conversion is
 * advertised as the SDK tool input, so the model is told the fields instead of an opaque schema identity.
 *
 * Where an owner admits less than its canonical request schema, that owner lane declares the projection here and it
 * is proved the same way, so a declaration can narrow the owner's contract but never widen it. Two such projections
 * exist today:
 *
 * - `save_memory`: no `clientId` (the native memory owner refuses any model-supplied value,
 *   `apps/control/memory/command-options.mjs`), the bounds and scope vocabulary its own normalized arguments
 *   declare, and only `content` required because the rest is derived from the trusted run.
 * - the document rows: the trusted document consumer binds the operation it was composed for into the canonical
 *   request and refuses a conflicting one (`apps/control/intents/document-preparer.mjs`), so the advertised branch
 *   constrains `operation` without requiring the model to repeat a trusted selection, and the proof re-establishes
 *   that exact binding before judging containment. Each canonical branch is narrowed to the formats the document
 *   application admits (`apps/control/document-application/format-admission.mjs`, never a copied table), and a
 *   canonical `oneOf` becomes one advertised branch per admitted format: every advertised branch is contained in
 *   the canonical branch it was narrowed from, and a row's branches stay disjoint on `format`, so no accepted body
 *   falls outside the canonical request. Default admission is advertised; a composition that additionally admits
 *   PDF is narrower here than its owner, never wider.
 *
 * A row whose canonical schema cannot be proved keeps the open record rather than advertising a contract that has
 * not been shown to match; `intentToolArguments` reports which rows those are.
 *
 * No authority lives here: the schema is advisory to the model and the owner re-validates every call. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {executionSchemaDependencies,executionSchemaSources} from '../../../../packages/contracts/retrieval-0.2/execution-schema-sources.mjs';
import {admitDocumentDescriptor} from '../../../control/document-application/format-admission.mjs';
import {isNarrowerOrEqual} from '../reads/schema.mjs';
import {intentDescriptor} from './catalog.mjs';
const fail=()=>{throw Object.assign(Error('INTENT_SCHEMA_CONFIGURATION'),{code:'INTENT_SCHEMA_CONFIGURATION'});};
const CONTRACTS=new URL('../../../../packages/contracts/retrieval-0.2/',import.meta.url);
const MEMORY_DOCUMENT='urn:meri:commands:memory-propose:0.2.0';
/** Canonical schema documents the intent rows resolve through, keyed by their own `$id` (data only, no IO at import). */
let documents=null;
function documentFor(id){
 if(documents===null){
  documents=new Map();
  for(const path of ['research-portfolio-sharing.schema.json','research-portfolio-action.schema.json','watch-action.schema.json','legislative-document-action.schema.json','bizdev-action.schema.json','client-record-action.schema.json','legiwatch-relevance.schema.json','legiwatch-action.schema.json','note-action.schema.json',...executionSchemaSources.map(source=>source.path),...executionSchemaDependencies,'../meri.schema.json']){
   const bytes=readFileSync(new URL(path,CONTRACTS)),doc=JSON.parse(bytes.toString('utf8'));
   if(typeof doc.$id!=='string'||documents.has(doc.$id))fail();
   documents.set(doc.$id,{doc,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 const found=documents.get(id);if(!found)fail();return found;
}
/** @param {any} doc @param {string} fragment */
function pointer(doc,fragment){
 let node=doc;
 for(const part of fragment.replace(/^\//u,'').split('/').filter(Boolean)){
  const key=part.replaceAll('~1','/').replaceAll('~0','~');
  if(node===null||typeof node!=='object'||!Object.hasOwn(node,key))fail();
  node=node[key];
 }
 return node;
}
/** `$ref`s are inlined across the canonical documents; annotation-only `default`s are dropped so the SDK never
 * invents a value the model did not supply. @param {any} node @param {any} base @param {number} depth */
function inline(node,base,depth){
 if(depth>64)fail();
 if(Array.isArray(node))return node.map(entry=>inline(entry,base,depth+1));
 if(node===null||typeof node!=='object')return node;
 if(typeof node.$ref==='string'){
  const [id,fragment='']=node.$ref.split('#');
  const doc=id?documentFor(id).doc:base;
  const resolved=inline(pointer(doc,fragment),doc,depth+1);
  const siblings=Object.fromEntries(Object.entries(node).filter(([key])=>key!=='$ref'));
  return Object.keys(siblings).length?{allOf:[resolved,inline(siblings,base,depth+1)]}:resolved;
 }
 return Object.fromEntries(Object.entries(node).filter(([key])=>key!=='default').map(([key,value])=>[key,inline(value,base,depth+1)]));
}
/** The canonical input schema of one descriptor, by id, verified against the descriptor's byte pin.
 * @param {{id:string,sha256:string}} inputSchema @returns {any} */
export function canonicalIntentInputSchema(inputSchema){
 const [id='',fragment='']=String(inputSchema?.id).split('#');
 if(!id||!fragment||typeof inputSchema.sha256!=='string')fail();
 const {doc,sha256}=documentFor(id);if(sha256!==inputSchema.sha256)fail();
 return inline(pointer(doc,fragment),doc,0);
}
/** Convert one advertised schema and prove that, with the trusted binding `rebound` re-established, it accepts only
 * what the canonical schema accepts. @param {any} advertised @param {any} canonical @param {string|null} rebound */
function prove(advertised,canonical,rebound=null){
 let converted;
 try{
  converted=z.fromJSONSchema(advertised);
  const subject=z.toJSONSchema(converted,{io:'input'}),required=Array.isArray(subject.required)?[...subject.required]:[];
  if(rebound!==null&&!required.includes(rebound))required.push(rebound);
  if(!isNarrowerOrEqual({...subject,required},canonical))fail();
 }
 catch{fail();}
 return converted;
}
/** @typedef {{advertised:any,canonical:any,rebound:string|null}} Declaration */
/** The memory owner's model-facing projection of its canonical request.
 *
 * The owner admits a `MemoryProposeRaw` request whose `content` (trimmed) and `key` fit the bounds its own
 * normalized arguments declare, whose `scope` is one of the scopes it normalizes, and which carries no `clientId`;
 * `ttlDays` is clamped rather than refused, so the canonical request bound stays accurate. `content` is the one
 * field a caller must supply: everything else is derived from the trusted run when it is absent.
 * @param {any} _operation @param {any} canonical @returns {Declaration[]} */
function memoryInput(_operation,canonical){
 if(canonical?.type!=='object'||canonical.additionalProperties!==false)fail();
 const memory=documentFor(MEMORY_DOCUMENT).doc;
 const raw=pointer(memory,'/$defs/MemoryProposeRaw'),normalized=pointer(memory,'/$defs/MemoryProposeArguments');
 const scopes=normalized.properties.scope.enum;
 if(!Array.isArray(scopes)||!scopes.length||!scopes.every(scope=>/^[a-z_]+$/u.test(scope))||!Array.isArray(raw.required))fail();
 return [{advertised:{type:'object',properties:{
  content:normalized.properties.content,
  key:normalized.properties.key,
  scope:{anyOf:[{type:'string',maxLength:raw.properties.scope.anyOf[0].maxLength,pattern:`^(${scopes.join('|')})$`},{type:'null'}]},
  ttlDays:raw.properties.ttlDays},
  required:[...raw.required],additionalProperties:false},canonical,rebound:null}];
}
/** The formats one canonical document branch admits. @param {any} branch */
function branchFormats(branch){
 const format=branch?.properties?.format;
 if(typeof format?.const==='string')return [format.const];
 if(Array.isArray(format?.enum)&&format.enum.length)return format.enum;
 fail();
}
/** The formats the document application admits for one operation, from its own admission owner.
 * @param {{id:string,version:string}} operation */
function admittedFormats(operation){
 const entry=intentDescriptor(operation);
 const admission=admitDocumentDescriptor({operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements});
 if(!Array.isArray(admission?.formats)||!admission.formats.length)fail();
 return admission.formats;
}
/** The document rows' model-facing branches, one per admitted format of each canonical branch.
 * @param {{id:string,version:string}} operation @param {any} canonical @returns {Declaration[]} */
function documentInput(operation,canonical){
 const admitted=admittedFormats(operation),branches=Array.isArray(canonical?.oneOf)?canonical.oneOf:[canonical],declarations=[];
 for(const branch of branches){
  const properties=branch?.properties;
  if(branch?.type!=='object'||branch.additionalProperties!==false||!properties||!Array.isArray(branch.required))fail();
  for(const format of branchFormats(branch).filter(value=>admitted.includes(value)))
   declarations.push({advertised:{...branch,properties:{...properties,format:{const:format}},required:branch.required.filter(name=>name!=='operation')},
    canonical:branch,rebound:Object.hasOwn(properties,'operation')?'operation':null});
 }
 // The advertised branches of one selection must stay disjoint, or an accepted body could satisfy two canonical
 // branches at once, which the canonical `oneOf` refuses.
 if(!declarations.length||new Set(declarations.map(declaration=>declaration.advertised.properties.format.const)).size!==declarations.length)fail();
 return declarations;
}
/** Owner-lane declarations, by operation: the model-facing branches of that operation's canonical request.
 * @type {Readonly<Record<string,(operation:{id:string,version:string},canonical:any)=>Declaration[]>>} */
const DECLARED=Object.freeze({save_memory:memoryInput,create_word:documentInput,create_excel:documentInput,create_powerpoint:documentInput});
/** @param {{operation:{id:string,version:string}}} row */
function operationOf(row){
 const operation=row?.operation;
 if(typeof operation?.id!=='string'||typeof operation.version!=='string')fail();
 return Object.freeze({id:operation.id,version:operation.version});
}
/** The open record a row advertises while no canonical contract has been proved for it. */
const record=()=>z.record(z.string(),z.unknown());
/** The advertised `arguments` schema of one intent row.
 * @param {{operation:{id:string,version:string}}} row @returns {{operation:{id:string,version:string},mode:'declared'|'canonical'|'record',arguments:z.ZodType}} */
export function intentRowArguments(row){
 const operation=operationOf(row),canonical=canonicalIntentInputSchema(intentDescriptor(operation).inputSchema);
 const declared=DECLARED[operation.id]?.(operation,canonical);
 if(declared){
  const converted=declared.map(branch=>prove(branch.advertised,branch.canonical,branch.rebound));
  return {operation,mode:'declared',arguments:converted.length===1?converted[0]:z.union(/** @type {[z.ZodType,z.ZodType,...z.ZodType[]]} */(converted))};
 }
 try{return {operation,mode:'canonical',arguments:prove(canonical,canonical)};}
 catch{return {operation,mode:'record',arguments:record()};}
}
/** The `arguments` schema of one intent tool over its rows: its rows' advertised schemas, or the open record
 * while any of them still advertises none.
 * @param {readonly {operation:{id:string,version:string}}[]} rows */
export function intentToolArguments(rows){
 const resolved=(Array.isArray(rows)?rows:[]).map(intentRowArguments);
 if(!resolved.length)fail();
 if(resolved.some(row=>row.mode==='record'))return {mode:'record',arguments:record()};
 return {mode:resolved.some(row=>row.mode==='declared')?'declared':'canonical',
  arguments:resolved.length===1?resolved[0].arguments:z.union(/** @type {[z.ZodType,z.ZodType,...z.ZodType[]]} */(resolved.map(row=>row.arguments)))};
}
