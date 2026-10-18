import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createBrowserRunLifecycle,BROWSER_CLEANUP_SCHEMA} from '../lifecycle.mjs';
import {prepareBrowserRun,grantBrowserEgress} from '../runtime.mjs';
import {createEgressControl} from '../egress-control.mjs';
import {binding,enabledPolicy,openFragment,installation,sourceScopes,recorders,clock} from './fixtures.mjs';
/** A real temporary conversation workspace with browser state in it; removed in `finally`. */
async function within(fn){
 const root=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-life-'))),cwd=join(root,binding.conversationId);
 for(const d of ['profile','home','output'])await mkdir(join(cwd,'.browser',d),{recursive:true});
 await writeFile(join(cwd,'.browser','profile','Cookies'),'synthetic');
 try{await fn(cwd);}finally{await rm(root,{recursive:true,force:true});}
}
const gone=async path=>{try{await access(path);return false;}catch{return true;}};
/** Scripted host: records the order of cleanup steps; each step's answer is configurable. */
function host({revoke={revoked:true},exit={exited:true}}={}){
 const steps=[];
 return {steps,egress:{async revoke(request){steps.push(['revoke',request]);if(revoke instanceof Error)throw revoke;return revoke;},async grant(grant){steps.push(['grant',grant.policySha256]);return {granted:true,policySha256:grant.policySha256};}},
  processes:{async waitForExit(request){steps.push(['exit',request]);if(exit instanceof Error)throw exit;return typeof exit==='function'?exit():exit;}}};
}
test('every outcome revokes egress, waits for process exit, then removes the profile and verifies it is gone',()=>within(async cwd=>{
 for(const outcome of ['ended','failed','cancelled']){
  await mkdir(join(cwd,'.browser','profile'),{recursive:true});
  const {cap}=openFragment({cwd}),h=host(),life=createBrowserRunLifecycle({fragment:cap,binding,cwd,egress:h.egress,processes:h.processes,now:Date.now});
  const receipt=await life.settle({outcome});
  assert.deepEqual(receipt,{schema:BROWSER_CLEANUP_SCHEMA,binding,outcome,activation:'open',egress:'done',process:'done',profile:'done'});
  assert.deepEqual(h.steps.map(s=>s[0]),['revoke','exit'],outcome);assert.equal(h.steps[0][1].policySha256,cap.policySha256);assert.equal(h.steps[1][1].profile,join(cwd,'.browser','profile'));
  assert.equal(await gone(join(cwd,'.browser')),true,outcome);
  assert.equal(await life.settle({outcome:'failed'}),receipt,'idempotent: settled once');
 }
}));
test('an unconfirmed process exit keeps the profile and reports UNKNOWN; a failed revocation never skips process wait or disposal',()=>within(async cwd=>{
 for(const exit of [{exited:false},new Error('host unreachable'),()=>new Promise(()=>{})]){
  const {cap}=openFragment({cwd}),h=host({exit}),life=createBrowserRunLifecycle({fragment:cap,binding,cwd,egress:h.egress,processes:h.processes,now:Date.now,cleanupMs:50});
  await assert.rejects(life.settle({outcome:'failed'}),e=>e.code==='BROWSER_CLEANUP_UNKNOWN'&&e.receipt.process==='unknown'&&e.receipt.profile==='unknown'&&e.receipt.egress==='done');
  assert.equal(await gone(join(cwd,'.browser','profile','Cookies')),false,'never removed under a possibly running browser');
 }
 const {cap}=openFragment({cwd}),h=host({revoke:new Error('control down')}),life=createBrowserRunLifecycle({fragment:cap,binding,cwd,egress:h.egress,processes:h.processes,now:Date.now});
 await assert.rejects(life.settle({outcome:'cancelled'}),e=>e.code==='BROWSER_CLEANUP_UNKNOWN'&&e.receipt.egress==='unknown'&&e.receipt.process==='done'&&e.receipt.profile==='done');
 assert.equal(await gone(join(cwd,'.browser')),true);
}));
test('a held or disabled fragment started nothing: cleanup only verifies that no browser state remains',()=>within(async cwd=>{
 const port={async policy(){return enabledPolicy();},installation,sourceScopes,artifacts:recorders().artifactPort,receipts:recorders().receiptPort};
 const run=await prepareBrowserRun({port,binding,cwd,deadlineMs:clock()+60000,now:clock});
 assert.equal(run.fragment.activation,'held');assert.equal(run.status.activation,'held');assert.equal(run.status.capability,'enabled');
 assert.deepEqual(await run.settle({outcome:'ended'}),{schema:BROWSER_CLEANUP_SCHEMA,binding,outcome:'ended',activation:'held',egress:'not-applicable',process:'not-applicable',profile:'done'});
 assert.equal(await gone(join(cwd,'.browser')),true,'stale state from an earlier run is removed');
 const off=await prepareBrowserRun({port:{...port,async policy(){return {enabled:false};}},binding,cwd,deadlineMs:clock()+1,now:clock});
 assert.equal(off.status.capability,'disabled');assert.equal((await off.settle({outcome:'failed'})).activation,'not-applicable');
 await assert.rejects(run.settle({outcome:'paused'}),e=>e.code==='BROWSER_CONFIGURATION','closed outcome vocabulary');
 await assert.rejects(createBrowserRunLifecycle({binding,cwd,now:clock}).settle({outcome:'paused'}),e=>e.code==='BROWSER_CONFIGURATION');
 assert.throws(()=>createBrowserRunLifecycle({fragment:openFragment({cwd}).cap,binding,cwd,now:clock}),e=>e.code==='BROWSER_CONFIGURATION','an open fragment needs the host ports');
 await assert.rejects(prepareBrowserRun({port:{},binding,cwd,deadlineMs:1,now:clock}),e=>e.code==='BROWSER_CONFIGURATION');
}));
test('the open path installs a grant the host control accepts, bound to the fragment policy; a refused grant settles cleanup first',()=>within(async cwd=>{
 const {cap}=openFragment({cwd}),h=host(),life=createBrowserRunLifecycle({fragment:cap,binding,cwd,egress:h.egress,processes:h.processes,now:Date.now});
 const grant=await grantBrowserEgress({fragment:cap,egress:h.egress,binding,deadlineMs:clock()+60000,lifecycle:life});
 assert.equal(grant.policySha256,cap.policySha256);assert.deepEqual(h.steps,[['grant',cap.policySha256]]);
 const control=createEgressControl({grant:JSON.parse(JSON.stringify(grant)),resolve:async()=>['93.184.215.14'],now:clock});
 assert.equal((await control.admit({kind:'navigation',url:'https://records.example/'})).ok,true);
 for(const ack of [{granted:false,policySha256:cap.policySha256},{granted:true,policySha256:'0'.repeat(64)},new Error('control down')]){
  const {cap:c}=openFragment({cwd}),k=host(),l=createBrowserRunLifecycle({fragment:c,binding,cwd,egress:k.egress,processes:k.processes,now:Date.now});
  const egress={...k.egress,async grant(){if(ack instanceof Error)throw ack;return ack;}};
  await assert.rejects(grantBrowserEgress({fragment:c,egress,binding,deadlineMs:clock()+60000,lifecycle:l}),e=>e.code==='BROWSER_EGRESS_GRANT_REFUSED'||e.message==='control down');
  assert.deepEqual(k.steps.map(s=>s[0]),['revoke','exit'],'cleanup settled before rethrow');
 }
 await mkdir(join(cwd,'.browser','profile'),{recursive:true});
 await writeFile(join(cwd,'.browser','profile','Cookies'),'synthetic');
 const {cap:uncertain}=openFragment({cwd}),lost=host({revoke:new Error('revoke unknown'),exit:{exited:false}});
 const uncertainLife=createBrowserRunLifecycle({fragment:uncertain,binding,cwd,egress:lost.egress,processes:lost.processes,now:Date.now});
 const lostAck=new Error('grant acknowledgement lost');
 await assert.rejects(grantBrowserEgress({fragment:uncertain,egress:{...lost.egress,async grant(){throw lostAck;}},binding,deadlineMs:clock()+60000,lifecycle:uncertainLife}),
  e=>e.code==='BROWSER_CLEANUP_UNKNOWN'&&e.cause===lostAck&&e.receipt.egress==='unknown'&&e.receipt.process==='unknown'&&e.receipt.profile==='unknown');
 assert.deepEqual(lost.steps.map(s=>s[0]),['revoke','exit']);
 assert.equal(await gone(join(cwd,'.browser','profile','Cookies')),false,'unconfirmed exit retains the profile for host destruction');
}));
