// Parent integration proof: real startControl/assembleControl/uploads family/retention over the SAME declaration
// shape the preview control serves (sourceEnabled, retention, artifacts and uploads.native.agentcore). Only SQL, S3,
// Temporal, candidate transport and listener transport are scripted. No network, no AWS SDK client, no provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {startControl,assembleControl} from '../control.mjs';
import {validateConfiguration} from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {createProductPortsFactory} from '../product-ports/index.mjs';
import {uploadsFamily} from '../product-ports/uploads.mjs';
import {documentsFamily} from '../product-ports/documents.mjs';
import {UPLOAD_NATIVE_UNAVAILABLE_EVENT} from '../uploads/control-lifecycle.mjs';
import {binding,scopes,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const DIGEST='sha256:'+'9'.repeat(64);
/** The live control declaration, minus secrets: the uploads family is gated by sourceEnabled/retention/artifacts, and the
 * inspection is the remote AgentCore port named by the existing `agentcore` runtime declaration. */
function liveLikeConfiguration(){
 const c=structuredClone(agentcoreControlFixture().configuration);
 c.sourceEnabled=true;c.retention={enabled:true};
 c.artifacts={enabled:true,region:'us-east-1',bucket:'synthetic-upload-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001'};
 c.uploads={native:{enabled:true,agentcore:{imageDigest:DIGEST}}};
 return c;
}
function fixture(t){
 const c=liveLikeConfiguration(),closed=[],listeners={},stderr=[];
 const state={assembly:null,context:null,extras:undefined,readiness:null,sql:[],leases:0,released:0,watermark:{sequence:0,entry_sha256:null}};
 t.mock.method(process.stderr,'write',chunk=>{stderr.push(String(chunk));return true;});
 const finish=name=>async()=>{closed.push(name);};
 async function query(sql,args=[]){
  state.sql.push(sql);
  if(sql.startsWith("SELECT to_regclass('meri_conversations.runs')"))return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs',initial_inputs:'initial_inputs'}]};
  if(sql.startsWith('SELECT name,to_regclass(name)'))return {rows:args[0].map(name=>({name,relation:name}))};
  if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}]};
  if(sql.startsWith('SELECT pg_advisory_')||sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL ')||['COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.retention_recovery_watermark')){state.watermark={sequence:args[0],entry_sha256:args[1]??null};return {rows:[{...state.watermark}]};}
  if(sql.startsWith('SELECT sequence,entry_sha256 FROM meri_conversations.retention_recovery_watermark'))return {rows:[{...state.watermark}]};
  assert.fail('unexpected SQL: '+sql);
 }
 const pool={query,async connect(){state.leases++;let released=false;return {query,release(error){assert.equal(error,undefined);assert.equal(released,false);released=true;state.released++;}};},end:finish('pool')};
 const connection={withDeadline:async(_at,fn)=>fn(),withAbortSignal:async(signal,fn)=>{signal.throwIfAborted();return fn();},workflowService:{async describeNamespace(){return {};}},close:finish('connection')};
 const identityContext={verifyIdentity:async()=>({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId:id(5),contextRevision:'synthetic',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000})};
 const candidate={execution:{authenticate(){assert.fail('no private execution');}},native:{async readiness(){},async call(){assert.fail('no native operation');}},productPorts:{identityContext},application:{handle:async()=>null},bindApplication(){},close:finish('candidate')};
 // Declared retention serves only over the documents family's ledger sink (as on the preview control); the ledger is
 // empty here. The uploads family constructs its own S3 ports without IO, so startup must never touch its client.
 const ledger={async send(command){if(command.constructor.name==='GetObjectCommand')throw Object.assign(Error('synthetic empty ledger'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});if(command.constructor.name==='GetBucketVersioningCommand')return {Status:'Enabled'};assert.fail('unexpected S3: '+command.constructor.name);}};
 const uploadsS3={async send(command){assert.fail('no upload S3 request during startup: '+command.constructor.name);}};
 const documents=documentsFamily({authority:{async resolve(){return null;}},executor:{execute(){assert.fail('no rendering');}},createS3Client:()=>ledger});
 const family=uploadsFamily({createS3Client:()=>uploadsS3});
 const inner=createProductPortsFactory({families:[['documents',documents],['uploads',context=>{state.context=context;return family(context);}]]});
 const productPortsFactory=(context,extras)=>{state.extras=extras;return inner(context,extras);};
 const owners={readMaterial:async path=>{if(path===c.database.connectionFile)return Buffer.from('postgresql://database.synthetic.invalid/meri?sslmode=verify-full');if(path===c.native.capabilityFile)return Buffer.from('synthetic-control-startup-only-long-credential');assert.fail('unexpected material read: '+path);},
  tls:async()=>({synthetic:true}),createPool:()=>pool,connect:async()=>connection,createClient:()=>({workflow:{start(){assert.fail('no dispatch');},getHandle(){assert.fail('no dispatch');}}}),startCandidate:async()=>candidate,
  assemble(options){state.assembly=assembleControl(options);return state.assembly;},
  listen:async options=>{const role=options.configuration.http.port===c.privateHttp.port?'private':'public';listeners[role]=options.application;state.readiness=options.readiness;return {address:{address:'127.0.0.1',port:options.configuration.http.port},close:finish(role)};}};
 const controller=new AbortController();
 return {c,state,closed,listeners,stderr,controller,start:()=>startControl(c,{testOwners:owners,productPortsFactory,signal:controller.signal})};
}
const initiate=credential=>new Request('https://control.synthetic.invalid/api/uploads/initiate',{method:'POST',headers:{'content-type':'application/json',...(credential?{authorization:'Bearer '+credential}:{})},body:'{}'});

