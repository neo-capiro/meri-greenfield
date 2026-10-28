/** Synthetic AWS transport and native observer. Actual entrypoint isolation/client integrity run; no cloud/model/process. */
import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createAgentCoreRenderer} from '../renderer-client.mjs';import {createRuntimeRendererApplication} from '../renderer-http.mjs';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';import {rendererInput,rendererSessionId,rendererSha} from '../renderer-contract.mjs';
import {rendererSandboxArguments,RENDERER_IMAGE_PATHS} from '../renderer-sandbox.mjs';
import {RENDERER_PROBE_PATH} from '../../../artifacts/renderer-qualification.mjs';import {officeTransformArguments} from '../../../artifacts/office-transform.mjs';
import {createRendererPort} from '../../../artifacts/renderer.mjs';import {syntheticAdmission,realPdf} from '../../../artifacts/test/pdf-fixtures.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../../control/conversations/test/store-fixture.mjs';
const imageDigest='sha256:'+'b'.repeat(64),base={region:'us-east-1',agentRuntimeArn:'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic',qualifier:'preview',imageDigest};
function fixture({available=true,tamper=x=>x,stopFails=false}={}){
 const calls=[],native=[],apps=new Map(),admission={...syntheticAdmission(),imageDigest};
 const qualify=async value=>{native.push(['qualify',value]);return {admission,receipt:{state:available?'available':'unavailable',imageDigest},port:createRendererPort({admission:available?admission:null,transformer:{async transform(call){native.push(['transform',call]);const bytes=realPdf(['synthetic renderer result']);return {bytes,receipt:{inputSha256:rendererSha(call.bytes),outputSha256:rendererSha(bytes),format:call.format,target:call.target,nativeQualification:false}};}}})};};
 const client={async send(command){calls.push(command);const c=command.input;
  if(command.constructor.name==='StopRuntimeSessionCommand'){if(stopFails)throw Error('synthetic stop failure');return {statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:c.runtimeSessionId};}
  assert.equal(command.constructor.name,'InvokeAgentRuntimeCommand');assert.equal(c.qualifier,'preview');
  let app=apps.get(c.runtimeSessionId);if(!app){const renderer=createRuntimeRendererApplication({imageDigest,qualify});app=createAgentCoreApplication({execute:()=>assert.fail('renderer reached SDK/model'),renderer});apps.set(c.runtimeSessionId,app);}
  const r=await app.handle(new Request('http://runtime.invalid/invocations',{method:'POST',headers:{'content-type':'application/json','x-amzn-bedrock-agentcore-runtime-session-id':c.runtimeSessionId},body:c.payload}));
  const value=tamper(await r.json());return {statusCode:r.status,$metadata:{httpStatusCode:200},runtimeSessionId:c.runtimeSessionId,contentType:'application/json',response:Readable.from([Buffer.from(JSON.stringify(value))])};
 }};return {client,calls,native,apps};
}
test('actual renderer bridge qualifies, transforms without model/run credentials, and stops only its unique sessions',async()=>{
 const f=fixture(),port=await createAgentCoreRenderer({...base,client:f.client});assert.equal(port.state,'available');
 const result=await port.transform({bytes:Buffer.from('synthetic source'),format:'docx',target:'pdf',deadlineMs:Date.now()+10000,maxBytes:8388608});
 assert.equal(result.receipt.imageDigest,imageDigest);assert.equal(result.receipt.outputSha256,rendererSha(result.bytes));assert.deepEqual(f.native.map(x=>x[0]),['qualify','qualify','transform']);
 assert.deepEqual(f.calls.map(x=>x.constructor.name),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand','InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 const sessions=f.calls.filter(x=>x.constructor.name==='InvokeAgentRuntimeCommand').map(x=>x.input.runtimeSessionId);assert.equal(new Set(sessions).size,2);
 for(let i=0;i<f.calls.length;i+=2){assert.equal(f.calls[i].input.runtimeSessionId,f.calls[i+1].input.runtimeSessionId);const input=JSON.parse(f.calls[i].input.payload);assert.equal(input.kind,'artifact-renderer');assert.equal(Object.hasOwn(input,'credential'),false);assert.equal(Object.hasOwn(input,'execution'),false);}
});
test('failed native qualification leaves the port unavailable; wrong-image response never admits it',async()=>{
 for(const options of [{available:false},{tamper:x=>({...x,admission:{...x.admission,imageDigest:'sha256:'+'a'.repeat(64)}})},{stopFails:true}]){
  const f=fixture(options),port=await createAgentCoreRenderer({...base,client:f.client});assert.equal(port.state,'unavailable');assert.equal(f.calls.length,2);assert.equal(f.native.filter(x=>x[0]==='transform').length,0);
 }
});
test('unknown transport is not retried and cleanup uses the same owned session',async()=>{
 const f=fixture(),port=await createAgentCoreRenderer({...base,client:f.client});const original=f.client.send;
 f.client.send=async command=>{if(command.constructor.name==='InvokeAgentRuntimeCommand'){f.calls.push(command);throw Error('synthetic delivery unknown');}return original(command);};
 await assert.rejects(port.transform({bytes:Buffer.from('x'),format:'docx',target:'pdf',deadlineMs:Date.now()+10000,maxBytes:1024}));
 assert.equal(f.calls.length,4);assert.equal(f.calls[2].input.runtimeSessionId,f.calls[3].input.runtimeSessionId);
});

test('a changed endpoint image after startup cannot return a usable conversion',async()=>{
 let drift=false;const f=fixture({tamper:result=>drift?{...result,admission:{...result.admission,imageDigest:'sha256:'+'c'.repeat(64)}}:result});
 const port=await createAgentCoreRenderer({...base,client:f.client});assert.equal(port.state,'available');drift=true;
 await assert.rejects(port.transform({bytes:Buffer.from('x'),format:'docx',target:'pdf',deadlineMs:Date.now()+10000,maxBytes:1024}),{code:'RENDERER_RESULT_REFUSED'});
 assert.equal(f.calls.length,4);assert.equal(f.calls[2].input.runtimeSessionId,f.calls[3].input.runtimeSessionId);
});
test('renderer body rejects commands, credentials, malformed bytes and mixed session purpose',async()=>{
 const input={kind:'artifact-renderer',action:'qualify',requestId:'a'.repeat(64),imageDigest,deadlineMs:Date.now()+10000};
 for(const extra of [{command:'/bin/sh'},{credential:'secret'},{execution:{}},{action:'sdk'}])assert.throws(()=>rendererInput({...input,...extra}));
 assert.throws(()=>rendererInput({...input,action:'transform',format:'docx',target:'pdf',maxBytes:100,bytesBase64:'a=',inputSha256:'a'.repeat(64)}));
 const f=fixture(),app=createAgentCoreApplication({execute:()=>assert.fail('no model'),renderer:createRuntimeRendererApplication({imageDigest,qualify:async()=>({port:{state:'unavailable'}})})});
 const request=session=>new Request('http://runtime.invalid/invocations',{method:'POST',headers:{'content-type':'application/json','x-amzn-bedrock-agentcore-runtime-session-id':session},body:JSON.stringify(input)});
 assert.equal((await app.handle(request(rendererSessionId(input.requestId)))).status,503);assert.equal((await app.handle(request('sdk-session-other'))).status,403);
 assert.equal((await app.handle(new Request('http://runtime.invalid/ping',{method:'POST'}))).status,405);
 assert.equal((await app.handle(request(rendererSessionId(input.requestId)))).status,409);await app.close({deadlineMs:Date.now()+1000});
});
test('sandbox admits only the fixed probe/version/Office command and hides all credential/workspace parents',()=>{
 const cwd='/tmp/meri-office-abcdef',args=officeTransformArguments({workspace:cwd,format:'xlsx',target:'pdf'}),plan=rendererSandboxArguments({executable:RENDERER_IMAGE_PATHS.executable,args,cwd});
 for(const flag of ['--unshare-all','--die-with-parent','--new-session','--cap-drop','--remount-ro'])assert.ok(plan.includes(flag));
 for(const path of ['/run','/workspace','/home','/proc/1','/var/run'])assert.equal(plan.includes(path),false);
 assert.ok(plan.includes('--fsize=16777216:16777216'));assert.ok(plan.includes('--nproc=64:64'));
 assert.ok(rendererSandboxArguments({executable:RENDERER_IMAGE_PATHS.nodeExecutable,args:[RENDERER_PROBE_PATH],cwd:'/tmp/meri-renderer-probe-abcdef'}));
 for(const change of [{executable:'/bin/sh'},{args:['--convert-to','pdf','/run/secret']},{cwd:'/workspace/shared'},{cwd:'/tmp/../run/meri-office-abcdef'}])assert.throws(()=>rendererSandboxArguments({executable:RENDERER_IMAGE_PATHS.executable,args,cwd,...change}));
});

test('purpose and single-use admission recheck after an asynchronous request body',async()=>{
 const input={kind:'artifact-renderer',action:'qualify',requestId:'a'.repeat(64),imageDigest,deadlineMs:Date.now()+10000};let native=0;
 const renderer=createRuntimeRendererApplication({imageDigest,qualify:async()=>{native++;return {port:{state:'unavailable'}};}});
 let releaseBody;const body=new ReadableStream({start(c){releaseBody=()=>{c.enqueue(Buffer.from(JSON.stringify(input)));c.close();};}});
 const req=body=>new Request('http://runtime.invalid/invocations',{method:'POST',duplex:'half',headers:{'content-type':'application/json','x-amzn-bedrock-agentcore-runtime-session-id':rendererSessionId(input.requestId)},body});
 const first=renderer.handle(req(body));assert.equal((await renderer.handle(req(JSON.stringify(input)))).status,503);releaseBody();
 assert.equal((await first).status,409);assert.equal(native,1);
 const app=createAgentCoreApplication({execute:()=>assert.fail('no SDK after renderer purpose acquired'),renderer:{handle:async()=>Response.json({}),close:async()=>({settled:true})}});
 const {versions:_,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'synthetic-session-11111111111111111111'});
 let releaseSdk;const sdkBody=new ReadableStream({start(c){releaseSdk=()=>{c.enqueue(Buffer.from(JSON.stringify({execution,versions,credential:'synthetic-run-only'})));c.close();};}});
 const sdk=app.handle(new Request('http://runtime.invalid/invocations',{method:'POST',duplex:'half',headers:{'content-type':'application/json','x-amzn-bedrock-agentcore-runtime-session-id':execution.runtimeSessionId},body:sdkBody}));
 assert.equal((await app.handle(req(JSON.stringify(input)))).status,200);releaseSdk();assert.equal((await sdk).status,403);
 await renderer.close({deadlineMs:Date.now()+1000});await app.close({deadlineMs:Date.now()+1000});
});

test('cancelled transforms stop only their dispatched session; a pre-cancelled transform dispatches nothing',async()=>{
 const f=fixture(),port=await createAgentCoreRenderer({...base,client:f.client}),send=f.client.send,abort=new AbortController();let started;
 const began=new Promise(resolve=>{started=resolve;});
 f.client.send=(command,{abortSignal})=>{if(command.constructor.name==='InvokeAgentRuntimeCommand'){f.calls.push(command);started();return new Promise((_,reject)=>abortSignal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}return send(command);};
 const input={bytes:Buffer.from('x'),format:'docx',target:'pdf',deadlineMs:Date.now()+120000,maxBytes:1024,signal:abort.signal};
 const active=port.transform(input);await began;const dispatched=JSON.parse(f.calls[2].input.payload);assert.ok(dispatched.deadlineMs<=Date.now()+60000);
 abort.abort();await assert.rejects(active);assert.equal(f.calls.length,4);assert.equal(f.calls[2].input.runtimeSessionId,f.calls[3].input.runtimeSessionId);
 await assert.rejects(port.transform(input));assert.equal(f.calls.length,4);
});
