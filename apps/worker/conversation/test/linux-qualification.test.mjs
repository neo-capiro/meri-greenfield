/** Lane 8 Linux qualification harness: verdict logic over scripted host ports (a Fargate-like host, a ready host and
 * each missing prerequisite), plus the real loopback egress matrix on this host. No namespace, SDK or network probe. */
import test from 'node:test';import assert from 'node:assert/strict';
import * as net from 'node:net';import * as http from 'node:http';
import {qualifyLinuxHost,parseProcStatus,diagnostic,egressLoopbackSelfTest,QUALIFICATION_SCHEMA} from '../sandbox-readiness/linux-qualification.mjs';
import {parseArguments} from '../sandbox-readiness/linux-qualification-cli.mjs';
import {startEgressProxy} from '../egress/proxy-server.mjs';
import {createBashEgressControl} from '../egress/bash-egress.mjs';
const BWRAP_EPERM='bwrap: No permissions to creating new namespace, likely because the kernel does not allow non-privileged user namespaces.\nmore';
/** Default Docker/containerd capability set (no CAP_SYS_ADMIN), seccomp filter mode, no_new_privs off. */
const FARGATE_STATUS='Name:\tnode\nNoNewPrivs:\t0\nSeccomp:\t2\nSeccomp_filters:\t1\nCapEff:\t0000000000000000\nCapBnd:\t00000000a80425fb\n';
const READY_STATUS='Name:\tnode\nNoNewPrivs:\t1\nSeccomp:\t0\nCapEff:\t0000000000000000\nCapBnd:\t000001ffffffffff\n';
function host({status=READY_STATUS,files={},env={},bwrap='/usr/bin/bwrap',socat='/usr/bin/socat',rungs={},sdk={ready:true,sdkStartup:{status:'ready',reasonCode:null}},platform='linux'}={}){
 const runs=[];
 return {runs,ports:{
  host:()=>({platform,arch:'x64',kernel:'5.10.240-238.959.amzn2.x86_64',uid:1000,gid:1000,node:'v22.20.0'}),
  env:name=>env[name],readText:path=>path==='/proc/self/status'?status:files[path],canWrite:dir=>dir==='/run/meri',
  findExecutable:name=>({bwrap,socat})[name]??undefined,nodePath:'/usr/bin/node',now:()=>1760486400000,
  run:async(command,args)=>{runs.push([command,...args]);if(args[0]==='--version')return {ok:true,stdout:'bubblewrap 0.11.0\n'};
   const key=args.includes('--unshare-all')?(args.includes('--proc')?'all+proc':'all'):args.includes('--unshare-pid')?'userns+pid':args.includes('--unshare-net')?'userns+net':'userns';
   const r=rungs[key]??true;return r===true?{ok:true,stdout:''}:{ok:false,stderr:r};},
  ...(sdk===null?{}:{sdkReadiness:async()=>sdk}),
 }};
}

test('process confinement is parsed from /proc/self/status; CAP_SYS_ADMIN is bit 21; diagnostics are one bounded printable line',()=>{
 assert.deepEqual(parseProcStatus(FARGATE_STATUS),{noNewPrivs:false,seccomp:2,seccompFilters:1,capEff:'0000000000000000',capBnd:'00000000a80425fb',sysAdminEffective:false,sysAdminBounding:false});
 assert.equal(parseProcStatus('CapEff:\t0000000000200000\n').sysAdminEffective,true);
 assert.deepEqual(parseProcStatus(''),{noNewPrivs:null,seccomp:null,seccompFilters:null,capEff:null,capBnd:null,sysAdminEffective:null,sysAdminBounding:null});
 assert.equal(diagnostic(BWRAP_EPERM),'bwrap: No permissions to creating new namespace, likely because the kernel does not allow non-privileged user namespaces.');
 assert.equal(diagnostic('x'.repeat(500)).length,160);assert.equal(diagnostic('\u0000secret\n'),'?secret');assert.equal(diagnostic(''),null);
});

test('a Fargate-like task (seccomp filter, no CAP_SYS_ADMIN, user namespaces refused) is infeasible for Bash and Chromium sandboxes, with the reason',async()=>{
 const rungs=Object.fromEntries(['userns','userns+pid','userns+net','all+proc','all'].map(k=>[k,BWRAP_EPERM]));
 const h=host({status:FARGATE_STATUS,rungs,env:{AWS_EXECUTION_ENV:'AWS_ECS_FARGATE',ECS_CONTAINER_METADATA_URI_V4:'http://169.254.170.2/v4/secret-task-id'},files:{'/proc/sys/user/max_user_namespaces':'63429\n'}});
 const r=await qualifyLinuxHost(h.ports,{runDirectory:'/run/meri'});
 assert.equal(r.schema,QUALIFICATION_SCHEMA);
 assert.deepEqual(r.verdicts.bashSandbox,{verdict:'infeasible',reason:'USERNS_DENIED_SECCOMP_NO_CAP_SYS_ADMIN'});
 assert.deepEqual(r.verdicts.chromiumSandbox,{verdict:'infeasible',reason:'USERNS_DENIED_SECCOMP_NO_CAP_SYS_ADMIN'});
 assert.deepEqual(r.markers,{ecsMetadata:true,executionEnv:'AWS_ECS_FARGATE'});
 assert.equal(JSON.stringify(r).includes('secret-task-id'),false,'marker values are never recorded');
 assert.deepEqual(r.filesystem,{rootWritable:false,runDirectoryWritable:true});assert.equal(r.userns.maxUserNamespaces,'63429');
 assert.equal(r.ladder.userns.diagnostic.startsWith('bwrap: No permissions'),true);
 assert.ok(h.runs.every(c=>c[0]==='/usr/bin/bwrap'),'only bubblewrap is executed');
 assert.ok(h.runs.filter(c=>c[1]!=='--version').every(c=>c.slice(-4).join(' ')==='-- /usr/bin/node -e 0'),'every rung runs the Node binary with a no-op program');
});

