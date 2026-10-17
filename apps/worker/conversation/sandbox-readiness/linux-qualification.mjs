// @ts-check
/** Lane 8 Linux runtime qualification for browser and Bash: one bounded run on the real target host (the Meri runner
 * task: Wolfi, uid 1000, read-only root, writable /run/meri) that MEASURES what the sandboxes need and records a
 * content-free receipt. It decides feasibility; it never opens the browser activation gate or admits Bash itself.
 *
 * Measured, in order (every port injected, so this module is pure orchestration and safe to import):
 *  1. host facts: platform, architecture, kernel release, uid/gid, Node version, and whether the ECS/Fargate
 *     execution markers are PRESENT (names only; the metadata endpoint is never contacted, values never recorded);
 *  2. process confinement from /proc/self/status: NoNewPrivs, Seccomp mode and filter count, effective and bounding
 *     capability sets (CAP_SYS_ADMIN is the one bubblewrap/Chromium would need without user namespaces);
 *  3. user-namespace switches: user.max_user_namespaces, kernel.unprivileged_userns_clone (Debian),
 *     kernel.apparmor_restrict_unprivileged_userns (Ubuntu), when present;
 *  4. filesystem: the root is read-only, the run directory is writable;
 *  5. bubblewrap/socat presence and a namespace ladder through bubblewrap: user only, user+pid, user+net, then the
 *     SDK's full `--unshare-all` probe with and without a fresh /proc. The first failing rung names the missing kernel
 *     facility. Chromium's own namespace sandbox needs the user+pid+net rungs;
 *  6. the SDK's own sandbox startup with the product settings and no model request (`readiness.mjs`), unless skipped;
 *  7. the egress proxy on this host's loopback with a scripted resolver and fixture upstreams: allowlisted name
 *     admitted and dialled at its checked address only; IP literal, metadata, private and rebinding answers, unlisted
 *     redirect hop, Host mismatch and non-web port refused before any dial; revocation closes an open tunnel;
 *  8. optionally (`liveEgress`), the same proxy with the system resolver against one real allowlisted name.
 *
 * Verdicts: `bashSandbox` and `chromiumSandbox` are `feasible` only when every rung they need passed; otherwise
 * `infeasible` with the first failing reason. `egressProxy` is `verified` only when the whole loopback matrix held. */
import {once} from 'node:events';
export const QUALIFICATION_SCHEMA='meri.lane8.linux-qualification/1';
/** bubblewrap ladder; each rung runs the current Node binary with `-e 0`. */
const LADDER=Object.freeze([
 ['userns',['--ro-bind','/','/','--dev','/dev','--unshare-user','--die-with-parent','--new-session']],
 ['userns+pid',['--ro-bind','/','/','--dev','/dev','--unshare-user','--unshare-pid','--die-with-parent','--new-session']],
 ['userns+net',['--ro-bind','/','/','--dev','/dev','--unshare-user','--unshare-net','--die-with-parent','--new-session']],
 ['all+proc',['--ro-bind','/','/','--dev','/dev','--unshare-all','--die-with-parent','--new-session','--proc','/proc']],
 ['all',['--ro-bind','/','/','--dev','/dev','--unshare-all','--die-with-parent','--new-session']],
]);
/** Parses the confinement fields of /proc/self/status. Capability sets are hex masks; bit 21 is CAP_SYS_ADMIN.
 * @param {string} text */
export function parseProcStatus(text){
 /** @type {Record<string,string>} */const f={};
 for(const line of String(text).split('\n')){const m=/^([A-Za-z_]+):\s*(.*)$/u.exec(line);if(m)f[m[1]]=m[2].trim();}
 const cap=(/** @type {string|undefined} */hex)=>hex===undefined||!/^[0-9a-f]{1,16}$/iu.test(hex)?null:BigInt(`0x${hex}`);
 const sysAdmin=(/** @type {bigint|null} */c)=>c===null?null:(c>>21n&1n)===1n;
 const eff=cap(f.CapEff),bnd=cap(f.CapBnd);
 return Object.freeze({noNewPrivs:f.NoNewPrivs===undefined?null:f.NoNewPrivs==='1',seccomp:f.Seccomp===undefined?null:Number(f.Seccomp),seccompFilters:f.Seccomp_filters===undefined?null:Number(f.Seccomp_filters),
  capEff:f.CapEff??null,capBnd:f.CapBnd??null,sysAdminEffective:sysAdmin(eff),sysAdminBounding:sysAdmin(bnd)});
}
/** Bounded, single-line, content-free probe diagnostic (bubblewrap prints one reason line). @param {unknown} text */
export const diagnostic=text=>typeof text==='string'&&text?text.split('\n').find(l=>l.trim())?.trim().replace(/[^\x20-\x7e]/gu,'?').slice(0,160)??null:null;
/** @typedef {{ok:boolean,stdout?:string,stderr?:string}} ProbeResult */
/** @typedef {{
 *  host:()=>{platform:string,arch:string,kernel:string,uid:number|null,gid:number|null,node:string},
 *  env:(name:string)=>string|undefined,
 *  readText:(path:string)=>string|undefined,
 *  canWrite:(directory:string)=>boolean,
 *  findExecutable:(name:string)=>string|undefined,
 *  run:(command:string,args:string[])=>Promise<ProbeResult>,
 *  nodePath:string,
 *  sdkReadiness?:()=>Promise<{ready:boolean,sdkStartup:{status:string,reasonCode:string|null}}>,
 *  egressSelfTest?:()=>Promise<{passed:boolean,cases:Record<string,boolean>}>,
 *  liveEgress?:()=>Promise<{passed:boolean,cases:Record<string,boolean>}>,
 *  now:()=>number}} QualificationPorts */
