// @ts-check
/** Model-facing input schema for one read (FABLE-GENERAL-READ-TOOLS-20261015 §2.2).
 *
 * The canonical contract input schema is loaded by its id from the exact schema file whose bytes the descriptor
 * hashes (a mismatch is a configuration failure), `$ref`s are inlined and annotation-only `default`s dropped (so the
 * SDK never fills values the model did not supply), then it is converted with zod's `z.fromJSONSchema`. The converted
 * schema is advertised only when its JSON Schema is provably equal to or narrower than the canonical one; otherwise the
 * tool falls back to the `{arguments: record}` envelope `meri_original_reads` uses, with the schema id in its
 * description. Either way the SDK schema is advisory: the gateway re-validates, normalizes and rejects argument-borne
 * authority on every call. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
const fail=()=>{throw Object.assign(Error('READ_SCHEMA_CONFIGURATION'),{code:'READ_SCHEMA_CONFIGURATION'});};
const RETRIEVAL=/^urn:meri:retrieval:([a-z0-9-]+):0\.2\.0$/u;
const ANNOTATIONS=new Set(['$schema','$id','title','description','default','examples','$comment']);
/** @param {string} id */
function document(id){
 const group=RETRIEVAL.exec(id)?.[1];if(!group)fail();
 const bytes=readFileSync(new URL(`../../../../packages/contracts/retrieval-0.2/${group}.schema.json`,import.meta.url));
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
 if(typeof n.$ref==='string'){const [id,fragment='']=n.$ref.split('#');const doc=id?document(id).doc:base;return inline(pointer(doc,fragment),doc,depth+1);}
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
/** Pairwise-disjoint oneOf branches: each requires a property whose `const` differs across branches. @param {any[]} branches */
function discriminated(branches){
 const keys=Object.keys(branches[0]?.properties??{}).filter(k=>branches.every(b=>b.required?.includes(k)&&b.properties?.[k]&&Object.hasOwn(b.properties[k],'const')));
 return keys.some(k=>new Set(branches.map(b=>json(b.properties[k].const))).size===branches.length);
}
/** True only when every value `advertised` accepts is accepted by `canonical`. Conservative: an unrecognised canonical
 * keyword, or any shape it cannot prove, answers false. Extra keywords in `advertised` only add constraints.
 * @param {any} advertised @param {any} canonical @returns {boolean} */
export function isNarrowerOrEqual(advertised,canonical){
 if(!isObject(canonical)||!isObject(advertised))return false;
 for(const [k,c] of Object.entries(canonical)){
  if(ANNOTATIONS.has(k))continue;const a=advertised[k];
  switch(k){
   case 'type':if(json(a)!==json(c))return false;break;
   case 'const':if(!Object.hasOwn(advertised,'const')||json(a)!==json(c))return false;break;
   case 'enum':{const values=Object.hasOwn(advertised,'const')?[advertised.const]:a;if(!Array.isArray(values)||!values.every(v=>c.some((/** @type {unknown} */x)=>json(x)===json(v))))return false;break;}
   case 'minimum':case 'exclusiveMinimum':case 'minLength':case 'minItems':case 'minProperties':if(typeof a!=='number'||a<c)return false;break;
   case 'maximum':case 'exclusiveMaximum':case 'maxLength':case 'maxItems':case 'maxProperties':if(typeof a!=='number'||a>c)return false;break;
   case 'format':case 'pattern':case 'multipleOf':if(a!==c)return false;break;
   case 'required':if(!Array.isArray(a)||!c.every((/** @type {string} */name)=>a.includes(name)))return false;break;
   case 'additionalProperties':if(c===false?a!==false:!(a===false||isNarrowerOrEqual(a,c)))return false;break;
   case 'properties':{if(!isObject(a))return false;
    for(const [name,schema] of Object.entries(a)){if(Object.hasOwn(c,name)){if(!isNarrowerOrEqual(schema,c[name]))return false;}else if(canonical.additionalProperties!==undefined&&canonical.additionalProperties!==true&&!isNarrowerOrEqual(schema,canonical.additionalProperties))return false;}
    for(const name of Object.keys(c))if(!Object.hasOwn(a,name)&&!(Array.isArray(advertised.required)&&!advertised.required.includes(name)&&advertised.additionalProperties===false))return false;
    break;}
   case 'anyOf':if(!Array.isArray(a)||!a.every(branch=>c.some((/** @type {unknown} */x)=>isNarrowerOrEqual(branch,x))))return false;break;
   case 'oneOf':if(!Array.isArray(a)||a.length!==c.length||!discriminated(c)||!discriminated(a)||!a.every((branch,i)=>isNarrowerOrEqual(branch,c[i])))return false;break;
   default:return false;
  }
 }
 return true;
}
/** @typedef {{mode:'canonical'|'envelope',arguments:z.ZodType}} AdvertisedArguments */
/** @param {{id:string,sha256:string}} inputSchema @returns {AdvertisedArguments} */
export function advertisedArguments(inputSchema){
 const canonical=canonicalInputSchema(inputSchema);
 try{
  const converted=z.fromJSONSchema(/** @type {any} */(canonical));
  if(isNarrowerOrEqual(z.toJSONSchema(converted,{io:'input'}),canonical))return {mode:'canonical',arguments:converted};
 }catch{}
 return {mode:'envelope',arguments:z.record(z.string(),z.json())};
}
