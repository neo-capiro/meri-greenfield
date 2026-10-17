/** Read-only allocation probe. Reads the current contract and a doc-only candidate; writes JSON to stdout. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const require=createRequire(pathToFileURL(resolve(root,'apps/worker/conversation/package.json'))),{z}=require('zod');
const read=path=>readFileSync(resolve(root,path));
const bytes=read('packages/contracts/retrieval-0.2/data-search.schema.json'),schema=JSON.parse(bytes);
const catalog=JSON.parse(read('packages/contracts/retrieval-0.2/catalog.json')),descriptor=catalog.operations.find(d=>d.operation.id==='search_capiro_data');
const request=JSON.parse(readFileSync(new URL('./data-search-request-candidate.json',import.meta.url)));
const proposed=structuredClone(schema);proposed.$defs.DataSearchRequest=request;
const {convertCanonicalArguments,isNarrowerOrEqual}=await import(pathToFileURL(resolve(root,'apps/worker/conversation/reads/schema.mjs')));
const {normalizeDataSearchInput}=await import(pathToFileURL(resolve(root,'packages/contracts/retrieval-0.2/validate.mjs')));
function inline(value){
 if(Array.isArray(value))return value.map(inline);if(value===null||typeof value!=='object')return value;
 if(value.$ref){let node=proposed;for(const part of value.$ref.slice(2).split('/'))node=node[part];return inline(node);}
 return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='default').map(([k,v])=>[k,inline(v)]));
}
let oldConversion;try{convertCanonicalArguments(inline(schema.$defs.DataSearchInput));oldConversion='unexpected pass';}catch(error){oldConversion=error.message;}
const converted=convertCanonicalArguments(inline(request)),checks=[];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const check=(name,run)=>{try{run();checks.push({name,pass:true});}catch(error){checks.push({name,pass:false,error:error.message});}};
const good=[
 {query:' x ',domains:['mail']},{query:'',domains:['mail','mail']},
 {query:'x',domains:['mail'],queryClass:null,pageSize:null},{query:'x',domains:['mail'],cursors:{mail:'opaque'}},
 {query:'x',domains:['institutional_knowledge'],memoryItemId:'00000000-0000-0000-0000-000000000001',queryClass:'lookup'},
 {query:'x',domains:['mail'],windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-10-02T00:00:00Z'},
];
for(let i=0;i<good.length;i++)check(`accepted-${i}`,()=>{assert(converted.arguments.safeParse(good[i]).success,'SDK refused valid raw request');normalizeDataSearchInput(good[i]);});
const bad=[
 {query:'x',domains:['unknown']},{query:'x',domains:['mail'],clientId:null},{query:'x',domains:['mail'],memoryItemId:null},
 {query:'x',domains:['mail'],window:null},{query:'x',domains:['mail'],cursors:{unknown:'opaque'}},
 {query:'x',domains:['mail'],cursors:{mail:''}},{query:'x',domains:['mail'],pageSize:'20'},
 {query:'x',domains:['mail'],sql:'SELECT private'},{query:'x',domains:['mail'],pageSize:101},
];
for(let i=0;i<bad.length;i++)check(`refused-${i}`,()=>assert(!converted.arguments.safeParse(bad[i]).success,'SDK widened the raw grammar'));
const cross=[
 {query:'x',domains:['mail'],cursors:{meetings:'opaque'}},
 {query:'x',domains:['mail'],memoryItemId:'00000000-0000-0000-0000-000000000001'},
 {query:'x',domains:['mail'],windowStart:'2026-10-01T00:00:00Z'},
 {query:'x',domains:['mail'],windowStart:'2026-10-02T00:00:00Z',windowEnd:'2026-10-01T00:00:00Z'},
];
for(let i=0;i<cross.length;i++)check(`normalizer-cross-${i}`,()=>{
 assert(converted.arguments.safeParse(cross[i]).success,'SDK unexpectedly enforces an owner relation');let refused=false;
 try{normalizeDataSearchInput(cross[i]);}catch{refused=true;}assert(refused,'normalizer accepted a forbidden relation');
});
const keywordSchemas={
 uniqueItems:{type:'array',items:{type:'string'},uniqueItems:true},
 ifThen:{type:'object',properties:{a:{type:'string'},b:{type:'string'}},additionalProperties:false,allOf:[{if:{required:['a']},then:{required:['b']}}]},
 propertyNames:{type:'object',propertyNames:{enum:['mail','tasks']},additionalProperties:{type:'string'}},
};
const keywordProbes=Object.entries(keywordSchemas).map(([keyword,value])=>{
 const result={keyword};try{const converted=z.fromJSONSchema(value);result.zodConversion='accepted';result.guardProof=isNarrowerOrEqual(z.toJSONSchema(converted,{io:'input'}),value);}catch(error){result.zodConversion=error.message;}
 try{convertCanonicalArguments(value);result.applicationConversion='accepted';}catch(error){result.applicationConversion=error.message;}return result;
});
const sha=value=>createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
 node:process.version,zod:require('zod/package.json').version,schemaSha256:sha(bytes),schemaBytes:bytes.length,
 descriptorInput:descriptor.inputSchema,descriptorOutput:descriptor.outputSchema,newInputId:schema.$id+'#/$defs/DataSearchRequest',
 candidateDefinitionSha256:sha(readFileSync(new URL('./data-search-request-candidate.json',import.meta.url))),
 proposedFullSchemaSha256IfSerializedTwoSpaceLF:sha(JSON.stringify(proposed,null,2)+'\n'),
 proposedFullSchemaHashIsFinalPin:false,oldConversion,newConversion:converted.mode,
 passed:checks.filter(c=>c.pass).length,total:checks.length,checks,keywordProbes,
 rawExample:good[1],normalizedExample:normalizeDataSearchInput(good[1]).input,
 normalizedDefinitionUnchanged:JSON.stringify(schema.$defs.DataSearchInput)===JSON.stringify(proposed.$defs.DataSearchInput),
 normalizedAllOfUnchanged:JSON.stringify(schema.$defs.DataSearchInput.allOf)===JSON.stringify(proposed.$defs.DataSearchInput.allOf),
},null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
