/** Host OUTPUT guard for the browser egress proxy process of a provisioned browser-only host. The proxy runs as its own
 * unprivileged uid in the run's `browser-proxy` cgroup leaf (`egress/proxy-process.mjs`); this nft table lets that uid
 * send only public IPv4 TCP 80/443 on the ENI and established replies on loopback, and drops every other packet it
 * originates (private, link-local, metadata, multicast and documentation ranges, any other port, any other interface,
 * IPv6). Root (SSM agent, Control currentness, ECR) is untouched: the guard is keyed on the proxy uid alone. The
 * supervisor decides each connection in the real egress control; this guard is the defense in depth under it. */
import {readFileSync} from 'node:fs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {assertNetworkFirewallReadback} from './firewall.mjs';
import {PROXY_DENIED_IPV4} from './public-egress.mjs';
import {runLinuxNetworkCommand,NETWORK_TOOLS} from './confinement.mjs';

export const BROWSER_PROXY_GUARD_SCHEMA='meri-d005-browser-proxy-guard/1';
const NFT=NETWORK_TOOLS.nft;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const uid=n=>Number.isSafeInteger(n)&&n>=1000&&n<=65533;
const meta=(key,right)=>({match:{op:'==',left:{meta:{key}},right}});
const ip=(field,right)=>({match:{op:'==',left:{payload:{protocol:'ip',field}},right}});
const tcp=(field,right)=>({match:{op:'==',left:{payload:{protocol:'tcp',field}},right}});
const conntrack=(key,right)=>({match:{op:'==',left:{ct:{key}},right}});
const accept={accept:null},drop={drop:null};

export function createBrowserProxyGuard({allocation,binding,eniName,proxyUid}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(a.hostMode!=='browser-only'||typeof eniName!=='string'||!/^[a-z][a-z0-9_.-]{0,14}$/u.test(eniName)||eniName==='lo'||!uid(proxyUid))fail('HOST_PROXY_GUARD_CONFIGURATION');
 const digest=canonicalSha256({schema:BROWSER_PROXY_GUARD_SCHEMA,allocation:a,binding:b,eniName,proxyUid});
 const tableName=`mp${digest.slice(0,12)}`,table={family:'inet',name:tableName};
 const chain={family:'inet',table:tableName,name:'output',type:'filter',hook:'output',prio:-300,policy:'accept'};
 const rules=[];const add=expr=>rules.push({rule:{family:'inet',table:tableName,chain:'output',expr}});
 // Replies to the host relay on loopback only; the proxy never opens a local connection of its own.
 add([meta('oifname','lo'),meta('skuid',proxyUid),meta('nfproto','ipv4'),ip('saddr','127.0.0.1'),ip('daddr','127.0.0.1'),conntrack('state','established'),accept]);
 for(const [address,length] of PROXY_DENIED_IPV4)add([meta('oifname',eniName),meta('skuid',proxyUid),ip('daddr',{prefix:{addr:address,len:length}}),drop]);
 for(const port of [80,443])add([meta('oifname',eniName),meta('skuid',proxyUid),meta('nfproto','ipv4'),tcp('dport',port),accept]);
 add([meta('skuid',proxyUid),drop]);
 const expected=Object.freeze([{table},{chain},...rules]);
 const commands=Object.freeze({nftables:[{create:{table}},{add:{chain}},...rules.map(x=>({add:x}))]});
 return Object.freeze({schema:BROWSER_PROXY_GUARD_SCHEMA,tableName,eniName,proxyUid,
  cgroupPath:`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/browser-proxy`,
  allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),commands,expected});
}

/** The live kernel view: the exact table, and the proxy pid under the proxy uid in its leaf. */
export function assertBrowserProxyGuardReadback({guard,pid,processUid,processCgroup,nftOutput}){
 if(guard?.schema!==BROWSER_PROXY_GUARD_SCHEMA||!Number.isSafeInteger(pid)||pid<2||processUid!==guard.proxyUid||processCgroup!==guard.cgroupPath)fail('HOST_PROXY_GUARD_UNKNOWN');
 try{assertNetworkFirewallReadback(nftOutput,guard.expected);}catch{fail('HOST_PROXY_GUARD_UNKNOWN');}
 return Object.freeze({verified:true,pid,proxyUid:guard.proxyUid,proxyCgroup:guard.cgroupPath,firewallTable:guard.tableName,eniName:guard.eniName});
}

const fourIds=(status,name)=>{
 const lines=status.split('\n').filter(line=>line.startsWith(`${name}:`));if(lines.length!==1)fail('HOST_PROXY_GUARD_UNKNOWN');
 const values=lines[0].slice(name.length+1).trim().split(/\s+/u);
 if(values.length!==4||values.some(v=>!/^\d+$/u.test(v)||v!==values[0]))fail('HOST_PROXY_GUARD_UNKNOWN');return Number(values[0]);
};
const procCgroup=raw=>{const lines=raw.trimEnd().split('\n');if(lines.length!==1)fail('HOST_PROXY_GUARD_UNKNOWN');const m=/^0::(\/[a-zA-Z0-9/_-]+)$/u.exec(lines[0]);if(!m)fail('HOST_PROXY_GUARD_UNKNOWN');return m[1];};

/** Install the guard for a running proxy process and read it back; a failed readback removes the table and refuses. */
export async function installBrowserProxyGuard({allocation,binding,eniName,proxyUid,pid,execute=runLinuxNetworkCommand,readFile=readFileSync}={}){
 const guard=createBrowserProxyGuard({allocation,binding,eniName,proxyUid});
 if(!Number.isSafeInteger(pid)||pid<2||typeof execute!=='function'||typeof readFile!=='function')fail('HOST_PROXY_GUARD_CONFIGURATION');
 const nft=(args,input)=>execute({file:NFT,args,...(input===undefined?{}:{input}),timeoutMs:5000});
 let installed=false;
 const remove=async()=>{if(!installed)return;installed=false;await nft(['delete','table','inet',guard.tableName]);};
 try{
  await nft(['-j','-f','-'],JSON.stringify(guard.commands));installed=true;
  const listed=await nft(['-j','list','table','inet',guard.tableName]);
  const status=String(readFile(`/proc/${pid}/status`,'utf8')),cgroup=String(readFile(`/proc/${pid}/cgroup`,'utf8'));
  const readback=assertBrowserProxyGuardReadback({guard,pid,processUid:fourIds(status,'Uid'),processCgroup:procCgroup(cgroup),nftOutput:listed.stdout});
  let closing=null;
  return Object.freeze({guard,readback,close(){return closing??=remove().then(()=>Object.freeze({closed:true}),()=>fail('HOST_PROXY_GUARD_CLEANUP_UNKNOWN'));}});
 }catch(error){
  try{await remove();}catch{}
  if(typeof error?.code==='string'&&error.code.startsWith('HOST_PROXY_GUARD_'))throw error;
  fail('HOST_PROXY_GUARD_UNKNOWN');
 }
}
