/** FINITE86: the REAL generation/run hierarchy preparation exercised with an inert low-level cgroup port. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareHostHierarchy,prepareRunParent,releaseOwnedHierarchy,generationRoot,runParent} from './hierarchy.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {nativeProcessingConfig} from './config.mjs';

const ENV={MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'10.0.0.5',MERI_NATIVE_PROCESSING_CONTROL_PORT:'9443',
 MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.meri.internal',
 MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64),
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/k',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/c',MERI_NATIVE_PROCESSING_TLS_CA:'/run/a',MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY:'/run/ck',
 MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT:'/run/cc',MERI_NATIVE_PROCESSING_CONTROL_CA:'/run/ca2',
 MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),
 MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_IMAGE_DIGEST:`sha256:${'b'.repeat(64)}`,MERI_NATIVE_PROCESSING_HOST_ID:'00000000-0000-4000-8000-000000000007',
 MERI_NATIVE_PROCESSING_GENERATION:'3',MERI_NATIVE_PROCESSING_CONVERSATION_ID:'00000000-0000-4000-8000-000000000003',
 MERI_NATIVE_PROCESSING_TENANT_ID:'00000000-0000-4000-8000-000000000001',
 MERI_NATIVE_PROCESSING_INSTANCE_ID:'i-0123456789abcdef0',MERI_NATIVE_PROCESSING_BOOT_ID:'00000000-0000-4000-8000-000000000008',
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',
 MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:JSON.stringify({tenantId:'00000000-0000-4000-8000-000000000001',
  actorId:'00000000-0000-4000-8000-000000000002',conversationId:'00000000-0000-4000-8000-000000000003',
  runId:'00000000-0000-4000-8000-000000000004',attemptId:'00000000-0000-4000-8000-000000000005',
  workerId:'00000000-0000-4000-8000-000000000006',writerFence:1}),
 MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'};
const config=nativeProcessingConfig({env:ENV});
const root=generationRoot(config);

test('HIERARCHY: prepares the exact generation root with delegation and reports created inventory',async()=>{
 const port=makeInertHierarchyPort({boot:config.allocation.bootId});
 const record=await prepareHostHierarchy({config,port,supervisorPid:1234});
 assert.equal(record.path,root);
 assert.deepEqual(record.owned.map(entry=>entry.path),[root],'only the generation root is created under borrowed parents');
 assert.equal(record.owned[0].ino>0,true,'ownership pins the created inode');
 assert.equal(port.readFile(`${root}/cgroup.subtree_control`).trim(),'cpu memory pids');
 assert.equal(record.unavailable,false);
});

test('HIERARCHY: an already-present empty root is borrowed and never rewritten',async()=>{
 const port=makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true});
 const record=await prepareHostHierarchy({config,port,supervisorPid:1234});
 assert.deepEqual(record.owned,[],'an existing root is not owned by this invocation');
 assert.equal(port.readFile(`${root}/cgroup.subtree_control`).trim(),'cpu memory pids');
});

test('HIERARCHY: occupied, symlink and readback failures refuse without mutating foreign state',async()=>{
 await assert.rejects(prepareHostHierarchy({config,port:makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true,occupied:true,occupiedPath:root})}),e=>e.code==='HOST_HIERARCHY_OCCUPIED');
 const basePort=makeInertHierarchyPort({boot:config.allocation.bootId});
 const symlink={...basePort,lstat:path=>path==='/sys/fs/cgroup/meri'?{isDirectory:()=>true,isSymbolicLink:()=>true,uid:0}:basePort.lstat(path)};
 await assert.rejects(prepareHostHierarchy({config,port:symlink}),e=>e.code==='HOST_HIERARCHY_PATH_REFUSED');
 const broken=makeInertHierarchyPort({boot:config.allocation.bootId});
 const originalRead=broken.readFile.bind(broken);
 broken.readFile=path=>{if(path.endsWith('/cgroup.controllers'))throw Object.assign(Error('EIO'),{code:'EIO'});return originalRead(path);};
 await assert.rejects(prepareHostHierarchy({config,port:broken}),e=>e.code==='HOST_HIERARCHY_READBACK_UNKNOWN');
});

test('HIERARCHY: a foreign cgroup2 mount is refused before any effect',async()=>{
 await assert.rejects(prepareHostHierarchy({config,port:makeInertHierarchyPort({boot:config.allocation.bootId,mount:'/sys/fs/cgroup-foreign'})}),e=>e.code==='HOST_HIERARCHY_MOUNT_REFUSED');
});

test('RUN PARENT: creates only the canonical current-run parent and releases only what it created',async()=>{
 const port=makeInertHierarchyPort({boot:config.allocation.bootId});
 const host=await prepareHostHierarchy({config,port,supervisorPid:1234});
 const run=await prepareRunParent({config,binding:config.binding,port});
 assert.equal(run.path,runParent(config,config.binding));
 assert.equal(run.created,true);
 const release=await releaseOwnedHierarchy({record:run,port});
 assert.deepEqual([...release.removed],[run.path]);
 assert.deepEqual([...release.unknown],[]);
 const hostRelease=await releaseOwnedHierarchy({record:host,port});
 assert.deepEqual([...hostRelease.removed],[host.path]);
});

test('RUN PARENT: a borrowed occupied parent is refused and never removed',async()=>{
 const port=makeInertHierarchyPort({boot:config.allocation.bootId,existingHost:true});
 port.mkdir(runParent(config,config.binding));
 port.nodes.get(runParent(config,config.binding)).enabled='cpu memory pids';
 port.nodes.get(runParent(config,config.binding)).procs='4242'+String.fromCharCode(10);
 await assert.rejects(prepareRunParent({config,binding:config.binding,port}),e=>e.code==='HOST_HIERARCHY_OCCUPIED');
 assert.equal(port.lstat(runParent(config,config.binding)).isDirectory(),true,'the foreign parent remains untouched');
});
