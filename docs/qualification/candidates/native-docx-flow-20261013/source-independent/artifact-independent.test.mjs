import test from 'node:test';
import assert from 'node:assert/strict';
const load=p=>import(new URL('../../../../../'+p,import.meta.url));
const {fixture}=await load('apps/runtime/artifacts/test/fixture.mjs');
const {createRuntimeArtifactApplication,createRuntimeDocumentOptionsComposer}=await load('apps/runtime/artifacts/index.mjs');
const {configuration}=await load('apps/control/document-application/current.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const request={operation:'create_word',format:'txt',title:'Independent public synthetic review',content:{text:'Independent source test only. No real source access or native grant is established.'}};
function call(x,body={deliveryId:'independent',request},credential=x.session.credential,route='create',signal){return new Request('https://synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body),signal});}
const app=(x,owner=x.owner,limits=x.f.limits)=>createRuntimeArtifactApplication({sessions:x.f.sessions,now:x.f.now,limits,optionsOwner:owner});
const refused=async response=>{assert.notEqual(response.status,200);return response.json();};
test('independent request opaque credential and canonical body hash reach trusted owner with ordinary method receiver intact',async()=>{
 const x=await fixture();try{const state=new WeakMap(),seen=[];const owner={async resolve(value){assert.equal(state.get(this),'owner');assert.equal(Object.isFrozen(value.body.request.content),true);assert.equal(value.requestSha256,hash({intent:value.intent,body:value.body}));seen.push(value.credential);const resolved=await x.owner.resolve(value);state.set(resolved,'read');const recheck=resolved.recheck;resolved.recheck=async function(check){assert.equal(state.get(this),'read');return recheck.call(this,check);};return resolved;}};state.set(owner,'owner');const runtime=app(x,owner);const response=await runtime.handle(call(x));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.deepEqual(seen,[x.session.credential]);assert.equal(x.stored.size,1);assert.equal(x.db.state.versions.size,1);assert.ok(x.state.checks.includes('release'));}finally{const cleanup=await x.close();assert.equal(cleanup.http.closed,true);assert.equal(cleanup.fixture.cleanup.storeRemoved,true);}
});
for(const field of ['binding','context','scopes','credential','artifactOptions','namespace'])test('independent model/caller '+field+' is not accepted as artifact authority',async()=>{
 const x=await fixture();try{const response=await app(x).handle(call(x,{deliveryId:'forged-'+field,request,[field]:field==='namespace'?'product':{forged:true}}));await refused(response);assert.equal(x.stored.size,0);assert.equal(x.db.state.versions.size,0);assert.equal(x.f.stats().generations,0);}finally{await x.close();}
});
test('independent native current refusal at admission prevents any accounting/generation/storage',async()=>{
 const x=await fixture();try{x.state.deny=true;const result=await refused(await app(x).handle(call(x)));assert.equal(result.error.outcome,'NOT_DISPATCHED');assert.equal(x.f.stats().generations,0);assert.equal(x.f.stats().versionCharges,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent literal outer credential is never replaced by task credential or accepted after source revoke',async()=>{
 const x=await fixture();try{await refused(await app(x).handle(call(x,undefined,x.f.credential)));assert.equal(x.stored.size,0);x.f.revoke();await refused(await app(x).handle(call(x)));assert.equal(x.f.stats().generations,0);}finally{await x.close();}
});
for(const key of ['sessions','now','selectedClientId'])test('independent trusted '+key+' substitution refuses before artifact effects',async()=>{
 const x=await fixture();try{const owner={async resolve(value){const r=await x.owner.resolve(value);r.documentOptions[key]=key==='sessions'?{}:key==='now'?()=>x.f.now():'00000000-0000-4000-8000-000000000099';return r;}};await refused(await app(x,owner).handle(call(x)));assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent absent/boolean/non-own recheck never creates qualification authority',async()=>{
 const x=await fixture();try{for(const mode of ['absent','boolean','prototype']){const owner={async resolve(value){const r=await x.owner.resolve(value);if(mode==='absent')delete r.recheck;if(mode==='boolean')r.recheck=async()=>true;if(mode==='prototype'){const fn=r.recheck;delete r.recheck;Object.setPrototypeOf(r,{recheck:fn});}return r;}};await refused(await app(x,owner).handle(call(x,{deliveryId:mode,request})));}assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent configuration getters and proxies are inert before owner reads',()=>{
 let touched=0;assert.throws(()=>createRuntimeArtifactApplication({sessions:{},now:Date.now,limits:{maxRequestMs:20,maxRequestBytes:4096,maxResponseBytes:4096},optionsOwner:{get resolve(){touched++;return()=>{};}}}));assert.equal(touched,0);
 const proxy=new Proxy({resolve(){}},{get(){touched++;throw Error('getter');}});assert.throws(()=>createRuntimeArtifactApplication({sessions:{},now:Date.now,limits:{maxRequestMs:20,maxRequestBytes:4096,maxResponseBytes:4096},optionsOwner:proxy}));assert.equal(touched,0);
});
test('independent explicit product namespace threads root canonical chain and refuses missing product admission without qualification fallback',async()=>{
 const x=await fixture();try{const commands=[];const pool={async connect(){return {async query(sql){commands.push(sql);if(sql.startsWith('SELECT * FROM meri_product_budget.budget'))return{rows:[]};if(sql==='SELECT clock_timestamp() AS now')return{rows:[{now:new Date(x.f.now())}]};if(['BEGIN','ROLLBACK','COMMIT'].includes(sql)||sql.startsWith('SET LOCAL'))return{rows:[]};throw Error('NO_PRODUCT_ADMISSION');},release(){}};}};
 const compose=createRuntimeDocumentOptionsComposer({storage:x.storage,executor:x.f.artifactOptions.executor,budgetPool:pool,sessions:x.f.sessions,now:x.f.now,namespace:'product'});
 const owner={async resolve(value){const r=await x.owner.resolve(value);const {sessions,now,...trusted}=r.documentOptions;r.documentOptions=compose(trusted);assert.equal(configuration(r.documentOptions).options.namespace,'product');return r;}};
 await refused(await app(x,owner).handle(call(x)));assert.ok(commands.some(s=>s.includes('meri_product_budget.budget')));assert.equal(commands.some(s=>s.includes('meri_qualification')),false);assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);
 }finally{await x.close();}
});
test('independent disabled original source flag remains closed and composer never enables it',async()=>{
 const x=await fixture();try{const owner={async resolve(value){const r=await x.owner.resolve(value);r.documentOptions.artifactOptions.sourceEnabled=false;return r;}};await refused(await app(x,owner).handle(call(x)));assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent request-specific outer response byte ceiling must be enforced before response release',async()=>{
 const x=await fixture();try{const response=await app(x,x.owner,{...x.f.limits,maxResponseBytes:64}).handle(call(x));const bytes=Buffer.from(await response.arrayBuffer());assert.ok(response.status!==200||bytes.length<=64,'outer maxResponseBytes64 released200 response '+bytes.length+' bytes');}finally{await x.close();}
});
test('independent inspect and download inherit narrower outer success response byte ceilings',async()=>{
 const x=await fixture();try{const original=await app(x).handle(call(x));assert.equal(original.status,200);const made=await original.json();
  for(const route of ['inspect','download']){const response=await app(x,x.owner,{...x.f.limits,maxResponseBytes:64}).handle(call(x,{versionId:made.version.versionId},undefined,route));const bytes=Buffer.from(await response.arrayBuffer());assert.ok(response.status!==200||bytes.length<=64,route+' released '+bytes.length+' bytes');}
  const unbounded=await app(x).handle(call(x,{versionId:made.version.versionId},undefined,'download'));assert.equal(unbounded.status,200);assert.equal((await unbounded.arrayBuffer()).byteLength,made.version.object.bytes);assert.equal(x.stored.size,1);
 }finally{await x.close();}
});
test('independent outer request byte ceiling refuses before options owner/auth effects',async()=>{
 const x=await fixture();try{const before=x.state.resolved.length;await refused(await app(x,x.owner,{...x.f.limits,maxRequestBytes:32}).handle(call(x)));assert.equal(x.state.resolved.length,before);assert.equal(x.stored.size,0);assert.equal(x.f.stats().generations,0);}finally{await x.close();}
});
test('independent malformed native inner limits must retain canonical typed refusal instead of numeric coercion',async()=>{
 const x=await fixture();try{const owner={async resolve(value){const r=await x.owner.resolve(value);r.documentOptions.limits={...r.documentOptions.limits,maxResponseBytes:String(r.documentOptions.limits.maxResponseBytes)};return r;}};const response=await app(x,owner).handle(call(x));assert.notEqual(response.status,200,'numeric-string native limit was coerced into a canonical number');assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent overlarge native inner limits refuse before minimum caps hide invalid configuration',async()=>{
 const x=await fixture();try{const owner={async resolve(value){const r=await x.owner.resolve(value);r.documentOptions.limits={...r.documentOptions.limits,maxResponseBytes:100000000};return r;}};const response=await app(x,owner).handle(call(x));assert.notEqual(response.status,200,'overlarge native limit bypassed canonical maximum before minimum computation');assert.equal(x.f.stats().generations,0);assert.equal(x.stored.size,0);}finally{await x.close();}
});
test('independent known shorter inner deadline bounds parked admission and is passed to native recheck',async()=>{
 const x=await fixture();try{let observed;const owner={async resolve(value){const r=await x.owner.resolve(value);r.documentOptions.limits={...r.documentOptions.limits,maxRequestMs:20};r.recheck=async check=>{observed=check.deadlineMs;return new Promise(()=>{});};return r;}};
  const started=x.f.now(),wall=performance.now();await refused(await app(x,owner,{...x.f.limits,maxRequestMs:300}).handle(call(x)));assert.ok(observed<=started+25,'native admission received deadline '+(observed-started)+'ms instead of known20ms');assert.ok(performance.now()-wall<150,'known20ms native admission waited outer300ms');assert.equal(x.stored.size,0);assert.equal(x.f.stats().generations,0);
 }finally{await x.close();}
});
