// Inert contract fixtures for the pure observation/parser functions shared by the renderer probe and the native upload
// qualifier. No real filesystem, child process, sandbox, network or credential state is read: every port is injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CGROUP_MOUNT,parseCgroupPath,parseCgroupMount,parseCgroupMountRoot,cgroupLevels,cgroupRelativePath,
 boundState,resolveEffectiveCgroup,combineCgroupBounds,limitState,parseProcLimits,readBoundedInput,observeProbeCgroup
} from '../renderer-probe-observation.mjs';
import {evaluateRendererSandbox} from '../renderer-qualification.mjs';

test('cgroup path and mount parsing keep the established fail-closed distinctions',()=>{
 assert.equal(parseCgroupPath('0::/a/b\n'),'/a/b');
 assert.equal(parseCgroupPath('0::/a/../b\n'),null,'traversal is refused');
 assert.equal(parseCgroupPath('0::/a\r\n'),null,'a raw CR is a path byte and is refused');
 assert.equal(parseCgroupPath('1:memory:/a\n'),null,'v1-only layouts are unresolved');
 const mount='36 35 0:30 /a /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 assert.equal(parseCgroupMountRoot(mount),'/a');
 assert.equal(parseCgroupMountRoot('36 35 0:30 / /sys/fs/cgroup rw - tmpfs tmpfs rw\n'),null,'the selected mount must be cgroup2');
 assert.equal(parseCgroupMountRoot('36 35 0:30 /\\041 /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n'),null,'unsupported mountinfo escape fails closed');
 assert.equal(cgroupRelativePath('/a/b','/a'),'/b');
 assert.equal(cgroupRelativePath('/x','/a'),null,'an unrelated branch is refused');
 assert.equal(cgroupLevels('/b','/sys/fs/cgroup').length,2);
});

test('max, literal zero, finite, missing and malformed states stay distinct',()=>{
 assert.equal(boundState('max').kind,'max');
 assert.equal(boundState('0').kind,'zero');
 assert.equal(boundState('1073741824').kind,'finite');
 assert.equal(boundState('-1').kind,'missing','a v1 sentinel is invalid in v2');
 assert.equal(boundState('max nonsense',{controller:'cpu'}).kind,'missing');
 assert.equal(boundState('10000 0',{controller:'cpu'}).kind,'missing');
 assert.equal(boundState('10000 500',{controller:'cpu'}).kind,'missing');
 assert.equal(boundState('max 100000',{controller:'cpu'}).kind,'max');
});

