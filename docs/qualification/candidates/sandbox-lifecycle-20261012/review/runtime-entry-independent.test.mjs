// Traverse the actual runtime->supervisor entry using only fake process ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_SANDBOX_REPO;
const {runProbeScript,runQualificationChildren}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/runtime.mjs`));
function ports(plans){
 const acquired=[];const killed=[];const closed=new Set();
 return {acquired,killed,options:{deadlineMs:15,graceMs:15,detached:true,
  spawnFn:(command,args)=>{
   const plan=plans[acquired.length];assert.ok(plan,'unexpected additional child');
   const c=new EventEmitter();c.pid=424242+acquired.length;c.stdout=new EventEmitter();c.stderr=new EventEmitter();
   c.kill=()=>{throw Error('no native kill');};acquired.push({c,script:args[0]});
   setImmediate(()=>{
    if(plan.stderr)c.stderr.emit('data',Buffer.alloc(plan.stderr,120));
    if(plan.error)c.emit('error',Error('synthetic error'));
    if(plan.stdout!==undefined)c.stdout.emit('data',Buffer.from(plan.stdout));
    if(plan.close!==false){closed.add(c);c.emit('close',plan.status??0,plan.signal??null);}
   });return c;
  },groupKill:c=>{assert.ok(acquired.some(x=>x.c===c));killed.push(c);return true;},
  probeGroup:c=>{const index=acquired.findIndex(x=>x.c===c);assert.ok(index>=0);return plans[index].unknown?undefined:!closed.has(c);}
 }};
}

test('actual runtime awaits browser then independent artifact probe after confirmed clean semantic failure',async()=>{
 const p=ports([{stdout:'{"ok":false}',status:1},{stdout:'{"ok":true}'}]);
 const result=await runQualificationChildren(p.options);
 assert.equal(p.acquired.length,2);assert.ok(p.acquired[0].script.endsWith('/browser.mjs'));assert.ok(p.acquired[1].script.endsWith('/artifacts.mjs'));
 assert.equal(result[0].status,'fail');assert.equal(result[0].cleanupConfirmed,true);assert.equal(result[1].status,'pass');
});

test('unknown prior group cleanup refuses the next actual child even with apparently good stdout',async()=>{
 const p=ports([{stdout:'{"ok":true}',unknown:true}]);const result=await runQualificationChildren(p.options);
 assert.equal(p.acquired.length,1);assert.equal(result[0].status,'fail');assert.equal(result[0].cleanupConfirmed,false);
 assert.equal(result[1].notRun,true);assert.match(result[1].detail,/NOT-RUN|HOLD/);assert.equal(result[1].status,'fail');
});

test('no close after timeout cannot start a next probe',async()=>{
 const p=ports([{stdout:'{"ok":true}',close:false}]);const result=await runQualificationChildren(p.options);
 assert.equal(p.acquired.length,1);assert.equal(result[0].status,'fail');assert.equal(result[0].cleanupConfirmed,false);assert.equal(result[1].notRun,true);
});

for(const [name,plan] of [
 ['signal',{stdout:'{"ok":true}',signal:'SIGKILL'}],
 ['stderr overflow',{stdout:'{"ok":true}',stderr:65537}],
 ['child error',{stdout:'{"ok":true}',error:true}],
])test(`runtime propagates ${name} failure despite good structured output and confirmed cleanup`,async()=>{
 const p=ports([plan,{stdout:'{"ok":true}'}]);const result=await runQualificationChildren(p.options);
 assert.equal(result[0].cleanupConfirmed,true);assert.equal(result[0].status,'fail');assert.equal(p.acquired.length,2);assert.equal(result[1].status,'pass');
});

test('runtime facade preserves fixed entrypoint allowlist before any spawn',async()=>{
 const p=ports([]);const result=await runProbeScript('../arbitrary.mjs',{...p.options,name:'injected'});
 assert.equal(p.acquired.length,0);assert.equal(result.status,'fail');assert.equal(result.cleanupConfirmed,false);
});

test('already-aborted runtime sequence starts no probe and marks continuation not run',async()=>{
 const p=ports([]);const controller=new AbortController();controller.abort();const result=await runQualificationChildren({...p.options,signal:controller.signal});
 assert.equal(p.acquired.length,0);assert.equal(result[0].status,'fail');assert.equal(result[1].notRun,true);
});