/** @param {QualificationPorts} ports @param {{runDirectory:string}} input */
export async function qualifyLinuxHost(ports,{runDirectory}){
 const host=ports.host();
 const markers=Object.freeze({ecsMetadata:ports.env('ECS_CONTAINER_METADATA_URI_V4')!==undefined,executionEnv:/^AWS_ECS_(?:FARGATE|EC2)$/u.test(ports.env('AWS_EXECUTION_ENV')??'')?ports.env('AWS_EXECUTION_ENV'):null});
 const status=parseProcStatus(ports.readText('/proc/self/status')??'');
 const sysctl=(/** @type {string} */p)=>{const v=ports.readText(p);return v===undefined?null:v.trim().slice(0,32);};
 const userns=Object.freeze({maxUserNamespaces:sysctl('/proc/sys/user/max_user_namespaces'),unprivilegedUsernsClone:sysctl('/proc/sys/kernel/unprivileged_userns_clone'),apparmorRestrictUnprivilegedUserns:sysctl('/proc/sys/kernel/apparmor_restrict_unprivileged_userns')});
 const filesystem=Object.freeze({rootWritable:ports.canWrite('/'),runDirectoryWritable:ports.canWrite(runDirectory)});
 const bwrap=ports.findExecutable('bwrap'),socat=ports.findExecutable('socat');
 const version=bwrap?diagnostic((await ports.run(bwrap,['--version'])).stdout)??null:null;
 /** @type {Record<string,{ok:boolean,diagnostic:string|null}>} */const ladder={};
 if(bwrap)for(const [name,args] of LADDER){const r=await ports.run(bwrap,[...args,'--',ports.nodePath,'-e','0']);ladder[name]=Object.freeze({ok:r.ok===true,diagnostic:r.ok?null:diagnostic(r.stderr)});}
 const rung=(/** @type {string} */n)=>ladder[n]?.ok===true;
 const sdk=ports.sdkReadiness?await ports.sdkReadiness().catch(()=>({ready:false,sdkStartup:{status:'refused',reasonCode:'READINESS_INCOMPLETE'}})):null;
 const egress=ports.egressSelfTest?await ports.egressSelfTest().catch(()=>({passed:false,cases:{}})):null;
 const live=ports.liveEgress?await ports.liveEgress().catch(()=>({passed:false,cases:{}})):null;
 /** First reason a namespace-based sandbox cannot start here, or null. @param {string[]} rungs */
 const blocker=rungs=>{
  if(host.platform!=='linux')return 'NOT_LINUX';
  if(!bwrap)return 'BWRAP_MISSING';
  const failed=rungs.find(n=>!rung(n));if(!failed)return null;
  if(userns.maxUserNamespaces==='0'||userns.unprivilegedUsernsClone==='0')return 'USERNS_DISABLED_BY_SYSCTL';
  if(userns.apparmorRestrictUnprivilegedUserns==='1')return 'USERNS_RESTRICTED_BY_APPARMOR';
  if(!rung('userns'))return status.seccomp===2&&status.sysAdminEffective!==true?'USERNS_DENIED_SECCOMP_NO_CAP_SYS_ADMIN':'USERNS_DENIED';
  return `NAMESPACE_DENIED_${failed.replace(/[^a-z]+/gu,'_').toUpperCase()}`;
 };
 /** Bash needs user namespaces, the SDK's full namespace probe (with or without a fresh /proc), socat and a clean SDK start. */
 const bashReason=()=>{
  const ns=blocker(['userns'])??(rung('all+proc')||rung('all')?null:blocker(['all']));
  if(ns)return ns;
  if(!socat)return 'SOCAT_MISSING';
  if(sdk===null)return 'SDK_READINESS_NOT_RUN';
  return sdk.ready?null:`SDK_${sdk.sdkStartup.reasonCode??'NOT_READY'}`;
 };
 const bashBlocker=bashReason();
 const chromiumBlocker=blocker(['userns','userns+pid','userns+net']);
 const verdicts=Object.freeze({
  bashSandbox:Object.freeze(bashBlocker?{verdict:'infeasible',reason:bashBlocker}:{verdict:'feasible',reason:null,weakerNestedSandboxRequired:!rung('all+proc')}),
  chromiumSandbox:Object.freeze(chromiumBlocker?{verdict:'infeasible',reason:chromiumBlocker}:{verdict:'feasible',reason:null}),
  egressProxy:Object.freeze(egress===null?{verdict:'not-run'}:{verdict:egress.passed?'verified':'failed'}),
  liveEgress:Object.freeze(live===null?{verdict:'not-run'}:{verdict:live.passed?'verified':'failed'}),
 });
 return Object.freeze({schema:QUALIFICATION_SCHEMA,measuredAtMs:ports.now(),host:Object.freeze({...host}),markers,process:status,userns,filesystem,
  dependencies:Object.freeze({bwrap:!!bwrap,bwrapVersion:version,socat:!!socat}),ladder:Object.freeze(ladder),sdk,egress,liveEgress:live,verdicts,
  scope:'MEASUREMENT_ONLY: no model request, no metadata request, no browser launch; opens no gate and admits no tool'});
}

