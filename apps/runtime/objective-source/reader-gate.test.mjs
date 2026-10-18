/** SYNTHETIC Ed25519 keys, native rows, immutable CAS and replay storage only.
 * The positive source path uses the actual custody/projection/gate factories;
 * retained tests use the actual Core owner around an explicitly synthetic reader.
 * These fixtures establish no live native authority or production durability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {readerPurposes,readerTokenType} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {objectiveReaderRequestBody} from '../../../packages/contracts/objective-reader-2/validate.mjs';
import {createObjectiveSourceReaderGate} from './reader-gate.mjs';
import {custodyFixture,id,NOW} from './test/custody-fixture.mjs';

const purposes=Object.keys(readerPurposes),keys=Object.fromEntries(purposes.map(p=>[p,generateKeyPairSync('ed25519')]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const denied=error=>error?.code==='OBJECTIVE_READER_V2_UNAVAILABLE';
const trust=()=>Object.fromEntries(purposes.map(p=>[p,{issuer:'https://'+p+'.synthetic.invalid',publicKeys:{'test-1':keys[p].publicKey.export({format:'jwk'})}}]));
function tokenFor(body,{header={},claims={},scope={},headerText,claimsText,purpose=body.purpose,key=keys[purpose].privateKey}={}){
 const descriptor=readerPurposes[purpose],bytes=objectiveReaderRequestBody(body);
 const h={alg:'EdDSA',typ:readerTokenType,kid:'test-1',...header},c={iss:'https://'+purpose+'.synthetic.invalid',sub:descriptor.subject,aud:descriptor.audience,
  iat:Math.floor(NOW/1000),nbf:Math.floor(NOW/1000),exp:Math.floor(NOW/1000)+60,jti:id(99),
  objective:{purpose,operation:descriptor.operation,phase:descriptor.phase,method:'POST',path:descriptor.path,query:'',bodySha256:sha(bytes),
   sourceAdmissionSha256:body.sourceAdmissionSha256,generationJobId:body.generationJobId,...scope},...claims};
 const input=Buffer.from(headerText??JSON.stringify(h)).toString('base64url')+'.'+Buffer.from(typeof claimsText==='function'?claimsText(c):claimsText??JSON.stringify(c)).toString('base64url');
 return input+'.'+sign(null,Buffer.from(input,'ascii'),key).toString('base64url');
}
async function fixture({purpose='active-source',withRetained=false,changeConfiguration}={}){
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 if(purpose!=='active-source')f.state.accepted.run.state='completed';
 const state={custodyReads:0,effects:0,replays:0,retainedReads:0,factoryCalls:0,entries:new Map(),afterRead:null,onRunOnce:null,resultChange:null,uncertain:false};
 const body={schemaVersion:2,purpose,...f.selector};
 const custody={available:p=>owner.available(p),async read(value){state.custodyReads++;const answer=await owner.read(value);state.afterRead?.(state.custodyReads,answer);return answer;}};
 const idempotency={async runOnce({identity,source},effect){
  state.onRunOnce?.();if(state.uncertain)return {status:'unknown',value:null};
  const key=hash([identity.issuer,identity.subject,identity.tokenId]),stamp=hash({identity,source}),prior=state.entries.get(key);
  if(prior){if(prior.stamp!==stamp)throw Error('SYNTHETIC_JTI_CONFLICT');state.replays++;return {status:'replayed',value:structuredClone(await prior.result)};}
  const entry={stamp,result:Promise.resolve().then(()=>{state.effects++;return effect();})};state.entries.set(key,entry);
  return {status:'executed',value:structuredClone(await entry.result)};
 }};
 const retainedReaderFactory=async(source,{signal})=>{
  state.factoryCalls++;assert.equal(hash(source.binding),hash(f.binding));assert.equal(signal instanceof AbortSignal,true);
  return {available:()=>true,async read({generationJobId}){
   state.retainedReads++;assert.equal(generationJobId,f.selector.generationJobId);
   const result=JSON.parse(readFileSync(new URL('../../../packages/contracts/strategy-operations-candidate/fixtures/strategy.draft.result.json',import.meta.url),'utf8'));
   const execution={provider:'synthetic-provider',model:'synthetic-model',receiptRef:id(40),receiptSha256:'a'.repeat(64),bindingSha256:hash(f.binding)};
   Object.assign(result,{requestId:f.accepted.request.requestId,jobId:f.selector.generationJobId,requestSha256:f.issued.objectiveStrategy.requestSha256,binding:f.binding,execution});result.payload.type='appropriations';
   const value={schemaVersion:1,generationJobId,binding:f.binding,sourceAdmissionSha256:f.selector.sourceAdmissionSha256,sourceRequestSha256:hash(f.accepted.request),
    typedRequestSha256:f.issued.objectiveStrategy.requestSha256,completionId:id(40),checkpointId:id(41),checkpointSha256:'b'.repeat(64),resultRef:id(42),resultSha256:hash(result),
    file:{path:'meri-objective-strategy-draft.result.json',object:{objectId:id(43),versionId:'SYNTHETIC-IMMUTABLE-VERSION',sha256:'c'.repeat(64),bytes:123,
     scopes:f.accepted.run.scopes}},rawFileSha256:'c'.repeat(64),execution,result,checkedAtMs:f.state.now,expiresAtMs:f.state.now+1000};
   return state.resultChange?.(value)??value;
  }};
 };
 const config={enabled:true,trust:trust(),custody,idempotency,now:()=>f.state.now,...(withRetained?{retainedReaderFactory}:{})};
 changeConfiguration?.(config);const gate=createObjectiveSourceReaderGate(config);
 const request=(options={})=>({method:'POST',target:readerPurposes[purpose].path,authorization:'Bearer '+tokenFor(body,options),rawBody:objectiveReaderRequestBody(body)});
 return {f,state,body,config,gate,request};
}

test('default-off import/factory/read never inspect configured ports, clocks or keys',async()=>{
 let inspected=0;const config=Object.defineProperty({},'trust',{get(){inspected++;throw Error('MUST_NOT_READ');}});
 const disabled=Object.defineProperty({enabled:false},'trust',{get(){inspected++;throw Error('MUST_NOT_READ');}});
 for(const value of [undefined,config,disabled]){
  const gate=createObjectiveSourceReaderGate(value);assert.equal(gate.available(),false);await assert.rejects(gate.read({}),denied);
 }
 assert.equal(inspected,0);
});

test('actual custody and source projection factories serve only a fresh named active read',async()=>{
 const f=await fixture(),before=f.f.state.nativeCalls;assert.equal(f.gate.available('active-source'),true);
 const result=await f.gate.read(f.request());assert.equal(result.purpose,'active-source');assert.deepEqual(result.binding,f.f.binding);
 assert.equal(result.issuance.factsSha256,f.f.issued.issuance.factsSha256);assert.equal(f.state.effects,1);assert.equal(f.state.custodyReads,3);
 assert.ok(f.f.state.nativeCalls>=before+6);assert.equal(f.f.state.calls.prepared,3);assert.equal('materialRef'in result.issuance,false);
});

test('exact contemporaneous replay rechecks custody before and after without executing twice; stale cached timestamps deny',async()=>{
 const f=await fixture(),request=f.request(),first=await f.gate.read(request),before=f.f.state.nativeCalls;
 assert.deepEqual(await f.gate.read(request),first);assert.equal(f.state.effects,1);assert.equal(f.state.replays,1);assert.equal(f.state.custodyReads,5);
 assert.ok(f.f.state.nativeCalls>=before+4);f.f.state.now++;
 await assert.rejects(f.gate.read(request),denied);assert.equal(f.state.effects,1);assert.equal(f.state.replays,2);
 assert.equal(f.state.entries.size,1);
});

test('historical source has fresh read expiry while original execution remains expired; active cannot read terminal source',async()=>{
 const f=await fixture({purpose:'historical-source'});f.f.state.now=NOW+200000;
 const request=f.request({claims:{iat:Math.floor(f.f.state.now/1000),nbf:Math.floor(f.f.state.now/1000),exp:Math.floor(f.f.state.now/1000)+60}});
 const result=await f.gate.read(request);assert.equal(result.runState,'completed');assert.ok(result.issuance.expiresAtMs<f.f.state.now);
 assert.ok(result.expiresAtMs>f.f.state.now);assert.equal(f.f.state.calls.prepared,0);
 const active=await fixture();active.f.state.accepted.run.state='completed';await assert.rejects(active.gate.read(active.request()),denied);
});

test('retained source is unavailable without an explicit server factory; supplied reader is wrapped by actual source-bound owner',async()=>{
 const absent=await fixture({purpose:'retained-result'});assert.equal(absent.gate.available('retained-result'),false);
 await assert.rejects(absent.gate.read(absent.request()),denied);assert.equal(absent.state.custodyReads,0);
 const f=await fixture({purpose:'retained-result',withRetained:true}),result=await f.gate.read(f.request());
 assert.equal(result.schemaVersion,1);assert.equal(result.file.object.versionId,'SYNTHETIC-IMMUTABLE-VERSION');
 assert.equal(f.state.factoryCalls,1);assert.equal(f.state.retainedReads,1);assert.equal(f.state.custodyReads,3);
 f.f.state.now++;await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.retainedReads,1);
});

for(const failure of ['shared issuer','shared key','private key','wrong algorithm','missing purpose','missing custody','missing durability'])test('invalid trust/composition closes before owner I/O: '+failure,async()=>{
 const f=await fixture({changeConfiguration:c=>{
  if(failure==='shared issuer')c.trust['historical-source'].issuer=c.trust['active-source'].issuer;
  if(failure==='shared key')c.trust['historical-source'].publicKeys=c.trust['active-source'].publicKeys;
  if(failure==='private key')c.trust['active-source'].publicKeys['test-1'].d='FORBIDDEN';
  if(failure==='wrong algorithm')c.trust['active-source'].publicKeys['test-1']={kty:'RSA',n:'AA',e:'AQAB'};
  if(failure==='missing purpose')delete c.trust['historical-source'];
  if(failure==='missing custody')c.custody=null;
  if(failure==='missing durability')c.idempotency=null;
 }});
 assert.equal(f.gate.available(),false);await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.custodyReads,0);
});

test('signed route, raw bytes, closed body, purpose and source commitment are exact before custody',async()=>{
 const f=await fixture(),valid=f.request();
 for(const request of [
  {...valid,method:'GET'},{...valid,target:valid.target+'?retry=1'},{...valid,target:valid.target+'/'},
  {...valid,authorization:[valid.authorization,valid.authorization]},
  {...valid,rawBody:Buffer.concat([valid.rawBody,Buffer.from(' ')])},
  {...valid,rawBody:Buffer.from(valid.rawBody.toString().replace('"schemaVersion":2','"schemaVersion":2,"schemaVersion":2'))},
  {...valid,rawBody:Buffer.from(JSON.stringify({...f.body,binding:f.f.binding}))},
  f.request({scope:{purpose:'historical-source'}}),f.request({scope:{sourceAdmissionSha256:'1'.repeat(64)}}),
  f.request({claims:{sub:readerPurposes['historical-source'].subject}}),f.request({claims:{aud:readerPurposes['historical-source'].audience}}),
 ])await assert.rejects(f.gate.read(request),denied);
 assert.equal(f.state.custodyReads,0);assert.equal(f.state.effects,0);
});

test('canonical nested Ed25519 JWT rejects alternate encodings, duplicate fields, stale times and substituted keys',async()=>{
 const f=await fixture(),sec=Math.floor(NOW/1000);
 const badTokens=[
  tokenFor(f.body,{header:{alg:'RS256'}}),tokenFor(f.body,{header:{kid:'unallocated'}}),tokenFor(f.body,{header:{jku:'https://attacker.invalid'}}),
  tokenFor(f.body,{headerText:JSON.stringify({typ:readerTokenType,alg:'EdDSA',kid:'test-1'})}),
  tokenFor(f.body,{claimsText:c=>JSON.stringify({...c,objective:Object.fromEntries(Object.entries(c.objective).reverse())})}),
  tokenFor(f.body,{claimsText:c=>JSON.stringify(c).replace('"jti":','"jti":"'+id(98)+'","jti":')}),
  tokenFor(f.body,{claimsText:c=>' '+JSON.stringify(c)}),tokenFor(f.body,{claimsText:c=>'\uFEFF'+JSON.stringify(c)}),
  tokenFor(f.body,{claims:{exp:sec+61}}),tokenFor(f.body,{claims:{nbf:sec+1}}),tokenFor(f.body,{claims:{iat:-1}}),tokenFor(f.body,{claims:{exp:sec}}),
  tokenFor(f.body,{key:keys['historical-source'].privateKey}),
 ];
 const padded=tokenFor(f.body).split('.');padded[0]+='=';badTokens.push(padded.join('.'));
 for(const token of badTokens)await assert.rejects(f.gate.read({...f.request(),authorization:'Bearer '+token}),denied);
 assert.equal(f.state.custodyReads,0);
});

test('purpose-specific issuer and key cannot cross into another correctly signed purpose request',async()=>{
 const f=await fixture({purpose:'historical-source'}),bad=tokenFor(f.body,{claims:{iss:'https://active-source.synthetic.invalid'},key:keys['active-source'].privateKey});
 await assert.rejects(f.gate.read({...f.request(),authorization:'Bearer '+bad}),denied);assert.equal(f.state.custodyReads,0);
});

test('same issuer/subject/JTI with different signed token bytes conflicts despite identical source/body',async()=>{
 const f=await fixture();await f.gate.read(f.request());
 await assert.rejects(f.gate.read(f.request({claims:{exp:Math.floor(NOW/1000)+59}})),denied);
 assert.equal(f.state.effects,1);assert.equal(f.state.entries.size,1);assert.equal(f.state.custodyReads,4);
});

test('revocation after an initial effect or during a replay withholds the cached result',async()=>{
 const f=await fixture();f.state.afterRead=count=>{if(count===2)f.f.state.nativeMode='revoked';};
 await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,1);
 const g=await fixture();await g.gate.read(g.request());g.state.onRunOnce=()=>{g.f.state.nativeMode='revoked';};
 await assert.rejects(g.gate.read(g.request()),denied);assert.equal(g.state.effects,1);assert.equal(g.state.replays,1);
});

test('substituted full binding or immutable protected-facts identity cannot escape source custody',async()=>{
 const f=await fixture();f.state.afterRead=(_count,value)=>{f.f.state.issued.issuance.factsSha256='2'.repeat(64);};
 await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,1);
 const g=await fixture();g.f.state.accepted.run.binding.workerId=id(97);
 await assert.rejects(g.gate.read(g.request()),denied);assert.equal(g.state.effects,0);
});

test('raw entity is snapshotted before the first owner await',async()=>{
 const f=await fixture(),raw=f.request(),pending=f.gate.read(raw);raw.rawBody.fill(0);
 const result=await pending;assert.equal(result.generationJobId,f.body.generationJobId);
});

test('advancing fresh read deadlines do not rewrite or renew the original source projection',async()=>{
 const f=await fixture();f.state.afterRead=()=>{f.f.state.now++;};
 const result=await f.gate.read(f.request());assert.equal(result.checkedAtMs,NOW);assert.equal(result.expiresAtMs,NOW+2000);
 assert.equal(f.state.custodyReads,3);assert.equal(f.f.state.now,NOW+3);
});

test('uncertain durable result, cancellation and backward clocks release no response',async()=>{
 const f=await fixture();f.state.uncertain=true;await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,0);
 const g=await fixture(),controller=new AbortController();g.state.onRunOnce=()=>controller.abort();
 await assert.rejects(g.gate.read({...g.request(),signal:controller.signal}),denied);
 const h=await fixture();h.state.onRunOnce=()=>{h.f.state.now--;};await assert.rejects(h.gate.read(h.request()),denied);
});

for(const change of ['source','expired','stale','extra','typed request'])test('actual retained owner/closed receiver refuses '+change+' result',async()=>{
 const f=await fixture({purpose:'retained-result',withRetained:true});f.state.resultChange=value=>{
  if(change==='source')value.binding={...value.binding,workerId:id(96)};
  if(change==='expired')value.expiresAtMs=NOW;
  if(change==='stale')value.checkedAtMs=NOW-1;
  if(change==='extra')value.materialRef='SYNTHETIC-FORBIDDEN';
  if(change==='typed request')value.typedRequestSha256='3'.repeat(64);
  return value;
 };
 await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.retainedReads,1);
});
