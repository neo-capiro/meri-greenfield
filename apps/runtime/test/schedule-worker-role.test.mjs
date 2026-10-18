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

test('schedule-worker configuration is its own closed role: no native capability, canonical schedule settings, no token writer',()=>{
 const valid=validateConfiguration(configuration(),'schedule-worker');assert.equal(valid.scheduledDispatch.enabled,true);
 const {database:ignored,...pooled}=configuration();assert.doesNotThrow(()=>validateConfiguration(pooled,'schedule-worker'));
 for(const mutate of [
  c=>{c.native={origin:'https://native.synthetic.invalid',capabilityFile:join(missing,'capability'),loopback:false,maxResponseBytes:131072};},
  c=>{c.sourceEnabled=true;},c=>{c.scheduledDispatch.enabled=false;},c=>{c.scheduledDispatch.conversationTaskQueue=c.temporal.taskQueue;},
  c=>{c.scheduledDispatch.maxConcurrentActivities=11;},c=>{delete c.scheduledDispatch;},c=>{delete c.versions;},c=>{c.database={connectionFile:'relative/database'};},
  c=>{c.temporal.tokenWriter={enabled:true};},c=>{c.userPreferences={enabled:false};},c=>{c.sessions={mode:'process-local',replicas:1,maxSessions:1,maxTtlMs:1000};},
 ]){const c=configuration();mutate(c);assert.throws(()=>validateConfiguration(c,'schedule-worker'));}
});

test('schedule settings are not admitted by any other role',()=>{
 for(const role of ['control','temporal-worker','conversation-runner'])assert.throws(()=>validateConfiguration({...configuration(),native:{origin:'https://native.synthetic.invalid',capabilityFile:join(missing,'capability'),loopback:false,maxResponseBytes:131072}},role));
});

test('bare CLI schedule-worker refuses as unavailable without trusted owners, and the product preview refuses the role outright',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-schedule-role-')),file=join(directory,'schedule.json'),previous=process.env.MERI_PRODUCT_PREVIEW_REQUIRED,write=process.stderr.write,out=process.stdout.write;
 let diagnostic='',stdout='';
 try{
  await writeFile(file,JSON.stringify(configuration()));
  process.stderr.write=value=>{diagnostic+=value;return true;};process.stdout.write=value=>{stdout+=value;return true;};
  delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;
  assert.equal(await main(['schedule-worker','--config',file]),3);assert.equal(diagnostic,'RUNTIME_UNAVAILABLE\n');assert.equal(stdout,'');
  diagnostic='';process.env.MERI_PRODUCT_PREVIEW_REQUIRED='1';
  assert.equal(await main(['schedule-worker','--config',file]),2);assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');assert.equal(stdout,'');
 }finally{
  process.stderr.write=write;process.stdout.write=out;
  if(previous===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=previous;
  await rm(directory,{recursive:true,force:true});
 }
});
