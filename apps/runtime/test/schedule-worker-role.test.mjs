/** Schedule-worker role registration: configuration and executable entry only. No poller, listener, connection or secret read starts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main} from '../cli.mjs';
import {validateConfiguration} from '../config.mjs';
import {versions} from '../../control/conversations/test/application-fixture.mjs';

const missing=join(tmpdir(),'meri-schedule-role-absent');
function configuration(){
 return {version:1,profile:'isolated-preview',sourceEnabled:false,versions,limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
  http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},
  temporal:{address:'temporal.synthetic.invalid:7233',namespace:'synthetic',taskQueue:'meri-schedules',tls:{caFile:join(missing,'ca'),certFile:join(missing,'cert'),keyFile:join(missing,'key')}},
  scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1},database:{connectionFile:join(missing,'database')}};
}

const native=()=>({origin:'https://control.synthetic.invalid',capabilityFile:join(missing,'capability'),loopback:false,maxResponseBytes:131072});
/** Core's unattended-firing pin (routines-configuration.mjs): a syntactically valid Ed25519 public JWK, never key material. */
const pin={issuer:'https://core.synthetic.invalid/meri-routines',kid:'routine-fire-1',publicKey:{kty:'OKP',crv:'Ed25519',x:'11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo'}};
const routines=()=>({enabled:true,core:{origin:'https://core.synthetic.invalid',serviceSecretFile:join(missing,'routines-secret'),unattendedGrant:pin}});

test('schedule-worker configuration is its own closed role: optional native client and firing pin, canonical schedule settings, no token writer',()=>{
 const valid=validateConfiguration(configuration(),'schedule-worker');assert.equal(valid.scheduledDispatch.enabled,true);
 const {database:ignored,...pooled}=configuration();assert.doesNotThrow(()=>validateConfiguration(pooled,'schedule-worker'));
 // Lane B3: the worker may declare its native client to control's occurrence operations and the routines firing pin (B2); both stay closed.
 assert.doesNotThrow(()=>validateConfiguration({...configuration(),native:native(),routines:routines()},'schedule-worker'));
 for(const mutate of [
  c=>{c.native={...native(),preparedKickoff:true};},c=>{c.native={...native(),origin:'http://control.synthetic.invalid'};},c=>{c.native={...native(),capabilityFile:'relative/capability'};},
  c=>{c.routines={enabled:'yes'};},c=>{c.routines={...routines(),task:{taskId:'33333333-3333-4333-8333-333333333333',version:1}};},c=>{c.routines={enabled:true,core:{origin:'https://core.synthetic.invalid',serviceSecretFile:join(missing,'routines-secret')}};},
  c=>{c.sourceEnabled=true;},c=>{c.scheduledDispatch.enabled=false;},c=>{c.scheduledDispatch.conversationTaskQueue=c.temporal.taskQueue;},
  c=>{c.scheduledDispatch.maxConcurrentActivities=11;},c=>{delete c.scheduledDispatch;},c=>{delete c.versions;},c=>{c.database={connectionFile:'relative/database'};},
  c=>{c.temporal.tokenWriter={enabled:true};},c=>{c.userPreferences={enabled:false};},c=>{c.sessions={mode:'process-local',replicas:1,maxSessions:1,maxTtlMs:1000};},c=>{c.tenantSettings={enabled:true};},
 ]){const c=configuration();mutate(c);assert.throws(()=>validateConfiguration(c,'schedule-worker'));}
});

test('schedule settings are not admitted by any other role; the routine task identity is control\'s alone',()=>{
 for(const role of ['control','temporal-worker','conversation-runner'])assert.throws(()=>validateConfiguration({...configuration(),native:native()},role));
 assert.throws(()=>validateConfiguration({...configuration(),routines:{enabled:true,task:{taskId:'33333333-3333-4333-8333-333333333333',version:1}}},'schedule-worker'),/ROUTINES_CONFIGURATION/u);
});

test('bare CLI schedule-worker refuses as unavailable without trusted owners; the product preview refuses the role without the firing pin, native client and database',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-schedule-role-')),file=join(directory,'schedule.json'),previous=process.env.MERI_PRODUCT_PREVIEW_REQUIRED,write=process.stderr.write,out=process.stdout.write;
 let diagnostic='',stdout='';
 try{
  await writeFile(file,JSON.stringify(configuration()));
  process.stderr.write=value=>{diagnostic+=value;return true;};process.stdout.write=value=>{stdout+=value;return true;};
  delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;
  assert.equal(await main(['schedule-worker','--config',file]),3);assert.equal(diagnostic,'RUNTIME_UNAVAILABLE\n');assert.equal(stdout,'');
  diagnostic='';process.env.MERI_PRODUCT_PREVIEW_REQUIRED='1';
  assert.equal(await main(['schedule-worker','--config',file]),2);assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');assert.equal(stdout,'');
  for(const partial of [{routines:routines()},{routines:routines(),native:native()},{routines:{enabled:true,core:{origin:'https://core.synthetic.invalid',serviceSecretFile:join(missing,'routines-secret'),cancellationProof:{...pin,kid:'routine-cancel-1',publicKey:{...pin.publicKey,x:'hv0D4pz9N0ZQk8mo0z7l4t3Mvi6wW1a3xKk1n2wQ6l0'}}}},native:native()},{routines:routines(),native:{...native(),origin:'http://127.0.0.1:8082',loopback:true}}]){
   const {database:_,...c}=configuration();await writeFile(file,JSON.stringify({...c,...partial,...(partial.native?.loopback?{database:configuration().database}:{})}));
   diagnostic='';assert.equal(await main(['schedule-worker','--config',file]),2,JSON.stringify(partial));assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
  }
  // With the pin, the native client and the database file the preview starts the service, whose owner factory needs the secret files:
  // the refusal is the service's own (no poller, listener or connection), proving the composition is reached without any resource.
  await writeFile(file,JSON.stringify({...configuration(),routines:routines(),native:native()}));
  diagnostic='';assert.equal(await main(['schedule-worker','--config',file]),3);assert.equal(diagnostic,'RUNTIME_UNAVAILABLE\n');assert.equal(stdout,'');
 }finally{
  process.stderr.write=write;process.stdout.write=out;
  if(previous===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=previous;
  await rm(directory,{recursive:true,force:true});
 }
});
