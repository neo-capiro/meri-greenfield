// Independent immutable Git-object comparison; imports only the inert canonical registry.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';
const source=process.argv[2]??'ea94aff840424843b4b6efbfc21fb9d195f7ff54';
const packet=process.argv[3]??'095ff4fc';
const root='docs/qualification/candidates/backend-execution-20261012/integration/';
const blob=(ref,path)=>execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:20*1024*1024});
const json=(ref,path)=>JSON.parse(blob(ref,path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[];
const check=(label,fn)=>{try{fn();checks.push({label,pass:true});}catch(e){checks.push({label,pass:false,error:e.message});}};
const same=(label,a,b)=>check(label,()=>assert.deepEqual(a,b));
const catPath='packages/contracts/retrieval-0.2/catalog.json';
const bindingPath='packages/contracts/retrieval-0.2/catalog-validation.mjs';
const before=json(base,catPath), after=json(source,catPath);
const repairs=json(packet,root+'raw-request-admission-before.json').rows;
const families=json(packet,root+'candidate-freezes.json');
const importBindings=async ref=>(await import('data:text/javascript;base64,'+blob(ref,bindingPath).toString('base64'))).CATALOG_OPERATION_BINDINGS;
const oldBindings=await importBindings(base), newBindings=await importBindings(source);
const cloneBinding=b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,typeof v==='function'?v.toString():v]));
const newMap=new Map(newBindings.map(b=>[b.id,b]));
same('raw repair set has 31 distinct IDs',new Set(repairs.map(r=>r.id)).size,31);
same('all 31 fixtures admitted by actual raw normalizer',repairs.filter(r=>r.normalizationSucceeded&&r.failure===null).length,31);
same('22 previous advertisements refused supported raw requests',repairs.filter(r=>!r.previousAdvertisementAdmittedRequest).length,22);
same('prior binding relative order',newBindings.filter(b=>oldBindings.some(o=>o.id===b.id)).map(b=>b.id),oldBindings.map(b=>b.id));
for(const b of oldBindings){
  const expected=cloneBinding(b), repair=repairs.find(r=>r.id===b.id);
  if(repair){same('old raw pin '+b.id,b.input,repair.before);expected.input=repair.after;}
  if(b.id==='query_action_items')expected.supersededBy='actions.query';
  if(b.id==='list_global_datasets')expected.dispatchProfile='dataset-metadata/1';
  same('prior binding exact fields/callbacks '+b.id,cloneBinding(newMap.get(b.id)),expected);
}
same('prior descriptor relative order',after.operations.filter(n=>before.operations.some(o=>o.operation.id===n.operation.id)).map(n=>n.operation.id),before.operations.map(o=>o.operation.id));
for(const old of before.operations){
  const expected=structuredClone(old), repair=repairs.find(r=>r.id===old.operation.id);
  if(repair)expected.inputSchema.id=expected.inputSchema.id.replace('#/$defs/'+repair.before,'#/$defs/'+repair.after);
  if(old.operation.id==='query_action_items'){
    expected.replacement={id:'actions.query',version:'0.2.0'};
    expected.limitations[0]='Historical scoped-only contract; actions.query is the reviewed full native transport successor. This original partial validator remains unchanged.';
    expected.limitations[1]='This scoped-only operation still refuses client-less listing; the successor declares tenant-only unscoped transport without establishing current access.';
  }
  same('prior descriptor exact fields '+old.operation.id,after.operations.find(n=>n.operation.id===old.operation.id),expected);
}
const added=newBindings.filter(b=>!oldBindings.some(o=>o.id===b.id));
same('13 new typed operations',added.length,13);
same('139 original identities/order',after.originals.map(o=>o.id),before.originals.map(o=>o.id));
for(const old of before.originals){
  const expected=structuredClone(old), binding=added.find(b=>b.nativeId===old.id);
  if(binding){same('newly mapped original previously pending '+old.id,old.state,'pending');expected.state='mapped';expected.replacement={id:binding.id,version:binding.version};}
  same('original scope and mapping '+old.id,after.originals.find(n=>n.id===old.id),expected);
}
same('scope and ledger counts',[after.originals.length,after.originals.filter(o=>o.disposition==='selected').length,after.originals.filter(o=>o.disposition==='deferred').length,after.originals.filter(o=>o.state==='mapped').length,after.originals.filter(o=>o.state==='pending').length,after.operations.length],[139,96,43,83,13,84]);
same('catalog identity metadata',{...after,originals:[],operations:[],catalogVersion:before.catalogVersion},{...before,originals:[],operations:[]});
same('catalog version',after.catalogVersion,'0.2.11');
same('all descriptors disabled',after.operations.filter(o=>o.handler===null&&o.availability==='unimplemented'&&o.qualification==='pending'&&o.retry.maxRetries===0).length,84);
same('no pending family packet',families.pending,[]);
same('no family source enablement',families.sourceEnabled,false);
for(const f of families.families){
  check('complete accepted pins '+f.group,()=>{assert.equal(f.verdict,'ACCEPT_SOURCE');for(const k of ['sourceCommit','authorPacketCommit','reviewCommit'])assert.match(f[k],/^[a-f0-9]{40}$/);});
  for(const suffix of ['.schema.json','-validation.mjs']){
    const path=`packages/contracts/retrieval-0.2/${f.group}${suffix}`;
    same('accepted source bytes '+path,sha(blob(source,path)),sha(blob(f.sourceCommit,path)));
  }
  same('schema packet digest '+f.group,sha(blob(source,`packages/contracts/retrieval-0.2/${f.group}.schema.json`)),f.schemaSha256);
  for(const d of f.dependencySchemas??[])same('dependency schema '+d.group,sha(blob(source,`packages/contracts/retrieval-0.2/${d.group}.schema.json`)),d.sha256);
}
for(const [path,pin] of [
 ['apps/gateway/dispatch/operation-context.mjs','ed307ab4d5653e3972fd82d8ebe3b54345a3ca4e'],
 ['apps/gateway/dispatch/read-result-envelope.mjs','ed307ab4d5653e3972fd82d8ebe3b54345a3ca4e'],
 ['apps/gateway/sources/dataset-metadata/handler.mjs','ed307ab4d5653e3972fd82d8ebe3b54345a3ca4e'],
 ['packages/contracts/commands-0.2/memory-propose-validation.mjs','2084f947ede709dfea0705bf2b67e62c3e929438'],
 ['packages/contracts/commands-0.2/memory-propose.schema.json','2084f947ede709dfea0705bf2b67e62c3e929438'],
 ...['handler.mjs','http-adapter.mjs','request-context.mjs'].map(p=>['apps/gateway/sources/memory-proposals/'+p,'4834dc4af368fe99675bd4fad3005e8b6b9d6c62'])
])same('accepted additional source '+path,sha(blob(source,path)),sha(blob(pin,path)));
const oldLife=blob(base,'apps/gateway/dispatch/dispatch-lifetime.mjs').toString();
const wrapper=blob(source,'apps/gateway/dispatch/dispatch-lifetime.mjs').toString();
const core=blob(source,'packages/runtime/operation-lifetime.mjs').toString();
const marker='export async function markBudgetUncertain';
same('markBudgetUncertain byte-identical',wrapper.slice(wrapper.indexOf(marker)),oldLife.slice(oldLife.indexOf(marker)));
const oldBody=oldLife.slice(oldLife.indexOf('  if (typeof now'),oldLife.indexOf(marker)).trim();
const newBody=core.slice(core.indexOf('  if (typeof now')).trim();
same('lifetime algorithm exact with injected error constructor',newBody,oldBody.replaceAll('new GatewayDenied(','errorFactory('));
same('shared core only EOF whitespace since original test source',core.trimEnd(),blob('37f84fcb3bf2d34ae59673b1644fac64f1ef798c','packages/runtime/operation-lifetime.mjs').toString().trimEnd());
const receipt=json(packet,root+'lifetime-shared.json');
same('original lifetime regression receipt successful',[receipt.exitCode,receipt.sourceDiffBytes,receipt.timedOut,receipt.ownedProcessGroupAbsent,receipt.ownedGroupKillRequired],[0,0,false,true,false]);
for(const stream of receipt.streams){const b=blob(packet,stream.path);same('lifetime stream '+stream.path,{bytes:b.length,sha256:sha(b)},{bytes:stream.bytes,sha256:stream.sha256});}
const lifetimeOutput=blob(packet,receipt.streams[0].path).toString();
check('lifetime raw all pass no skips',()=>{assert.match(lifetimeOutput,/(?:#|ℹ) fail 0/);assert.match(lifetimeOutput,/(?:#|ℹ) skipped 0/);});
const failures=checks.filter(c=>!c.pass);
console.log(JSON.stringify({scope:'IMMUTABLE_SOURCE_COMPARISON_NOT_RUNTIME',base,source,packet,checks:checks.length,passed:checks.length-failures.length,failures,lifetimeRawSummary:lifetimeOutput.slice(-350)},null,2));
process.exitCode=failures.length?1:0;
