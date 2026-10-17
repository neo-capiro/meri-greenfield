/** Finite mode wire agreement, not native authority or live producer qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import proposal from '../../../../docs/coordination/proposals/native-read-mode-20261017/golden.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../validate.mjs';
import {createNativeReadObservation,assertNativeReadObservation,encodeNativeReadObservation,decodeNativeReadObservation,MODE_READ_OPERATIONS} from '../validate.mjs';

const binding=v=>({operation:v.operation,request:v.request});
const encoded=v=>Buffer.from(canonicalize(v),'utf8').toString('base64url');
const refused=run=>assert.throws(run,{message:'NATIVE_READ_OBSERVATION_REFUSED'});
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
test('mode literal contains only the exact five native operations and preserves previous golden blobs',()=>{
 const raw=readFileSync(new URL('../../../../docs/coordination/proposals/native-read-mode-20261017/golden.json',import.meta.url));
 assert.equal(raw.length,8295);assert.equal(gitBlob(raw),'b056a4aa0efd0384c1cd90cc810d9def181d6818');
 assert.deepEqual(proposal.vectors.map(v=>v.operation.id),MODE_READ_OPERATIONS);assert.ok(Object.isFrozen(MODE_READ_OPERATIONS));
 assert.equal(gitBlob(readFileSync(new URL('./golden.json',import.meta.url))),'9536c662f4abd3487b6bdb4000ff06a0250f44ae');
 assert.equal(gitBlob(readFileSync(new URL('../../../../docs/coordination/proposals/native-kb-observation-20261017/golden.json',import.meta.url))),'a807a90718c2260f2c980bd04e04cec2d8c9414f');
});
for(const v of proposal.vectors){
 test(`${v.operation.id}: literal original body, canonical bytes, hash and carrier agree`,()=>{
  const b=binding(v),value=createNativeReadObservation({...b,context:v.context});
  assert.equal(canonicalize(v.request),v.requestCanonicalJson);assert.equal(hash(v.request),v.requestSha256);
  assert.deepEqual(value,v.observation);assert.equal(canonicalize(value),v.canonicalJson);
  assert.equal(Buffer.byteLength(v.canonicalJson,'utf8'),v.decodedBytes);assert.equal(createHash('sha256').update(v.canonicalJson).digest('hex'),v.observationSha256);
  assert.equal(encodeNativeReadObservation(value,b),v.carrier);assert.deepEqual(decodeNativeReadObservation(v.carrier,b),value);
  for(const nested of [value,value.operation,value.context])assert.ok(Object.isFrozen(nested));
 });
 for(const evidenceAccuracyMode of ['off','shadow','enforce'])test(`${v.operation.id}: exact ${evidenceAccuracyMode} is explicit and needs no clock`,()=>{
  const captured=Date.now;Date.now=()=>{throw Error('Unexpected mode wire clock');};
  try{const b=binding(v),value=createNativeReadObservation({...b,context:{evidenceAccuracyMode}});assert.deepEqual(decodeNativeReadObservation(encodeNativeReadObservation(value,b),b).context,{evidenceAccuracyMode});}finally{Date.now=captured;}
 });
 for(const context of [{},{evidenceAccuracyMode:'auto'},{evidenceAccuracyMode:false},{asOf:'2026-10-17T00:00:00.000Z'},{...v.context,asOf:'2026-10-17T00:00:00.000Z'},{...v.context,tenantId:'injected'}])
  test(`${v.operation.id}: refuses non-mode or expanded context ${JSON.stringify(context)}`,()=>{
   const b=binding(v);refused(()=>createNativeReadObservation({...b,context}));refused(()=>assertNativeReadObservation({...v.observation,context},b));refused(()=>decodeNativeReadObservation(encoded({...v.observation,context}),b));
  });
 test(`${v.operation.id}: original body cannot be normalized or replaced`,()=>{
  const b=binding(v),request=Object.fromEntries(Object.entries(v.request).map(([k,value])=>[k,typeof value==='string'?value.trim():value]));
  assert.notEqual(hash(request),v.requestSha256);refused(()=>decodeNativeReadObservation(v.carrier,{...b,request}));
  refused(()=>decodeNativeReadObservation(v.carrier,{...b,request:{...v.request,clientId:'injected'}}));
  refused(()=>decodeNativeReadObservation(v.carrier,{...b,operation:{...v.operation,version:'0.1.0'}}));
 });
}
for(const id of ['search_sam_opportunities','get_state_rule_status','get_certification_status','get_legal_reference','query_economic_data','search_client_knowledge','search_funding_opportunities','search_federal_grants_suffix'])
 test(`${id}: cannot inherit a mode context`,()=>{
  const operation={id,version:'0.2.0'},request={},context={evidenceAccuracyMode:'off'};refused(()=>createNativeReadObservation({operation,request,context}));
 });