/** The egress proxy matrix on loopback with a scripted resolver and local fixture upstreams; usable on any host.
 * Synthetic names resolve to documentation-style public addresses that the injected dialer maps to the fixtures.
 * @param {{startEgressProxy:typeof import('../egress/proxy-server.mjs').startEgressProxy,createBashEgressControl:typeof import('../egress/bash-egress.mjs').createBashEgressControl,net:typeof import('node:net'),http:typeof import('node:http'),now:()=>number}} deps */
export async function egressLoopbackSelfTest({startEgressProxy,createBashEgressControl,net,http,now}){
 const table={'allowed.example':['93.184.215.14'],'rebind.example':['93.184.215.20','169.254.169.254'],'private.example':['10.0.0.5']};
 const web=http.createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{location:'http://unlisted.example/'});res.end();return;}res.writeHead(200);res.end('ok');});
 const echo=net.createServer(s=>s.pipe(s));
 web.listen(0,'127.0.0.1');echo.listen(0,'127.0.0.1');await Promise.all([once(web,'listening'),once(echo,'listening')]);
 /** @type {string[]} */const dials=[];
 const port=(/** @type {any} */s)=>s.address().port;
 const dial=(/** @type {{address:string,port:number}} */t)=>{dials.push(`${t.address}:${t.port}`);if(t.address!=='93.184.215.14')throw new Error('unexpected dial');return net.connect({host:'127.0.0.1',port:t.port===443?port(echo):port(web)});};
 const control=createBashEgressControl({domains:['allowed.example','rebind.example','private.example'],resolve:async name=>{const v=/** @type {Record<string,string[]>} */(table)[name];if(!v)throw new Error('NXDOMAIN');return v;},now,expiresAtMs:now()+60000});
 const proxy=await startEgressProxy({control,dial,httpPort:0,socksPort:0,limits:{admitMs:2000,connectMs:2000,idleMs:5000}});
 const get=(/** @type {string} */url,/** @type {string} */host=new URL(url).host)=>new Promise(resolve=>{const r=http.request({host:'127.0.0.1',port:proxy.ports.http,path:url,headers:{host}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,refusal:res.headers['x-meri-egress-refusal']??null,location:res.headers.location??null}));});r.on('error',()=>resolve({status:0}));r.end();});
 const tunnel=(/** @type {string} */authority)=>new Promise(resolve=>{const r=http.request({host:'127.0.0.1',port:proxy.ports.http,method:'CONNECT',path:authority});r.on('connect',(res,socket)=>resolve({status:res.statusCode,socket}));r.on('response',res=>{res.resume();resolve({status:res.statusCode});});r.on('error',()=>resolve({status:0}));r.end();});
 /** @type {Record<string,boolean>} */const cases={};
 try{
  const ok=/** @type {any} */(await get('http://allowed.example/'));cases.allowlistedAdmitted=ok.status===200;
  const redirect=/** @type {any} */(await get('http://allowed.example/redirect'));const hop=/** @type {any} */(await get(String(redirect.location)));cases.redirectRelayedAndHopRefused=redirect.status===302&&hop.status===403;
  for(const [name,url] of [['ipLiteralRefused','http://93.184.215.14/'],['metadataRefused','http://169.254.169.254/latest/meta-data/'],['privateAnswerRefused','http://private.example/'],['rebindingAnswerRefused','http://rebind.example/'],['nonWebPortRefused','http://allowed.example:8080/']])
   cases[name]=/** @type {any} */(await get(url)).status===403;
  cases.hostMismatchRefused=/** @type {any} */(await get('http://allowed.example/','unlisted.example')).status===403;
  const t=/** @type {any} */(await tunnel('allowed.example:443'));
  if(t.socket){t.socket.write('ping');const [chunk]=await once(t.socket,'data');cases.tunnelAdmitted=String(chunk)==='ping';const closed=once(t.socket,'close');proxy.revoke();await closed;cases.revocationClosesTunnel=true;}
  else{cases.tunnelAdmitted=false;cases.revocationClosesTunnel=false;}
  cases.onlyCheckedAddressDialled=dials.every(d=>d.startsWith('93.184.215.14:'));
 }finally{await proxy.close();web.close();echo.close();}
 return Object.freeze({passed:Object.values(cases).length===11&&Object.values(cases).every(Boolean),cases:Object.freeze(cases)});
}
