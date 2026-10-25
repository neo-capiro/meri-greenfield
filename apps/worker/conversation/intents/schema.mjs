// @ts-check
/** Model-facing `arguments` schema for one intent tool, derived from the canonical contract the owner validates
 * (the same guarantee `reads/schema.mjs` gives read tools, without a second copy of the proof).
 *
 * Each intent row's canonical descriptor names the exact input schema its owner validates. This module loads that
 * schema document from the canonical contract package, verifies the descriptor's byte pin, inlines `$ref`s,
 * converts it with zod and proves the result accepts nothing the canonical schema rejects; the conversion is
 * advertised as the SDK tool input, so the model is told the fields instead of an opaque schema identity.
 *
 * `clientId` is never argument-borne: the worker always told the model that identity and scope authority come from
 * the trusted run, and the native memory owner refuses any model-supplied `clientId`
 * (`apps/control/memory/command-options.mjs`), so advertising it would invite a call the owner must refuse.
 * Where an owner admits less than its canonical request schema, that owner lane declares the projection here; the
 * declaration is still proved narrower-or-equal to the canonical schema, so a narrower contract can never widen
 * the owner's. A row whose canonical schema cannot be proved keeps the open record rather than advertising a
 * contract that has not been shown to match; `intentToolArguments` reports which rows those are.
 *
 * No authority lives here: the schema is advisory to the model and the owner re-validates every call. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {executionSchemaDependencies,executionSchemaSources} from '../../../../packages/contracts/retrieval-0.2/execution-schema-sources.mjs';
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
  for(const path of [...executionSchemaSources.map(source=>source.path),...executionSchemaDependencies,'../meri.schema.json']){
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
/** Convert an advertised schema and prove it accepts only what the canonical schema accepts. @param {any} advertised @param {any} canonical */
function convert(advertised,canonical){
 let converted;
 try{converted=z.fromJSONSchema(advertised);if(!isNarrowerOrEqual(z.toJSONSchema(converted,{io:'input'}),canonical))fail();}
 catch{fail();}
 return converted;
}
/** The memory owner's model-facing projection of its canonical request.
 *
 * The owner admits a `MemoryProposeRaw` request whose `content` (trimmed) and `key` fit the bounds its own
 * normalized arguments declare, whose `scope` is one of the scopes it normalizes, and which carries no `clientId`;
 * `ttlDays` is clamped rather than refused, so the canonical request bound stays accurate. `content` is the one
 * field a caller must supply: everything else is derived from the trusted run when it is absent.
 * @param {any} canonical @returns {any} */
function memoryInput(canonical){
 if(canonical?.type!=='object'||canonical.additionalProperties!==false)fail();
 const memory=documentFor(MEMORY_DOCUMENT).doc;
 const raw=pointer(memory,'/$defs/MemoryProposeRaw'),normalized=pointer(memory,'/$defs/MemoryProposeArguments');
 const scopes=normalized.properties.scope.enum;
 if(!Array.isArray(scopes)||!scopes.length||!scopes.every(scope=>/^[a-z_]+$/u.test(scope))||!Array.isArray(raw.required))fail();
 return {type:'object',properties:{
  content:normalized.properties.content,
  key:normalized.properties.key,
  scope:{anyOf:[{type:'string',maxLength:raw.properties.scope.anyOf[0].maxLength,pattern:`^(${scopes.join('|')})$`},{type:'null'}]},
  ttlDays:raw.properties.ttlDays},
  required:[...raw.required],additionalProperties:false};
}
/** Owner-lane declarations, by operation: the model-facing projection of that operation's canonical request.
 * @type {Readonly<Record<string,(canonical:any)=>any>>} */
const DECLARED=Object.freeze({save_memory:memoryInput});
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
 const operation=operationOf(row),descriptor=intentDescriptor(operation),canonical=canonicalIntentInputSchema(descriptor.inputSchema);
 const declared=DECLARED[operation.id]?.(canonical);
 if(declared)return {operation,mode:'declared',arguments:convert(declared,canonical)};
 try{return {operation,mode:'canonical',arguments:convert(canonical,canonical)};}
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
