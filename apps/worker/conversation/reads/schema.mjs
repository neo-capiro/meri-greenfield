// @ts-check
/** Model-facing input schema for one read (FABLE-GENERAL-READ-TOOLS-20261015 §2.2).
 *
 * The canonical contract input schema is loaded by its id from the exact schema file whose bytes the descriptor
 * hashes (a mismatch is a configuration failure), `$ref`s are inlined and annotation-only `default`s dropped (so the
 * SDK never fills values the model did not supply), then it is converted with zod's `z.fromJSONSchema`. The converted
 * schema is advertised only when its JSON Schema is provably equal to or narrower than the canonical one; otherwise
 * construction fails closed. The SDK schema is advisory: the gateway re-validates, normalizes and rejects argument-borne
 * authority on every call. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const fail=()=>{throw Object.assign(Error('READ_SCHEMA_CONFIGURATION'),{code:'READ_SCHEMA_CONFIGURATION'});};
const RETRIEVAL=/^urn:meri:retrieval:([a-z0-9-]+):0\.2\.0$/u;
const ANNOTATIONS=new Set(['$schema','$id','title','description','default','examples','$comment']);
/** @param {string} id */
function document(id){
 const group=RETRIEVAL.exec(id)?.[1];if(!group)fail();
 const descriptor=catalog.operations.find(d=>d.inputSchema.id.split('#')[0]===id);
 const file=descriptor?resolveOperationContract(descriptor.operation).binding?.group:group;if(typeof file!=='string')fail();
 const bytes=readFileSync(new URL(`../../../../packages/contracts/retrieval-0.2/${file}.schema.json`,import.meta.url));
 const doc=JSON.parse(bytes.toString('utf8'));if(doc.$id!==id)fail();
 return {doc,sha256:createHash('sha256').update(bytes).digest('hex')};
}
/** @param {any} doc @param {string} fragment */
function pointer(doc,fragment){
 let node=doc;for(const part of fragment.replace(/^\//u,'').split('/').filter(Boolean)){const k=part.replaceAll('~1','/').replaceAll('~0','~');if(node===null||typeof node!=='object'||!Object.hasOwn(node,k))fail();node=node[k];}
 return node;
}
/** @param {unknown} node @param {any} base @param {number} depth @returns {unknown} */
function inline(node,base,depth){
 if(depth>64)fail();
 if(Array.isArray(node))return node.map(n=>inline(n,base,depth+1));
 if(node===null||typeof node!=='object')return node;
 const n=/** @type {Record<string,unknown>} */(node);
 if(typeof n.$ref==='string'){
  const [id,fragment='']=n.$ref.split('#'),doc=id?document(id).doc:base;
  const resolved=inline(pointer(doc,fragment),doc,depth+1),siblings=Object.fromEntries(Object.entries(n).filter(([k])=>k!=='$ref'));
  return Object.keys(siblings).length?{allOf:[resolved,inline(siblings,base,depth+1)]}:resolved;
 }
 return Object.fromEntries(Object.entries(n).filter(([k])=>k!=='default').map(([k,v])=>[k,inline(v,base,depth+1)]));
}
/** The canonical input schema with refs inlined, verified against the descriptor hash.
 * @param {{id:string,sha256:string}} inputSchema @returns {Record<string,unknown>} */
export function canonicalInputSchema(inputSchema){
 const [id='',fragment='']=inputSchema.id.split('#');if(!id||!fragment)fail();
 const {doc,sha256}=document(id);if(sha256!==inputSchema.sha256)fail();
 return /** @type {Record<string,unknown>} */(inline(pointer(doc,fragment),doc,0));
}
const isObject=(/** @type {unknown} */v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const json=(/** @type {unknown} */v)=>JSON.stringify(v);
/** A union with no other constraints can be compared branch by branch. @param {any} schema */
const unionOnly=schema=>Array.isArray(schema.anyOf)&&Object.keys(schema).every(k=>k==='anyOf'||ANNOTATIONS.has(k));
/** JSON Schema type-specific constraints are inert on other primitive types. @param {string} key @param {any} schema */
function inapplicable(key,schema){
 if(typeof schema.type!=='string')return false;
 if(['minLength','maxLength','pattern','format'].includes(key))return schema.type!=='string';
 if(['minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf'].includes(key))return !['integer','number'].includes(schema.type);
 return false;
}
/** Pairwise-disjoint oneOf branches: each requires a property whose `const` differs across branches. @param {any[]} branches */
function discriminated(branches){
 const keys=Object.keys(branches[0]?.properties??{}).filter(k=>branches.every(b=>b.required?.includes(k)&&b.properties?.[k]&&Object.hasOwn(b.properties[k],'const')));
 return keys.some(k=>new Set(branches.map(b=>json(b.properties[k].const))).size===branches.length);
}
/** True only when every value `advertised` accepts is accepted by `canonical`. Conservative: an unrecognised canonical
 * keyword, or any shape it cannot prove, answers false. Extra keywords in `advertised` only add constraints.
 * @param {any} advertised @param {any} canonical @returns {boolean} */
export function isNarrowerOrEqual(advertised,canonical){
 if(canonical===true||advertised===false)return true;
 if(canonical===false)return advertised===false;
 if(!isObject(canonical)||!isObject(advertised))return false;
 if(Array.isArray(advertised.type))return advertised.type.every((/** @type {unknown} */type)=>isNarrowerOrEqual({...advertised,type},canonical));
 if(unionOnly(advertised))return advertised.anyOf.every((/** @type {any} */branch)=>isNarrowerOrEqual(branch,canonical));
 if(Array.isArray(canonical.type))return canonical.type.some((/** @type {unknown} */type)=>isNarrowerOrEqual(advertised,{...canonical,type}));
 if(unionOnly(canonical))return canonical.anyOf.some((/** @type {any} */branch)=>isNarrowerOrEqual(advertised,branch));
 for(const [k,c] of Object.entries(canonical)){
  if(ANNOTATIONS.has(k)||inapplicable(k,canonical))continue;const a=advertised[k];
  switch(k){
   case 'type':if(a!==c&&!(c==='number'&&a==='integer'))return false;break;
   case 'const':if(!Object.hasOwn(advertised,'const')||json(a)!==json(c))return false;break;
   case 'enum':{const values=Object.hasOwn(advertised,'const')?[advertised.const]:a;if(!Array.isArray(values)||!values.every(v=>c.some((/** @type {unknown} */x)=>json(x)===json(v))))return false;break;}
   case 'minimum':case 'exclusiveMinimum':case 'minLength':case 'minItems':case 'minProperties':if(typeof a!=='number'||a<c)return false;break;
   case 'maximum':case 'exclusiveMaximum':case 'maxLength':case 'maxItems':case 'maxProperties':if(typeof a!=='number'||a>c)return false;break;
   case 'format':case 'pattern':case 'multipleOf':if(a!==c)return false;break;
   case 'required':if(c.length&&(!Array.isArray(a)||!c.every((/** @type {string} */name)=>a.includes(name))))return false;break;
   case 'additionalProperties':if(c===false?a!==false:!(a===false||isNarrowerOrEqual(a,c)))return false;break;
   case 'properties':{if(!isObject(a))return false;
    for(const [name,schema] of Object.entries(a)){if(Object.hasOwn(c,name)){if(!isNarrowerOrEqual(schema,c[name]))return false;}else if(canonical.additionalProperties!==undefined&&canonical.additionalProperties!==true&&!isNarrowerOrEqual(schema,canonical.additionalProperties))return false;}
    for(const name of Object.keys(c))if(!Object.hasOwn(a,name)&&!(Array.isArray(advertised.required)&&!advertised.required.includes(name)&&advertised.additionalProperties===false))return false;
    break;}
   case 'anyOf':if(!Array.isArray(a)||!a.every(branch=>c.some((/** @type {unknown} */x)=>isNarrowerOrEqual(branch,x))))return false;break;
   case 'items':if(!isNarrowerOrEqual(a,c))return false;break;
   case 'uniqueItems':if(c===true&&a!==true)return false;break;
   case 'allOf':if(!Array.isArray(a)||a.length!==c.length||!a.every((branch,i)=>isNarrowerOrEqual(branch,c[i])))return false;break;
   case 'oneOf':if(!Array.isArray(a)||a.length!==c.length||!discriminated(c)||!discriminated(a)||!a.every((branch,i)=>isNarrowerOrEqual(branch,c[i])))return false;break;
   default:return false;
  }
 }
 return true;
}
/** @typedef {{mode:'canonical',arguments:z.ZodType}} AdvertisedArguments */
/** @param {{id:string,sha256:string}} inputSchema @returns {AdvertisedArguments} */
export function advertisedArguments(inputSchema){
 return convertCanonicalArguments(canonicalInputSchema(inputSchema));
}
/** A conversion that widens or loses a constraint is a configuration failure. @param {Record<string,unknown>} canonical @returns {AdvertisedArguments} */
export function convertCanonicalArguments(canonical){
 try{
  const converted=z.fromJSONSchema(/** @type {any} */(canonical));
  if(isNarrowerOrEqual(z.toJSONSchema(converted,{io:'input'}),canonical))return {mode:'canonical',arguments:converted};
 }catch{}
 return fail();
}
