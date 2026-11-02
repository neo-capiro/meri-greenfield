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
 * is proved the same way, so a declaration can narrow the owner's contract but never widen it. Three such projections
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
 * - `watch_action`: the canonical `WatchInput` couples its fields with `if/then` conditionals (the operations and target
 *   kinds each family admits, and the delivery flag only with `set_delivery`), which the conversion cannot express, so
 *   the row used to advertise an open record and the model guessed the fields. The watch owner's own tables
 *   (`WATCH_SUPPORTED`, `WATCH_TARGET_KINDS`) select the branches: one per family and operation group, each the
 *   canonical request with its conditionals resolved for that selection, so every branch is contained in the canonical
 *   request and the tables are proved against the canonical conditionals in the same step.
 *
 * A row whose canonical schema cannot be proved keeps the open record rather than advertising a contract that has
 * not been shown to match; `intentToolArguments` reports which rows those are.
 *
 * No authority lives here: the schema is advisory to the model and the owner re-validates every call. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {executionSchemaDependencies,executionSchemaSources} from '../../../../packages/contracts/retrieval-0.2/execution-schema-sources.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {WORK_SELECTION_SCHEMA_ID,workSelectionSchema} from '../../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {admitDocumentDescriptor} from '../../../control/document-application/format-admission.mjs';
import {WATCH_SUPPORTED,WATCH_TARGET_KINDS} from '../../../../packages/contracts/retrieval-0.2/watch-action-validation.mjs';
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
  for(const path of ['research-portfolio-sharing.schema.json','research-portfolio-action.schema.json','watch-action.schema.json','office-edit-action.schema.json','legislative-document-action.schema.json','bizdev-action.schema.json','client-record-action.schema.json','legiwatch-relevance.schema.json','legiwatch-action.schema.json','note-action.schema.json',...executionSchemaSources.map(source=>source.path),...executionSchemaDependencies,'../meri.schema.json']){
   const bytes=readFileSync(new URL(path,CONTRACTS)),doc=JSON.parse(bytes.toString('utf8'));
   if(typeof doc.$id!=='string'||documents.has(doc.$id))fail();
   documents.set(doc.$id,{doc,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  // The canonical Work selection owner is provided by its own module (`packages/contracts/work-selection.mjs`), not by
  // a schema file, and the 0.3 schedule request resolves its `work` definition through it. It is registered here by
  // reference to that owner — the same owner the canonical validator mounts — never as a second copy of the shape.
  const work=workSelectionSchema();
  documents.set(WORK_SELECTION_SCHEMA_ID,{doc:work,sha256:canonicalSha256(work)});
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
/** One property narrowed by a conditional's consequent. An `enum` restricts a base `enum` to values it already admits, or
 * replaces a free-text base (bounds and pattern) with fixed values that each satisfy it, since the conversion keeps an
 * enum and drops the bounds; a bare `type` selects that branch of a base `anyOf`. @param {any} base @param {any} sub */
function narrowProperty(base,sub){
 if(!base||typeof sub!=='object'||sub===null||Object.keys(sub).length!==1)fail();
 if(Array.isArray(sub.enum)&&sub.enum.length&&sub.enum.every(value=>typeof value==='string')){
  if(Array.isArray(base.enum)){if(!sub.enum.every(value=>base.enum.includes(value)))fail();return {...base,enum:[...sub.enum]};}
  const fits=value=>value.length>=(base.minLength??0)&&value.length<=(base.maxLength??Infinity)&&(base.pattern===undefined||new RegExp(base.pattern,'u').test(value));
  if(base.type!=='string'||Object.keys(base).some(key=>!['type','minLength','maxLength','pattern'].includes(key))||!sub.enum.every(fits))fail();
  return {type:'string',enum:[...sub.enum]};
 }
 if(typeof sub.type==='string'&&Array.isArray(base.anyOf)&&Object.keys(base).length===1){const chosen=base.anyOf.find(branch=>branch?.type===sub.type&&Object.keys(branch).length===1);if(!chosen)fail();return chosen;}
 fail();
}
/** A canonical object request whose `allOf` is a list of `if/then(/else)` conditionals on constant properties, restricted to
 * one `selection` (the values each tested property may take) with the conditionals folded into `properties`: the result
 * has no conditional left and is exactly the canonical request on that selection, so it is contained in the canonical
 * request. A selection a conditional cannot decide (some of its values satisfy the test, others not) is refused.
 * @param {any} canonical @param {Record<string,readonly string[]>} selection */
function resolveConditionals(canonical,selection){
 if(canonical?.type!=='object'||canonical.additionalProperties!==false||!Array.isArray(canonical.allOf)||!canonical.allOf.length||!canonical.properties)fail();
 const {allOf,...branch}=canonical,properties={...branch.properties};
 for(const conditional of allOf){
  const {if:when,then,else:otherwise,...rest}=conditional,tests=Object.entries(when?.properties??{});
  if(Object.keys(rest).length||Object.keys(when??{}).length!==1||!tests.length||!then)fail();
  const holds=tests.map(([name,test])=>{
   if(Object.keys(test).length!==1||typeof test.const!=='string'||!Array.isArray(selection[name])||!selection[name].length)fail();
   const hits=selection[name].filter(value=>value===test.const).length;if(hits&&hits!==selection[name].length)fail();return hits>0;
  }).every(Boolean);
  for(const [name,sub] of Object.entries((holds?then:otherwise)?.properties??{}))properties[name]=narrowProperty(properties[name],sub);
 }
 for(const [name,values] of Object.entries(selection))properties[name]=narrowProperty(properties[name],{enum:values});
 return {...branch,properties};
}
/** The watch owner's model-facing branches: the canonical `WatchInput` resolved per family and per operation group of the
 * owner's own tables. An operation the canonical request conditions on by itself (`set_delivery`, which couples the
 * delivery flag) is its own group; the others of a family share one. Each branch's target kinds must be exactly the
 * owner's table for that family, so a table that drifts from the canonical conditionals fails here, never silently.
 * @param {any} _operation @param {any} canonical @returns {Declaration[]} */
function watchInput(_operation,canonical){
 if(!Array.isArray(canonical?.allOf))fail();
 const conditioned=new Set(canonical.allOf.flatMap(c=>typeof c?.if?.properties?.operation?.const==='string'?[c.if.properties.operation.const]:[]));
 const declarations=[];
 for(const [family,operations] of Object.entries(WATCH_SUPPORTED)){
  const groups=[operations.filter(o=>!conditioned.has(o)),...operations.filter(o=>conditioned.has(o)).map(o=>[o])].filter(group=>group.length);
  for(const group of groups){
   const resolved=resolveConditionals(canonical,{family:[family],operation:group});
   if(canonicalSha256(resolved.properties.targetKind?.enum)!==canonicalSha256(WATCH_TARGET_KINDS[family]))fail();
   declarations.push({advertised:resolved,canonical:resolved,rebound:null});
  }
 }
 if(!declarations.length)fail();
 return declarations;
}
/** Owner-lane declarations, by operation: the model-facing branches of that operation's canonical request.
 * @type {Readonly<Record<string,(operation:{id:string,version:string},canonical:any)=>Declaration[]>>} */
const DECLARED=Object.freeze({save_memory:memoryInput,create_word:documentInput,create_excel:documentInput,create_powerpoint:documentInput,watch_action:watchInput});
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