test('effective cgroup picks the strictest visible ancestor and refuses unrelated branches',()=>{
 const read=map=>path=>map[path]??null;
 const base={
  [CGROUP_MOUNT+'/cgroup.controllers']:'',[CGROUP_MOUNT+'/memory.max']:'max',[CGROUP_MOUNT+'/pids.max']:'max',
  [CGROUP_MOUNT+'/cpu.max']:'max 100000',
  [CGROUP_MOUNT+'/b/cgroup.controllers']:'',[CGROUP_MOUNT+'/b/memory.max']:'1073741824',[CGROUP_MOUNT+'/b/pids.max']:'64',
  [CGROUP_MOUNT+'/b/cpu.max']:'50000 100000'
 };
 const resolved=resolveEffectiveCgroup({cgroupPath:'/b',mountRoot:'/',read:read(base)});
 assert.deepEqual({memoryMax:resolved.memoryMax,pidsMax:resolved.pidsMax,cpuMax:resolved.cpuMax},
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'});
 const unrelated={...base,[CGROUP_MOUNT+'/b/memory.max']:'max'};
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/b',mountRoot:'/a',read:read(unrelated)}),null);
});

test('host combination fills only a present-but-unlimited child value',()=>{
 const host={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'};
 assert.deepEqual(combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'},host),host);
 assert.deepEqual(combineCgroupBounds({memoryMax:null,pidsMax:null,cpuMax:null},host),
  {memoryMax:null,pidsMax:null,cpuMax:null},'missing child values are never rescued');
 assert.deepEqual(combineCgroupBounds({memoryMax:'0',pidsMax:'64',cpuMax:'50000 100000'},host),
  {memoryMax:'0',pidsMax:'64',cpuMax:'50000 100000'},'literal zero stays strictest');
});

test('exact process-limit states never round a 20-digit value',()=>{
 assert.deepEqual(limitState('unlimited'),{kind:'max'});
 assert.deepEqual(limitState('1048576'),{kind:'finite',value:1048576});
 assert.deepEqual(limitState('9223372036854775807'),{kind:'unsupported',digits:19},'unsafe values stay exact/unsupported');
 assert.deepEqual(limitState('-1'),{kind:'malformed'});
 const table=[
  'Max file size        1048576              1048576              bytes',
  'Max open files       1024                 4096                 files',
  'Max processes        64                   64                   processes'
 ].join('\n');
 const parsed=parseProcLimits(table);
 assert.equal(parsed.MaxFileSize.soft.value,1048576);
 assert.equal(parsed.MaxOpenFiles.hard.value,4096);
 assert.equal(parsed.MaxProcesses.soft.value,64);
 const garbage=parseProcLimits('garbage');
 assert.deepEqual(garbage,{MaxFileSize:null,MaxOpenFiles:null,MaxProcesses:null},'missing labels stay null');
 const missing=parseProcLimits('Max file size 1\n');
 assert.equal(missing.MaxOpenFiles,null);
});

test('bounded stdin consumes an exact cap and reports empty, over-cap and read error',()=>{
 const chunkReader=(chunks,fail=false)=>{let index=0;return (fd,buffer,offset,length)=>{if(fail)throw Error('read');const chunk=chunks[index++];
  if(chunk===undefined)return 0;const bytes=Buffer.from(chunk);bytes.copy(buffer,offset,0,Math.min(bytes.length,length));return Math.min(bytes.length,length);};};
 const empty=readBoundedInput({readSync:chunkReader([])});
 assert.deepEqual({state:empty.state,bytes:empty.bytes},{state:'empty',bytes:0});
 const ok=readBoundedInput({readSync:chunkReader([Buffer.from('{"a":1}')]),chunkSize:4096});
 assert.equal(ok.state,'ok');assert.equal(ok.text,'{"a":1}');
 const over=readBoundedInput({readSync:chunkReader([Buffer.alloc(4096,65),Buffer.alloc(4096,66)]),maxBytes:5000,chunkSize:4096});
 assert.equal(over.state,'over-cap');assert.ok(over.bytes>5000,'over-cap stops once the cap is crossed');
 const failed=readBoundedInput({readSync:chunkReader([],true)});
 assert.equal(failed.state,'read-error');
});

test('probe cgroup view refuses changed identity and failed mapping, and keeps stable v1/v2',()=>{
 const mount='36 35 0:30 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 const mountB='36 35 0:31 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 const finiteRoot={[CGROUP_MOUNT+'/memory.max']:'1073741824',[CGROUP_MOUNT+'/pids.max']:'64',[CGROUP_MOUNT+'/cpu.max']:'50000 100000',
  [CGROUP_MOUNT+'/cgroup.controllers']:''};
 const v2={...finiteRoot,'/proc/self/cgroup':'0::/b\n','/proc/self/mountinfo':mount,
  [CGROUP_MOUNT+'/b/cgroup.controllers']:'',[CGROUP_MOUNT+'/b/memory.max']:'1073741824',
  [CGROUP_MOUNT+'/b/pids.max']:'64',[CGROUP_MOUNT+'/b/cpu.max']:'50000 100000'};
 const read=map=>path=>map[path]??null;
 const bounded=cg=>evaluateRendererSandbox({schema:'meri-renderer-sandbox-observation/1',platform:'linux',cgroup:cg}).sandbox.boundedResources;
 const mapped=observeProbeCgroup({read:read(v2)});
 assert.equal(mapped.source,'cgroup2');assert.equal(mapped.membershipResolved,true);
 assert.equal(mapped.memoryMax,'1073741824');assert.equal(bounded(mapped),true,'stable mapped v2 stays finite');
 const v1={'/proc/self/cgroup':'1:memory:/legacy\n','/proc/self/mountinfo':'',
  [CGROUP_MOUNT+'/memory/memory.limit_in_bytes']:'1073741824',
  [CGROUP_MOUNT+'/pids/pids.max']:'64',[CGROUP_MOUNT+'/cpu/cpu.cfs_quota_us']:'50000'};
 const fallback=observeProbeCgroup({read:read(v1)});
 assert.equal(fallback.source,'v1-fallback');assert.equal(fallback.membershipResolved,false);
 assert.equal(fallback.memoryMax,'1073741824');assert.equal(bounded(fallback),true,'genuine stable v1 keeps its fallback');
 const sequence=(map,key,values)=>{const counts=new Map();return path=>{const n=counts.get(path)??0;counts.set(path,n+1);
  if(path===key)return values[Math.min(n,values.length-1)];return map[path]??null;};};
 const changed=observeProbeCgroup({read:sequence(v2,'/proc/self/cgroup',['0::/b\n','0::/c\n'])});
 assert.equal(changed.identityChanged,true);assert.equal(changed.membershipResolved,false);
 assert.deepEqual([changed.memoryMax,changed.pidsMax,changed.cpuMax],[null,null,null],'finite root files cannot rescue a changed membership');
 assert.equal(changed.source,'identity-changed');assert.equal(bounded(changed),false);
 const remounted=observeProbeCgroup({read:sequence(v2,'/proc/self/mountinfo',[mount,mountB])});
 assert.equal(remounted.identityChanged,true);assert.deepEqual([remounted.memoryMax,remounted.pidsMax,remounted.cpuMax],[null,null,null]);
 assert.equal(bounded(remounted),false,'a changed mount identity cannot be rescued by finite fixed-root values');
 const unrelated=observeProbeCgroup({read:read({...finiteRoot,'/proc/self/cgroup':'0::/x\n','/proc/self/mountinfo':mount})});
 assert.equal(unrelated.source,'mapping-failed');assert.equal(unrelated.membershipResolved,false);assert.equal(unrelated.identityChanged,false);
 assert.deepEqual([unrelated.memoryMax,unrelated.pidsMax,unrelated.cpuMax],[null,null,null]);
 assert.equal(bounded(unrelated),false,'a failed cgroup2 mapping is not a stable v1 fallback');
 const noMount=observeProbeCgroup({read:read({...finiteRoot,'/proc/self/cgroup':'0::/b\n','/proc/self/mountinfo':''})});
 assert.equal(noMount.source,'mapping-failed');assert.equal(noMount.memoryMax,null);assert.equal(bounded(noMount),false);
 const membership=self=>observeProbeCgroup({read:path=>path==='/proc/self/cgroup'?self:(finiteRoot[path]??(path==='/proc/self/mountinfo'?mount:null))});
 for(const [label,self] of [['unreadable',null],['empty',''],['raw-CR-unified','0::/b\r\n'],
  ['malformed-v1','1:memory:relative\n'],['ambiguous-unified','0::/b\n0::/c\n']]){
  const view=membership(self);
  assert.deepEqual([view.memoryMax,view.pidsMax,view.cpuMax],[null,null,null],`${label} cannot use finite root values`);
  assert.equal(bounded(view),false,`${label} must not qualify in the renderer`);
 }
 const changedV1=observeProbeCgroup({read:(()=>{const values=['1:memory:/legacy\n','1:memory:/other\n'];const counts=new Map();return path=>{
  const n=counts.get(path)??0;counts.set(path,n+1);
  if(path==='/proc/self/cgroup')return values[Math.min(n,values.length-1)];return path==='/proc/self/mountinfo'?mount:(finiteRoot[path]??null);};})()});
 assert.equal(changedV1.source,'identity-changed');assert.equal(changedV1.identityChanged,true);
 assert.equal(changedV1.memoryMax,null);assert.equal(bounded(changedV1),false,'a changed v1 membership is not stable v1');
 for(const records of ['1:memory:/a\n1:memory:/b\n','1:memory:/a\n2:memory:/b\n']){
  const conflict=membership(records);
  assert.deepEqual([conflict.memoryMax,conflict.pidsMax,conflict.cpuMax],[null,null,null],'conflicting v1 records cannot use finite root values');
  assert.equal(conflict.source,'unknown');assert.equal(bounded(conflict),false,'a conflicting v1 collection is not stable v1');
 }
 let self='1:memory:/a\n',changedDuringValues=false;
 const during=observeProbeCgroup({read:path=>{
  if(path==='/proc/self/cgroup')return self;
  if(path==='/proc/self/mountinfo')return mount;
  if(path===CGROUP_MOUNT+'/memory.max'){self='1:memory:/b\n';changedDuringValues=true;}
  return finiteRoot[path]??null;
 }});
 assert.equal(changedDuringValues,true);assert.equal(during.identityChanged,true);
 assert.equal(during.source,'identity-changed');assert.equal(during.memoryMax,null);
 assert.equal(bounded(during),false,'a v1 change during fallback value reads is refused');
 const oldMount='36 35 0:30 / /sys/fs/cgroup rw - tmpfs tmpfs rw\n37 36 0:31 / /sys/fs/cgroup/memory rw - cgroup cgroup rw,memory\n';
 const newMount='46 35 0:40 / /sys/fs/cgroup rw - tmpfs tmpfs rw\n47 46 0:41 / /sys/fs/cgroup/memory rw - cgroup cgroup rw,memory\n';
 const v1values={[CGROUP_MOUNT+'/memory/memory.limit_in_bytes']:'1073741824',[CGROUP_MOUNT+'/pids/pids.max']:'64',
  [CGROUP_MOUNT+'/cpu/cpu.cfs_quota_us']:'50000'};
 let mountReads=0;
 const mountSwitch=observeProbeCgroup({read:path=>{
  if(path==='/proc/self/cgroup')return '1:memory:/a\n2:pids:/a\n3:cpu:/a\n';
  if(path==='/proc/self/mountinfo')return ++mountReads===1?oldMount:newMount;
  return v1values[path]??null;
 }});
 assert.equal(mountReads,2);assert.equal(mountSwitch.identityChanged,true);
 assert.equal(mountSwitch.source,'identity-changed');
 assert.deepEqual([mountSwitch.memoryMax,mountSwitch.pidsMax,mountSwitch.cpuMax],[null,null,null],
  'a v1 mount change across fallback reads cannot return held values');
 assert.equal(bounded(mountSwitch),false,'a v1 mount change must not qualify in the renderer');
});