test('the live-shaped AgentCore upload declaration composes the uploads family without the native-host allocation owners',async t=>{
 const f=fixture(t);
 assert.doesNotThrow(()=>validateConfiguration(f.c,'control'),'the declaration is the validated control shape the preview serves');
 const runtime=await f.start();
 try{
  // The mount is the remote port: nothing is missing, and there is no local snapshot for CONTROL to provision.
  assert.deepEqual(runtime.uploadNative.missing,[]);
  assert.deepEqual(runtime.uploadNative.provisioning(),{provisioned:false,reason:null,remote:true});
  // The mounted inspection reached the uploads family alone, as its per-family context extension.
  assert.equal(typeof f.state.extras?.uploads?.uploadsInspection?.inspect,'function');
  assert.equal(f.state.context.uploadsInspection,f.state.extras.uploads.uploadsInspection);
  assert.deepEqual(Object.keys(f.state.extras),['uploads']);
  // Product readiness names the custody owner composed, and its table joins the startup schema check.
  const readiness=await f.state.readiness({signal:new AbortController().signal});
  assert.deepEqual(readiness.product.owners.find(owner=>owner.name==='uploads.custody'),{name:'uploads.custody',state:'composed'});
  assert.deepEqual(f.state.assembly.uploadTables,['meri_uploads.originals']);
  // No native-host allocation reader exists for a remote inspection, so no false unavailable event is reported.
  assert.deepEqual(f.stderr.filter(line=>line.includes(UPLOAD_NATIVE_UNAVAILABLE_EVENT)),[]);
  // The public upload routes are the composed family's own: an unauthenticated initiate is the family's access refusal,
  // never the 503 UPLOAD_UNAVAILABLE the control answers when the family is absent.
  const unauthenticated=await f.listeners.public.handle(initiate());
  assert.equal(unauthenticated.status,403);assert.deepEqual(await unauthenticated.json(),{error:{code:'UPLOAD_ACCESS_DENIED',outcome:'READ_UNAVAILABLE'}});
  assert.equal((await f.listeners.private.handle(initiate())).status,404,'upload routes are public-only');
 }finally{await runtime.close();}
 assert.equal(f.state.leases,f.state.released);assert.deepEqual([...f.closed].sort(),['candidate','connection','pool','private','public']);
});

test('with source disabled the same mount leaves the family honestly absent and the route answers 503',async t=>{
 const f=fixture(t);f.c.sourceEnabled=false;
 const runtime=await f.start();
 try{
  assert.deepEqual(runtime.uploadNative.missing,[]);
  const readiness=await f.state.readiness({signal:new AbortController().signal});
  assert.deepEqual(readiness.product.owners.find(owner=>owner.name==='uploads.custody'),{name:'uploads.custody',state:'disabled'});
  assert.deepEqual(f.state.assembly.uploadTables,[]);
  const absent=await f.listeners.public.handle(initiate());
  assert.equal(absent.status,503);assert.equal((await absent.json()).error.code,'UPLOAD_UNAVAILABLE');
 }finally{await runtime.close();}
});
