/** SYNTHETIC Ed25519 keys, custody rows and replay storage only (as in objective-source/reader-gate.test.mjs). The actual
 * reader gate, custody owner, trust-pin conversion and HTTP adapter run over in-memory Request/Response objects; no Core,
 * KMS, database, listener or network is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {readerPurposes,readerTokenType} from '../../../../packages/contracts/objective-reader-2/schema.mjs';
import {objectiveReaderRequestBody} from '../../../../packages/contracts/objective-reader-2/validate.mjs';
import {createObjectiveSourceReaderGate} from '../../objective-source/reader-gate.mjs';
import {objectiveReaderTrustFromPublicKeys} from '../../objective-source/trust-pins.mjs';
import {custodyFixture,id,NOW} from '../../objective-source/test/custody-fixture.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {createObjectiveFamily,createObjectiveReaderApplication,OBJECTIVE_READER_PREFIX} from '../objective.mjs';

const purposes=Object.keys(readerPurposes),keys=Object.fromEntries(purposes.map(p=>[p,generateKeyPairSync('ed25519')]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const issuer=p=>'https://'+p+'.synthetic.invalid';
const spki=key=>key.export({format:'der',type:'spki'}).toString('base64');
const kmsKeys=()=>Object.fromEntries(purposes.map(p=>[p,{issuer:issuer(p),keys:[{kid:'kms-1',publicKey:spki(keys[p].publicKey),keySpec:'ECC_NIST_EDWARDS25519',keyUsage:'SIGN_VERIFY'}]}]));
const origin='https://control.meri-preview.internal';
function token(body,purpose=body.purpose,claims={}){
 const d=readerPurposes[purpose],bytes=objectiveReaderRequestBody(body),seconds=Math.floor(NOW/1000);
 const h={alg:'EdDSA',typ:readerTokenType,kid:'kms-1'},c={iss:issuer(purpose),sub:d.subject,aud:d.audience,iat:seconds,nbf:seconds,exp:seconds+60,jti:id(99),
  objective:{purpose,operation:d.operation,phase:d.phase,method:'POST',path:d.path,query:'',bodySha256:sha(bytes),sourceAdmissionSha256:body.sourceAdmissionSha256,generationJobId:body.generationJobId},...claims};
 const input=Buffer.from(JSON.stringify(h)).toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url');
 return input+'.'+sign(null,Buffer.from(input,'ascii'),keys[purpose].privateKey).toString('base64url');
}
async function enabled(){
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});const state={effects:0,entries:new Map()};
 const idempotency={async runOnce({identity,source},effect){const key=hash([identity.issuer,identity.subject,identity.tokenId]),stamp=hash({identity,source}),prior=state.entries.get(key);
  if(prior){if(prior.stamp!==stamp)throw Error('SYNTHETIC_JTI_CONFLICT');return {status:'replayed',value:structuredClone(await prior.result)};}
  const entry={stamp,result:Promise.resolve().then(()=>{state.effects++;return effect();})};state.entries.set(key,entry);return {status:'executed',value:structuredClone(await entry.result)};}};
 const gate=createObjectiveSourceReaderGate({enabled:true,trust:objectiveReaderTrustFromPublicKeys(kmsKeys()),custody:{available:p=>owner.available(p),read:value=>owner.read(value)},idempotency,now:()=>f.state.now});
 const body={schemaVersion:2,purpose:'active-source',...f.selector},bytes=objectiveReaderRequestBody(body);
 const request=(init={})=>new Request(origin+readerPurposes['active-source'].path,{method:'POST',headers:{authorization:'Bearer '+token(body),'content-type':'application/json',...init.headers},body:init.body??bytes,...(init.method?{method:init.method}:{})});
 return {f,state,gate,body,bytes,request,app:createObjectiveReaderApplication({gate})};
}

test('the family contributes no public port; the default reader denies every exact path without reading a body',async()=>{
 assert.deepEqual(createObjectiveFamily(Object.freeze({configuration:{}})),{ports:{}});
 assert.deepEqual(createProductPortsFactory({families:[['objective',createObjectiveFamily]]})(Object.freeze({})),{});
 const app=createObjectiveReaderApplication();assert.equal(app.state(),'disabled');
 for(const {path} of Object.values(readerPurposes)){
  let pulled=false;const body=new ReadableStream({pull(controller){pulled=true;controller.enqueue(new Uint8Array([123]));controller.close();}},{highWaterMark:0});
  const response=await app.handle(new Request(origin+path,{method:'POST',headers:{authorization:'Bearer x.y.z','content-type':'application/json'},body,duplex:'half'}));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'OBJECTIVE_READER_V2_UNAVAILABLE'}});
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(pulled,false,'refused before the body');
 }
 for(const path of [OBJECTIVE_READER_PREFIX+'accepted-source/read/extra',OBJECTIVE_READER_PREFIX+'other','/v1/internal/objective-generation/retained-result/read','/api/documents/create'])
  assert.equal(await app.handle(new Request(origin+path,{method:'POST'})),null,path);
 assert.throws(()=>createObjectiveReaderApplication({gate:{read(){}}}),/PRODUCT_PORTS_CONFIGURATION/u);
 assert.throws(()=>createObjectiveReaderApplication({maxConcurrent:0}),/PRODUCT_PORTS_CONFIGURATION/u);
 assert.throws(()=>createObjectiveReaderApplication({trust:{}}),/PRODUCT_PORTS_CONFIGURATION/u);
});

test('a configured gate serves the exact signed raw body as 200 JSON and replays the same JTI without a second effect',async()=>{
 const x=await enabled();assert.equal(x.app.state(),'composed');
 const response=await x.app.handle(x.request());assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/^application\/json/u);assert.equal(response.headers.get('content-encoding'),null);
 const value=await response.json();assert.equal(value.purpose,'active-source');assert.deepEqual(value.binding,x.f.binding);assert.equal(x.state.effects,1);
 assert.deepEqual(await (await x.app.handle(x.request())).json(),value);assert.equal(x.state.effects,1);
});

test('transport refusals are closed and leave the effect unrun',async()=>{
 const x=await enabled(),refused=async request=>{const response=await x.app.handle(request);assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'OBJECTIVE_READER_V2_UNAVAILABLE'}});};
 const path=readerPurposes['active-source'].path,auth='Bearer '+token(x.body);
 await refused(new Request(origin+path,{method:'PUT',headers:{authorization:auth,'content-type':'application/json'},body:x.bytes}));
 await refused(new Request(origin+path+'?retry=1',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:x.bytes}));
 await refused(x.request({headers:{'content-type':'text/plain'}}));
 await refused(x.request({headers:{'content-encoding':'gzip'}}));
 await refused(x.request({headers:{authorization:'Basic abc'}}));
 await refused(x.request({body:Buffer.concat([x.bytes,Buffer.from(' ')])}));
 await refused(x.request({body:Buffer.alloc(4097,32)}));
 await refused(new Request(origin+path,{method:'POST',headers:{authorization:'Bearer '+token(x.body,'active-source',{exp:Math.floor(NOW/1000)-1}),'content-type':'application/json'},body:x.bytes}));
 // A token signed for the active purpose cannot read the historical route, even with the matching body digest.
 const historical={...x.body,purpose:'historical-source'};
 await refused(new Request(origin+readerPurposes['historical-source'].path,{method:'POST',headers:{authorization:'Bearer '+token(historical,'active-source'),'content-type':'application/json'},body:objectiveReaderRequestBody(historical)}));
 assert.equal(x.state.effects,0);
});

test('trust pins come only from Ed25519 SIGN_VERIFY public keys, one issuer and one key set per purpose',()=>{
 const trust=objectiveReaderTrustFromPublicKeys(kmsKeys());assert.deepEqual(Object.keys(trust),purposes);
 assert.deepEqual(trust['active-source'].publicKeys['kms-1'],{kty:'OKP',crv:'Ed25519',x:keys['active-source'].publicKey.export({format:'jwk'}).x});
 const p256=generateKeyPairSync('ec',{namedCurve:'P-256'}).publicKey;
 for(const [label,change] of Object.entries({
  sharedKey:k=>{k['historical-source'].keys=k['active-source'].keys;},sharedIssuer:k=>{k['historical-source'].issuer=k['active-source'].issuer;},
  missingPurpose:k=>{delete k['retained-result'];},extraPurpose:k=>{k.other=k['active-source'];},
  notEd25519:k=>{k['active-source'].keys[0].publicKey=spki(p256);},wrongSpec:k=>{k['active-source'].keys[0].keySpec='ECC_NIST_P256';},
  encryptKey:k=>{k['active-source'].keys[0].keyUsage='ENCRYPT_DECRYPT';},badKid:k=>{k['active-source'].keys[0].kid='bad kid';},
  tooManyKeys:k=>{k['active-source'].keys=Array.from({length:5},(_,i)=>({...k['active-source'].keys[0],kid:'k'+i}));},
  privateMaterial:k=>{k['active-source'].keys[0].d='FORBIDDEN';},paddedBase64:k=>{k['active-source'].keys[0].publicKey+=' ';},
 })){const k=kmsKeys();change(k);assert.throws(()=>objectiveReaderTrustFromPublicKeys(k),/OBJECTIVE_READER_V2_TRUST_CONFIGURATION/u,label);}
});
