/** Source contract for a separately reviewed proxy-web mode. No public route is created or installed here. The
 * current private host stack remains closed-network; this guard cannot authorize browser activation by itself. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';
import {assertNetworkFirewallReadback} from './firewall.mjs';
import {isPrivateServiceAddress} from './plan.mjs';

export const PROXY_WEB_GUARD_SCHEMA='meri-d005-proxy-web-guard/1';
const fail=()=>{throw Object.assign(new Error('HOST_PROXY_WEB_UNQUALIFIED'),{code:'HOST_PROXY_WEB_UNQUALIFIED'});};
const uid=n=>Number.isSafeInteger(n)&&n>0&&n<65535;
const trustedUid=n=>Number.isSafeInteger(n)&&n>=0&&n<65535;
const port=n=>Number.isSafeInteger(n)&&n>0&&n<=65535;
const meta=(key,right)=>({match:{op:'==',left:{meta:{key}},right}});
const ip=(field,right)=>({match:{op:'==',left:{payload:{protocol:'ip',field}},right}});
const tcp=(field,right)=>({match:{op:'==',left:{payload:{protocol:'tcp',field}},right}});
const udp=(field,right)=>({match:{op:'==',left:{payload:{protocol:'udp',field}},right}});
const conntrack=(key,right)=>({match:{op:'==',left:{ct:{key}},right}});
const accept={accept:null},drop={drop:null};
const PROXY_DENIED_IPV4=Object.freeze([['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],
 ['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]);

/** Exact host OUTPUT guard. The future public SG/route packet must be reviewed separately. All ENI output not
 * explicitly listed here drops, including IPv6, arbitrary UDP, metadata from the proxy UID and web dials from the
 * SDK/relay users. Private service exceptions are tied to a dedicated trusted UID, exact address and port. */
export function createProxyWebGuard({allocation,binding,eniName,proxyUid,relayUid,metadataUid,dnsAddress,privateServices}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(typeof eniName!=='string'||!(/^[a-z][a-z0-9_.-]{0,14}$/u.test(eniName))||eniName==='lo'||!uid(proxyUid)||!uid(relayUid)||!trustedUid(metadataUid)||
  new Set([proxyUid,relayUid,metadataUid]).size!==3||!isPrivateServiceAddress(dnsAddress)||!Array.isArray(privateServices)||!privateServices.length||privateServices.length>8)fail();
 const names=new Set();
 for(const service of privateServices){if(!service||typeof service.name!=='string'||!(/^[a-z][a-z0-9-]{0,31}$/u.test(service.name))||names.has(service.name)||
   !isPrivateServiceAddress(service.address)||!port(service.port)||!trustedUid(service.uid)||service.uid===proxyUid||service.uid===relayUid)fail();names.add(service.name);}
 if(!names.has('control')||!names.has('model-proxy'))fail();
 const digest=canonicalSha256({schema:PROXY_WEB_GUARD_SCHEMA,allocation:a,binding:b,eniName,proxyUid,relayUid,metadataUid,dnsAddress,privateServices});
 const tableName=`mw${digest.slice(0,12)}`,table={family:'inet',name:tableName},chain={family:'inet',table:tableName,name:'output',type:'filter',hook:'output',prio:-300,policy:'accept'};
 const rules=[];const add=expr=>rules.push({rule:{family:'inet',table:tableName,chain:'output',expr}});
 for(const service of privateServices)add([meta('oifname',eniName),meta('skuid',service.uid),ip('daddr',service.address),tcp('dport',service.port),accept]);
 // Only replies on a host-relay connection may leave the proxy UID on loopback. New local dials are denied.
 add([meta('oifname','lo'),meta('skuid',proxyUid),meta('nfproto','ipv4'),ip('saddr','127.0.0.1'),
  ip('daddr','127.0.0.1'),conntrack('state','established'),accept]);
 for(const protocol of [tcp,udp])add([meta('oifname',eniName),meta('skuid',proxyUid),ip('daddr',dnsAddress),protocol('dport',53),accept]);
 add([meta('oifname',eniName),meta('skuid',metadataUid),ip('daddr','169.254.169.254'),tcp('dport',80),accept]);
 for(const [address,length] of PROXY_DENIED_IPV4)add([meta('oifname',eniName),meta('skuid',proxyUid),ip('daddr',{prefix:{addr:address,len:length}}),drop]);
 for(const webPort of [80,443])add([meta('oifname',eniName),meta('skuid',proxyUid),meta('nfproto','ipv4'),tcp('dport',webPort),accept]);
 // The UID-wide drop covers specific routes through any additional interface, including IPv6.
 add([meta('skuid',proxyUid),drop]);
 add([meta('oifname',eniName),drop]);
 const expected=Object.freeze([{table},{chain},...rules]);
 const commands=Object.freeze({nftables:[{create:{table}},{add:{chain}},...rules.map(x=>({add:x}))]});
 const cgroupPath=`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/browser-proxy`;
 const relayCgroupPath=`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/host-relays`;
 return Object.freeze({schema:PROXY_WEB_GUARD_SCHEMA,tableName,eniName,proxyUid,relayUid,metadataUid,dnsAddress,
  cgroupPath,relayCgroupPath,allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),commands,expected});
}

/** A production verifier must read /proc/PID/status and cgroup, the exact nft table, and all default routes from the
 * live host after installing the reviewed guard. This source check refuses a mismatched process/UID, absent rule,
 * alternate default route or an IPv6 default. It is not a claim that the present stack has a public route. */
export function assertProxyWebGuardReadback({guard,pid,processUid,processCgroup,relayPid,relayProcessUid,relayProcessCgroup,nftOutput,ipv4DefaultRoutes,ipv6DefaultRoutes}){
 if(guard?.schema!==PROXY_WEB_GUARD_SCHEMA||!Number.isSafeInteger(pid)||pid<2||processUid!==guard.proxyUid||processCgroup!==guard.cgroupPath||
  !Number.isSafeInteger(relayPid)||relayPid<2||relayPid===pid||relayProcessUid!==guard.relayUid||relayProcessCgroup!==guard.relayCgroupPath)fail();
 try{assertNetworkFirewallReadback(nftOutput,guard.expected);}catch{fail();}
 let routes,v6;try{routes=JSON.parse(ipv4DefaultRoutes);v6=JSON.parse(ipv6DefaultRoutes);}catch{fail();}
 if(!Array.isArray(routes)||routes.length!==1||routes[0].dst!=='default'||routes[0].dev!==guard.eniName||!Array.isArray(v6)||v6.length!==0)fail();
 return Object.freeze({sourceContractMatched:true,pid,proxyUid:guard.proxyUid,proxyCgroup:guard.cgroupPath,relayPid,relayUid:guard.relayUid,
  relayCgroup:guard.relayCgroupPath,firewallTable:guard.tableName,eniName:guard.eniName});
}
