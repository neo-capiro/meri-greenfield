/** Actual public listener -> product mount -> upload current session/custody owner, with local storage ports. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../product-applications.mjs';
import {createUploadApplication} from '../../control/uploads/application.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {uploadHash} from '../../control/uploads/policy.mjs';
import {applicationFixture,binding,id} from '../../control/conversations/test/application-fixture.mjs';

async function mounted({sourceEnabled=true}={}){
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const f=await applicationFixture({scopes,selectedClientId:null}),state=Object.assign(f.state,{rows:new Map(),puts:0,prepares:0});
 const bytes=Buffer.from('original upload crossing the public listener'),declaration={filename:'source.txt',mimeType:'text/plain',bytes:bytes.length,sha256:uploadHash(bytes)};
 const store={async prepare(row){state.prepares++;state.rows.set(row.uploadId,structuredClone(row));return structuredClone(row);},async read(owner,key){return structuredClone(state.rows.get(key)??null);},
  async transition(old,next,check){check();state.rows.set(next.uploadId,structuredClone(next));return structuredClone(next);}};
 const objects={async put(value){state.puts++;assert.deepEqual(value.bytes,bytes);return {objectId:value.objectId,versionId:'immutable-original',bytes:bytes.length,sha256:declaration.sha256,scopes};},
  async get(){return Buffer.from(bytes);},async observePut(){throw Error('not needed');}};
 const retention={async assertServable(){if(state.suppressed)throw Error('SUPPRESSED');},async withRelease(subjects,release,{signal}){await this.assertServable();return release(signal,()=>this.assertServable());}};
 let sequence=700;const ports=captureRuntimePorts({uploadApplicationFactory:{state:()=> 'composed',create({sessions,retention:gate}){
  return createUploadApplication({sessions,retention:gate,store,objects,inspection:createUploadInspection({now:Date.now}),removeOriginal:async()=>{throw Error('unused');},now:Date.now,ids:()=>id(sequence++)});
 }}});
 const assembly=createRuntimeProductApplications({configuration:{sourceEnabled,limits:{requestMs:30000,requestBytes:65536},native:{maxResponseBytes:262144}},sessions:f.sessions,ports,now:Date.now,retention});
 const routes=createControlRouteApplications({assembly,candidate:{handle(){assert.fail('upload reached protected native candidate');}}});
 const request=(route,body,method='POST')=>new Request('https://control.invalid/api/uploads/'+route,{method,headers:{authorization:'Bearer '+f.credential,'content-type':method==='PUT'?'application/octet-stream':'application/json',...(method==='PUT'?{'content-length':String(body.length)}:{})},body:method==='PUT'?body:JSON.stringify(body)});
 return {...f,state,bytes,declaration,routes,request,initiate:()=>routes.public.handle(request('initiate',{requestId:id(650),...declaration}))};
}
test('outer listener reaches authenticated custody initiation and exact original PUT, preserving pending inspection',async()=>{
 const f=await mounted();try{
  const initiated=await f.initiate();assert.equal(initiated.status,200,await initiated.clone().text());const initial=await initiated.json();assert.equal(initial.storageStatus,'awaiting_upload');
  const put=await f.routes.public.handle(f.request('original/'+initial.uploadId,f.bytes,'PUT'));assert.equal(put.status,200,await put.clone().text());const stored=await put.json();
  assert.equal(stored.original.versionId,'immutable-original');assert.equal(stored.storageStatus,'stored');assert.equal(stored.scanStatus,'pending');assert.equal(stored.originalBytesAvailable,false);assert.equal(f.state.puts,1);
  const status=await f.routes.public.handle(f.request('status',{uploadId:initial.uploadId}));assert.equal(status.status,200);assert.equal((await status.json()).original.sha256,f.declaration.sha256);
 }finally{f.close();}
});
for(const mode of ['missing bearer','invalid bearer','revoked','retention'])test('outer upload admission preserves '+mode,async()=>{
 const f=await mounted();try{const request=f.request('initiate',{requestId:id(650),...f.declaration});
  if(mode==='missing bearer')request.headers.delete('authorization');if(mode==='invalid bearer')request.headers.set('authorization','Bearer unknown');if(mode==='revoked')f.state.revoked=true;if(mode==='retention')f.state.suppressed=true;
  const response=await f.routes.public.handle(request);assert.notEqual(response.status,200);assert.notEqual(response.status,404);assert.equal(f.state.prepares,0);assert.equal(f.state.puts,0);
 }finally{f.close();}
});
test('outer upload routes keep owner methods, disabled behavior, neighboring and private paths closed',async()=>{
 const f=await mounted(),disabled=await mounted({sourceEnabled:false});try{
  for(const suffix of ['initiate/extra','initiate-other','%69nitiate','complete','original','original/'+id(700)+'/extra','original/not-an-id','../uploads-other/status'])assert.equal((await f.routes.public.handle(f.request(suffix,{}))).status,404,suffix);
  assert.equal((await f.routes.private.handle(f.request('initiate',{}))).status,404);
  assert.equal((await f.routes.public.handle(f.request('original/'+id(700),{}))).status,405);
  assert.equal((await disabled.initiate()).status,503);assert.equal(f.state.prepares,0);assert.equal(f.state.puts,0);
 }finally{f.close();disabled.close();}
});
