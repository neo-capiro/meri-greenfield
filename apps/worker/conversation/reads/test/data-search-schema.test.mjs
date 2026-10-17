/** Actual catalog, canonical normalizer and exact installed SDK schema conversion; no source or model calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments,canonicalInputSchema} from '../schema.mjs';
const require=createRequire(import.meta.url),contract=resolveOperationContract({id:'search_capiro_data',version:'0.2.0'});
const schema=()=>advertisedArguments(contract.descriptor.inputSchema).arguments;
const uuid='00000000-0000-0000-0000-000000000001';

test('data-search advertises the raw definition with the actual whole-file hash and exact installed Zod',()=>{
 assert.equal(require('zod/package.json').version,'4.6.7');
 const bytes=readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/data-search.schema.json',import.meta.url)),sha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(contract.binding.input,'DataSearchRequest');assert.equal(contract.binding.output,'SearchCapiroDataResult');
 assert.equal(contract.descriptor.inputSchema.id,'urn:meri:retrieval:data-search:0.2.0#/$defs/DataSearchRequest');
 assert.equal(contract.descriptor.inputSchema.sha256,sha256);assert.equal(contract.descriptor.outputSchema.sha256,sha256);
 assert.equal(contract.descriptor.outputSchema.id,'urn:meri:retrieval:data-search:0.2.0#/$defs/SearchCapiroDataResult');
 const canonical=canonicalInputSchema(contract.descriptor.inputSchema);
 assert.deepEqual(canonical.required,['query','domains']);assert.equal(Object.hasOwn(canonical.properties,'window'),false);
 assert.equal(Object.hasOwn(canonical.properties.cursors,'propertyNames'),false);assert.equal(JSON.stringify(canonical).includes('"$ref"'),false);
 assert.equal(advertisedArguments(contract.descriptor.inputSchema).mode,'canonical');
});
test('SDK preserves original raw arguments and null defaults without filling normalized fields',()=>{
 for(const request of [{query:'  q  ',domains:['mail','mail']},{query:'',domains:['mail'],queryClass:null,pageSize:null}]){
  const saved=structuredClone(request),advertised=schema().parse(request);assert.deepEqual(advertised,saved);assert.deepEqual(request,saved);
  const normalized=contract.normalizeInput(advertised,{});assert.equal(normalized.input.query,request.query.trim());assert.deepEqual(normalized.input.domains,['mail']);
  assert.equal(normalized.input.queryClass,'lookup');assert.equal(normalized.input.pageSize,50);assert.equal(normalized.input.clientId,null);assert.equal(normalized.input.memoryItemId,null);
  assert.deepEqual(normalized.input.cursors,{});assert.equal(normalized.input.window,null);assert.equal(normalized.argumentsSha256,canonicalSha256(normalized.input));
  assert.equal(Object.hasOwn(advertised,'window'),false);assert.equal(Object.hasOwn(advertised,'clientId'),false);
 }
});
test('SDK admits every finite domain cursor and preserves a valid original window and exact memory selector',()=>{
 const domainNames=Object.keys(canonicalInputSchema(contract.descriptor.inputSchema).properties.cursors.properties);assert.equal(domainNames.length,18);
 for(const domain of domainNames){const request={query:'q',domains:[domain],cursors:{[domain]:'opaque'}};assert.deepEqual(schema().parse(request),request);contract.normalizeInput(request,{});}
 const request={query:'q',domains:['institutional_knowledge','institutional_knowledge'],queryClass:'lookup',memoryItemId:uuid,clientId:uuid,
  windowStart:'2026-01-01T00:00:00Z',windowEnd:'2026-01-02T00:00:00+00:00'};
 assert.deepEqual(schema().parse(request),request);const normalized=contract.normalizeInput(request,{});assert.equal(normalized.input.memoryItemId,uuid);
 assert.deepEqual(normalized.input.window,{startInclusive:request.windowStart,endExclusive:request.windowEnd});
});
test('SDK refuses authority, normalized-only fields, null selectors, unknown cursors and invalid raw scalars',()=>{
 const minimal={query:'q',domains:['mail']};
 for(const extra of [{tenantId:'other'},{actorRole:'admin'},{normalizationContext:{}},{window:null},{clientId:null},{memoryItemId:null},{pageSize:'50'},
  {pageSize:0},{pageSize:101},{pageSize:1.5},{queryClass:'portfolio_scan'},{cursors:{unknown:'opaque'}},{cursors:{mail:''}},{cursors:{mail:'x'.repeat(8193)}},{windowStart:'2026-01-01'}]){
  assert.equal(schema().safeParse({...minimal,...extra}).success,false,JSON.stringify(extra));
 }
 const normalized=contract.normalizeInput(minimal,{}).input;assert.equal(schema().safeParse(normalized).success,false);
 assert.equal(schema().safeParse({domains:['mail']}).success,false);assert.equal(schema().safeParse({query:'q'}).success,false);
});
test('SDK raw duplicate and string bounds preserve the authoritative normalizer checks',()=>{
 const request={query:'x'.repeat(4000),domains:Array(18).fill('mail'),pageSize:100};assert.deepEqual(schema().parse(request),request);
 assert.equal(contract.normalizeInput(request,{}).input.domains.length,1);
 for(const invalid of [{...request,query:'x'.repeat(4001)},{...request,domains:Array(19).fill('mail')},{...request,domains:[]}])assert.equal(schema().safeParse(invalid).success,false);
});
test('structural SDK acceptance leaves memory, requested-cursor and ordered-window decisions with the normalizer',()=>{
 for(const request of [{query:'q',domains:['mail'],cursors:{tasks:'opaque'}},{query:'q',domains:['mail'],memoryItemId:uuid},
  {query:'q',domains:['institutional_knowledge'],queryClass:'comparison',memoryItemId:uuid},
  {query:'q',domains:['mail'],windowStart:'2026-01-01T00:00:00Z'},
  {query:'q',domains:['mail'],windowStart:'2026-02-01T00:00:00Z',windowEnd:'2026-01-01T00:00:00Z'}]){
  const advertised=schema().parse(request);validateShape('DataSearchRequest',advertised);assert.throws(()=>contract.normalizeInput(advertised,{}));
 }
});
