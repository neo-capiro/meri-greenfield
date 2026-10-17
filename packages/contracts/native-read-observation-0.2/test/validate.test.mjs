/** Literal wire agreement vectors and bounded hostile-carrier checks; no installed Core claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import schema from '../schema.json' with {type:'json'};
import golden from './golden.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../validate.mjs';
import {FUNDING_OPPORTUNITY_OPERATION_IDS} from '../../retrieval-0.2/funding-opportunities-validation.mjs';
import {fundingInstant} from '../../retrieval-0.2/funding-envelope-validation.mjs';
import {NATIVE_READ_OBSERVATION_SCHEMA_VERSION,NATIVE_READ_OBSERVATION_HEADER,NATIVE_READ_OBSERVATION_MAX_BYTES,FUNDING_READ_OPERATIONS,NATIVE_READ_OBSERVATION_OPERATIONS,MODE_READ_OPERATIONS,
 createNativeReadObservation,assertNativeReadObservation,encodeNativeReadObservation,decodeNativeReadObservation} from '../validate.mjs';

const first=golden.vectors[0],correlation=({operation,request})=>({operation,request}),proof=correlation(first);
const carrier=json=>Buffer.from(json,'utf8').toString('base64url');
const refused=run=>assert.throws(run,{message:'NATIVE_READ_OBSERVATION_REFUSED'});

test('the private schema is finite, closed and preserves the existing five funding reads plus semantic KB',()=>{
 assert.equal(schema.$id,'urn:meri:native-read-observation:0.2.0');assert.equal(NATIVE_READ_OBSERVATION_SCHEMA_VERSION,'meri-native-read-observation/1');
 assert.equal(NATIVE_READ_OBSERVATION_HEADER,'x-meri-read-observation');assert.equal(NATIVE_READ_OBSERVATION_MAX_BYTES,2048);
 assert.deepEqual(FUNDING_READ_OPERATIONS,FUNDING_OPPORTUNITY_OPERATION_IDS);assert.ok(Object.isFrozen(FUNDING_READ_OPERATIONS));
 assert.deepEqual(NATIVE_READ_OBSERVATION_OPERATIONS,[...FUNDING_READ_OPERATIONS,'search_client_knowledge',...MODE_READ_OPERATIONS]);assert.ok(Object.isFrozen(NATIVE_READ_OBSERVATION_OPERATIONS));
 assert.deepEqual(schema.$defs.NativeReadOperationRef.properties.id.enum,NATIVE_READ_OBSERVATION_OPERATIONS);
 assert.equal(schema.$defs.NativeReadObservation.additionalProperties,false);assert.equal(schema.$defs.NativeReadContext.additionalProperties,false);
 assert.equal(golden.vectors.length,5);assert.deepEqual(golden.vectors.map(v=>v.operation.id),FUNDING_READ_OPERATIONS);
});

for(const vector of golden.vectors)test(`${vector.operation.id}: literal canonical bytes/hash/header agree in both directions`,()=>{
 const bound=correlation(vector),value=createNativeReadObservation({...bound,context:vector.context});
 assert.deepEqual(value,vector.observation);assert.equal(value.requestSha256,vector.requestSha256);
 assert.equal(canonicalize(vector.request),vector.requestCanonicalJson);assert.equal(hash(vector.request),vector.requestSha256);
 assert.equal(canonicalize(value),vector.canonicalJson);assert.equal(Buffer.byteLength(vector.canonicalJson,'utf8'),vector.decodedBytes);
 assert.equal(createHash('sha256').update(vector.canonicalJson,'utf8').digest('hex'),vector.observationSha256);
 assert.equal(encodeNativeReadObservation(value,bound),vector.carrier);assert.equal(carrier(vector.canonicalJson),vector.carrier);
 assert.deepEqual(decodeNativeReadObservation(vector.carrier,bound),value);assert.deepEqual(assertNativeReadObservation(value,bound),value);
 assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.operation));assert.ok(Object.isFrozen(value.context));
 assert.ok(Object.isFrozen(decodeNativeReadObservation(vector.carrier,bound).context));
});

test('original whitespace/unicode and omitted defaults are hashed before any funding normalization',()=>{
 assert.match(first.request.query,/energía 🌱/u);
 for(const request of [{...first.request,query:first.request.query.trim()},{...first.request,page:1},{...first.request,activeState:'active'}]){
  assert.notEqual(hash(request),first.requestSha256);refused(()=>decodeNativeReadObservation(first.carrier,{operation:first.operation,request}));
 }
 const reordered=Object.fromEntries(Object.entries(first.request).reverse());
 assert.deepEqual(decodeNativeReadObservation(first.carrier,{operation:first.operation,request:reordered}),first.observation);
 assert.deepEqual(first.request,{query:' Civic & energía 🌱 ',clientId:'a1234567-b123-4c12-8d12-e123456789ab',pageSize:5});
});

test('creating and asserting snapshot the input without capturing a clock or mutating caller data',()=>{
 const input=structuredClone({...proof,context:first.context}),copy=structuredClone(input),out=createNativeReadObservation(input);
 input.context.asOf='2026-10-18T12:34:56.789Z';input.request.query='changed';input.operation.id='changed';
 assert.deepEqual(out,first.observation);assert.deepEqual(copy,{...proof,context:first.context});
});

for(const asOf of ['1970-01-01T00:00:00.000Z','2024-02-29T23:59:59.999Z','+010000-01-01T00:00:00.000Z','-000001-01-01T00:00:00.000Z'])test(`canonical funding instant ${asOf} is retained exactly`,()=>{
 assert.ok(Number.isFinite(fundingInstant(asOf)));const observation=createNativeReadObservation({...proof,context:{asOf}});
 assert.equal(decodeNativeReadObservation(encodeNativeReadObservation(observation,proof),proof).context.asOf,asOf);
});
for(const asOf of ['2026-10-17','2026-10-17T12:34:56Z','2026-10-17T12:34:56.78Z','2026-10-17T12:34:56.789+00:00',
 '2026-02-30T12:34:56.789Z','2026-10-17T24:00:00.000Z','not-a-date',0,null])test(`noncanonical funding instant ${String(asOf)} refuses`,()=>{
 refused(()=>createNativeReadObservation({...proof,context:{asOf}}));
});

for(const [label,mutate] of [
 ['wrong wire version',v=>v.schemaVersion='meri-native-read-observation/2'],['extra root',v=>v.principal={}],
 ['missing context',v=>delete v.context],['empty context',v=>v.context={}],['mode context',v=>v.context.evidenceAccuracyMode='off'],
 ['SAM clocks',v=>v.context.sourceStatusAsOf=v.context.asOf],['extra operation',v=>v.operation.route='/api/clio/tools/other'],
 ['operation version',v=>v.operation.version='0.1.0'],['unsupported SAM operation',v=>v.operation.id='search_sam_opportunities'],
 ['unsupported PE operation',v=>v.operation.id='get_program_element'],['operation suffix',v=>v.operation.id+='suffix'],
 ['different funding route',v=>v.operation.id=FUNDING_READ_OPERATIONS[1]],['different body hash',v=>v.requestSha256='0'.repeat(64)],
 ['uppercase body hash',v=>v.requestSha256=v.requestSha256.toUpperCase()],['extra body',v=>v.request=first.request],
])test(`${label} refuses across assert, encoder and decoder`,()=>{
 const value=structuredClone(first.observation);mutate(value);
 refused(()=>assertNativeReadObservation(value,proof));refused(()=>encodeNativeReadObservation(value,proof));
 refused(()=>decodeNativeReadObservation(carrier(canonicalize(value)),proof));
});

test('the actual fixed route operation and original body correlation are mandatory closed data',()=>{
 for(const binding of [undefined,{}, {operation:first.operation},{request:first.request},{...proof,route:'/api/clio/tools/other'},
  {operation:{...first.operation,version:'0.1.0'},request:first.request},{operation:{id:'search_sam_opportunities',version:'0.2.0'},request:first.request},
  {operation:{...first.operation,extra:1},request:first.request},{operation:first.operation,request:[]},{operation:first.operation,request:null},
  {operation:first.operation,request:'{}'}]){
  refused(()=>assertNativeReadObservation(first.observation,binding));refused(()=>encodeNativeReadObservation(first.observation,binding));refused(()=>decodeNativeReadObservation(first.carrier,binding));
 }
 for(const input of [{...proof,context:first.context,route:'/api/clio/tools/other'}, {...proof,context:{asOf:first.context.asOf,mode:'off'}},
  {operation:{id:'search_sam_opportunities',version:'0.2.0'},request:first.request,context:first.context}])refused(()=>createNativeReadObservation(input));
});

test('inherited, accessor, proxy, symbolic and hidden data cannot execute through the helpers',()=>{
 let touched=0;const accessor={...first.observation,get context(){touched++;return first.context;}};
 const proxy=new Proxy(first.observation,{ownKeys(){touched++;return [];},get(){touched++;return undefined;}});
 const inherited=Object.assign(Object.create({polluted:true}),first.observation),hidden=structuredClone(first.observation);Object.defineProperty(hidden,'hidden',{value:1});
 const symbolic={...first.observation,[Symbol('authority')]:true};
 for(const value of [accessor,proxy,inherited,hidden,symbolic])refused(()=>assertNativeReadObservation(value,proof));
 refused(()=>createNativeReadObservation({...proof,get context(){touched++;return first.context;}}));
 refused(()=>assertNativeReadObservation(first.observation,{...proof,get request(){touched++;return first.request;}}));
 refused(()=>createNativeReadObservation({...proof,request:{get clientId(){touched++;return 'private';}},context:first.context}));
 assert.equal(touched,0);
});

for(const [label,json] of [
 ['root prototype',first.canonicalJson.replace('{','{"__proto__":{"polluted":true},')],
 ['context prototype',first.canonicalJson.replace('"context":{','"context":{"__proto__":{"polluted":true},')],
 ['constructor prototype',first.canonicalJson.replace('"context":{','"context":{"constructor":{"prototype":{"polluted":true}},')],
 ['duplicate hash',first.canonicalJson.replace('"requestSha256":','"requestSha256":"'+'0'.repeat(64)+'","requestSha256":')],
 ['duplicate equal context',first.canonicalJson.replace('"context":','"context":'+JSON.stringify(first.context)+',"context":')],
 ['root array','['+first.canonicalJson+']'],['null','null'],['leading whitespace',' '+first.canonicalJson],['trailing newline',first.canonicalJson+'\n'],
 ['key order',JSON.stringify(first.observation)],['escaped ASCII',first.canonicalJson.replace('meri-native-read-observation','\\u006deri-native-read-observation')],
 ['trailing garbage',first.canonicalJson+'{}'],['invalid JSON','{'],
])test(`noncanonical/hostile parsed JSON ${label} refuses`,()=>{
 refused(()=>decodeNativeReadObservation(carrier(json),proof));assert.equal(Object.prototype.polluted,undefined);
});

test('base64 must be unpadded canonical URL alphabet with canonical final bits',()=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',last=first.carrier.at(-1),index=alphabet.indexOf(last);
 assert.equal(first.decodedBytes%3,1);const changedBits=first.carrier.slice(0,-1)+alphabet[index+1];
 assert.equal(Buffer.from(changedBits,'base64url').toString('utf8'),first.canonicalJson);
 for(const value of ['',null,Buffer.from(first.carrier),first.carrier+'=',first.carrier+'==',' '+first.carrier,first.carrier+'\n',
  first.carrier.slice(0,-1)+'+',first.carrier.slice(0,-1)+'/',changedBits,'A','data:application/json;base64,'+first.carrier])refused(()=>decodeNativeReadObservation(value,proof));
});

test('invalid UTF8, BOM, oversized encoded inputs and decoded payloads are refused',()=>{
 for(const bytes of [Buffer.from([0xc3,0x28]),Buffer.from([0xff]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(first.canonicalJson)]),
  Buffer.alloc(2049,0x20),Buffer.from(' '.repeat(2048-first.decodedBytes)+first.canonicalJson)])refused(()=>decodeNativeReadObservation(bytes.toString('base64url'),proof));
 refused(()=>decodeNativeReadObservation('A'.repeat(2732),proof));refused(()=>decodeNativeReadObservation('A'.repeat(100000),proof));
 assert.ok(Buffer.from(first.carrier,'base64url').byteLength<=NATIVE_READ_OBSERVATION_MAX_BYTES);
});