test('a host that passes every rung with socat and a clean SDK start is feasible; a missing /proc rung requires the weaker nested sandbox',async()=>{
 const r=await qualifyLinuxHost(host().ports,{runDirectory:'/run/meri'});
 assert.deepEqual(r.verdicts.bashSandbox,{verdict:'feasible',reason:null,weakerNestedSandboxRequired:false});assert.deepEqual(r.verdicts.chromiumSandbox,{verdict:'feasible',reason:null});
 assert.equal(r.dependencies.bwrapVersion,'bubblewrap 0.11.0');assert.equal(r.verdicts.egressProxy.verdict,'not-run');assert.equal(r.verdicts.liveEgress.verdict,'not-run');
 const weaker=await qualifyLinuxHost(host({rungs:{'all+proc':'bwrap: Can\'t mount proc on /newroot/proc: Operation not permitted'}}).ports,{runDirectory:'/run/meri'});
 assert.deepEqual(weaker.verdicts.bashSandbox,{verdict:'feasible',reason:null,weakerNestedSandboxRequired:true});
});

test('each missing prerequisite names itself: bubblewrap, socat, SDK start, sysctl, AppArmor, a single namespace and non-Linux',async()=>{
 const cases=[
  [{bwrap:null},'BWRAP_MISSING','BWRAP_MISSING'],
  [{socat:null},'SOCAT_MISSING',null],
  [{sdk:{ready:false,sdkStartup:{status:'refused',reasonCode:'SANDBOX_DEPENDENCIES_MISSING'}}},'SDK_SANDBOX_DEPENDENCIES_MISSING',null],
  [{sdk:null},'SDK_READINESS_NOT_RUN',null],
  [{rungs:{userns:BWRAP_EPERM,all:BWRAP_EPERM,'all+proc':BWRAP_EPERM,'userns+pid':BWRAP_EPERM,'userns+net':BWRAP_EPERM},files:{'/proc/sys/user/max_user_namespaces':'0'}},'USERNS_DISABLED_BY_SYSCTL','USERNS_DISABLED_BY_SYSCTL'],
  [{rungs:{userns:BWRAP_EPERM,all:BWRAP_EPERM,'all+proc':BWRAP_EPERM,'userns+pid':BWRAP_EPERM,'userns+net':BWRAP_EPERM},files:{'/proc/sys/kernel/apparmor_restrict_unprivileged_userns':'1'}},'USERNS_RESTRICTED_BY_APPARMOR','USERNS_RESTRICTED_BY_APPARMOR'],
  [{rungs:{'userns+net':'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted'}},null,'NAMESPACE_DENIED_USERNS_NET'],
  [{platform:'win32'},'NOT_LINUX','NOT_LINUX'],
 ];
 for(const [options,bash,chromium] of cases){const r=await qualifyLinuxHost(host(options).ports,{runDirectory:'/run/meri'});
  assert.equal(r.verdicts.bashSandbox.reason,bash,JSON.stringify(options));assert.equal(r.verdicts.chromiumSandbox.reason,chromium,JSON.stringify(options));}
});

test('the egress proxy matrix holds on this host over real loopback sockets (scripted resolver, fixture upstreams)',async()=>{
 const r=await egressLoopbackSelfTest({startEgressProxy,createBashEgressControl,net,http,now:Date.now});
 assert.equal(r.passed,true,JSON.stringify(r.cases));assert.equal(Object.keys(r.cases).length,11);
});

test('CLI arguments: an absolute run directory is required; the live probe takes one public DNS name',()=>{
 assert.deepEqual(parseArguments(['--run-directory','/run/meri']),{skipSdk:false,runDirectory:'/run/meri'});
 assert.deepEqual(parseArguments(['--run-directory','/run/meri/','--skip-sdk','--live-egress-name','pypi.org']),{skipSdk:true,runDirectory:'/run/meri',liveEgressName:'pypi.org'});
 for(const bad of [[],['--run-directory','run/meri'],['--run-directory','/run/../etc'],['--run-directory','/run/meri','--live-egress-name','169.254.169.254'],['--run-directory','/a','--run-directory','/b'],['--unknown']])assert.equal(parseArguments(bad),undefined,JSON.stringify(bad));
});
