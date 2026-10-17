/** Literal sixth-operation wire agreement; no authority, source connection or native server is established. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import canonicalize from 'canonicalize';
import proposal from '../../../../docs/coordination/proposals/native-kb-observation-20261017/golden.json' with {type:'json'};
import {canonicalSha256} from '../../validate.mjs';
import {createNativeReadObservation,assertNativeReadObservation,encodeNativeReadObservation,decodeNativeReadObservation,
 NATIVE_READ_OBSERVATION_OPERATIONS,FUNDING_READ_OPERATIONS,MODE_READ_OPERATIONS} from '../validate.mjs';

const vector=proposal.vectors[0],binding={operation:vector.operation,request:vector.request};
const encoded=value=>Buffer.from(canonicalize(value),'utf8').toString('base64url');
const refuses=work=>assert.throws(work,{message:'NATIVE_READ_OBSERVATION_REFUSED'});
const gitBlob=bytes=>createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');

test('KB literal is the exact independently reviewed PR118 fixture, with both original Unicode scalars intact',()=>{
 const bytes=readFileSync(new URL('../../../../docs/coordination/proposals/native-kb-observation-20261017/golden.json',import.meta.url));
 assert.equal(bytes.length,2018);assert.equal(gitBlob(bytes),'a807a90718c2260f2c980bd04e04cec2d8c9414f');
 assert.match(proposal.status,/candidate only/);assert.equal(proposal.vectors.length,1);
 assert.deepEqual(vector.operation,{id:'search_client_knowledge',version:'0.2.0'});
 assert.equal(vector.request.query,'  Civic & energ\u00eda \u{1f331}  ');
 assert.equal(vector.request.clientId,'A1234567-B123-4C12-8D12-E123456789AB');
});

test('six finite operations preserve the exact original five funding fixture bytes',()=>{
 const bytes=readFileSync(new URL('./golden.json',import.meta.url));
 assert.equal(gitBlob(bytes),'9536c662f4abd3487b6bdb4000ff06a0250f44ae');
 assert.deepEqual(NATIVE_READ_OBSERVATION_OPERATIONS,[...FUNDING_READ_OPERATIONS,'search_client_knowledge',...MODE_READ_OPERATIONS]);
 assert.equal(new Set(NATIVE_READ_OBSERVATION_OPERATIONS).size,11);
});

test('KB canonical request, literal carrier and receiving match in both directions without a new clock',()=>{
 const captured=Date.now;Date.now=()=>{throw Error('Unexpected private-wire clock');};
 try{
  assert.equal(canonicalize(vector.request),vector.requestCanonicalJson);
  assert.equal(canonicalSha256(vector.request),'5a1fe25a9a0a88616f200c7e135c55f689f30b20cf481b7d1e137d06432f8e70');
  const value=createNativeReadObservation({...binding,context:vector.context});
  assert.deepEqual(value,vector.observation);assert.equal(canonicalize(value),vector.canonicalJson);
  assert.equal(Buffer.byteLength(vector.canonicalJson,'utf8'),242);
  assert.equal(createHash('sha256').update(vector.canonicalJson).digest('hex'),'50110f074edd07a79429c8199ae854e5e2a39d4c66fdc40900449a81866c9592');
  assert.equal(encodeNativeReadObservation(value,binding),vector.carrier);
  assert.deepEqual(decodeNativeReadObservation(vector.carrier,binding),value);
  assert.deepEqual(assertNativeReadObservation(vector.observation,binding),value);
  for(const nested of [value,value.operation,value.context])assert.ok(Object.isFrozen(nested));
 }finally{Date.now=captured;}
});

for(const [name,request] of [
 ['trimmed query',{...vector.request,query:vector.request.query.trim()}],
 ['lowercased UUID',{...vector.request,clientId:vector.request.clientId.toLowerCase()}],
 ['omitted kind',Object.fromEntries(Object.entries(vector.request).filter(([key])=>key!=='kind'))],
 ['string limit',{...vector.request,limit:'5'}],
 ['changed limit',{...vector.request,limit:2.5}],
])test(`KB original request refuses ${name} substitution`,()=>{
 assert.notEqual(canonicalSha256(request),vector.requestSha256);
 refuses(()=>decodeNativeReadObservation(vector.carrier,{operation:vector.operation,request}));
});

for(const id of ['query_knowledge_graph','search_sam_opportunities','get_program_element','search_client_knowledge_suffix'])
 test(`${id} cannot inherit the semantic carrier`,()=>{
  const operation={id,version:'0.2.0'},correlation={operation,request:vector.request};
  refuses(()=>createNativeReadObservation({...correlation,context:vector.context}));
  const value={...vector.observation,operation};refuses(()=>assertNativeReadObservation(value,correlation));
  refuses(()=>encodeNativeReadObservation(value,correlation));refuses(()=>decodeNativeReadObservation(encoded(value),correlation));
 });

for(const [name,change] of [
 ['extra context',value=>value.context.tenantId='model'],
 ['graph clock field',value=>value.context.sourceStatusAsOf=value.context.asOf],
 ['noncanonical time',value=>value.context.asOf='2026-10-17T12:34:56.789+00:00'],
 ['new version',value=>value.operation.version='0.3.0'],
 ['extra operation key',value=>value.operation.route='/api/clio/tools/search_client_knowledge'],
 ['wrong body hash',value=>value.requestSha256='0'.repeat(64)],
 ['extra result',value=>value.generatedAt=value.context.asOf],
])test(`KB closed observation rejects ${name}`,()=>{
 const value=structuredClone(vector.observation);change(value);
 refuses(()=>assertNativeReadObservation(value,binding));refuses(()=>encodeNativeReadObservation(value,binding));
 refuses(()=>decodeNativeReadObservation(encoded(value),binding));
});

test('malformed original JSON numbers and Unicode never collide with a canonical KB body',()=>{
 for(const request of [{...vector.request,limit:Infinity},{...vector.request,query:'\ud800'},
  {...vector.request,['\udc00']:'value'}])refuses(()=>createNativeReadObservation({operation:vector.operation,request,context:vector.context}));
});

test('no-client correlation preserves omitted, null and empty selectors as distinct original requests',()=>{
 const requests=[{query:'native no-client note'},{query:'native no-client note',clientId:null},{query:'native no-client note',clientId:''}];
 const hashes=new Set();
 for(const request of requests){
  const correlation={operation:vector.operation,request},value=createNativeReadObservation({...correlation,context:vector.context});
  hashes.add(value.requestSha256);assert.deepEqual(decodeNativeReadObservation(encodeNativeReadObservation(value,correlation),correlation),value);
  for(const other of requests.filter(value=>value!==request))refuses(()=>decodeNativeReadObservation(encodeNativeReadObservation(value,correlation),{operation:vector.operation,request:other}));
 }
 assert.equal(hashes.size,3);
});
