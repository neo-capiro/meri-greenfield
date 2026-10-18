/** Exact per-run D005 network compartments. This is configuration validation, not proof of a Linux boundary. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../binding.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_NETWORK_CONFIGURATION'),{code:'HOST_NETWORK_CONFIGURATION'});};
const port=(value,min=1024)=>Number.isSafeInteger(value)&&value>=min&&value<=65535;
const v4=value=>{
 if(typeof value!=='string'||!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value))return null;
 const bytes=value.split('.').map(Number);
 return bytes.every((n,i)=>n<=255&&String(n)===value.split('.')[i])?bytes:null;
};
/** Private IPv4 destination for the trusted SDK parent's model/control ports. Link-local metadata, loopback,
 * multicast, broadcast and public addresses are refused even if a caller labels them as private. */
export function isPrivateServiceAddress(value){
 const b=v4(value);return !!b&&(b[0]===10||b[0]===172&&b[1]>=16&&b[1]<=31||b[0]===192&&b[1]===168);
}
const specs=Object.freeze({browser:['browser-http'],bash:['bash-http','bash-socks'],sdk:['model-proxy','control']});
/** @param {{allocation:unknown,binding:unknown,kind:'browser'|'bash'|'sdk',routes:unknown}} input */
export function createNetworkPlan({allocation,binding,kind,routes}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(!Object.hasOwn(specs,kind)||!Array.isArray(routes)||
  (kind==='sdk'?![2,4].includes(routes.length):routes.length!==specs[kind].length))fail();
 const names=kind==='sdk'&&routes.length===4?[...specs.sdk,'bash-http','bash-socks']:specs[kind];
 const ordered=names.map(name=>{
  const raw=routes.find(r=>r?.name===name);
  if(!raw||routes.filter(r=>r?.name===name).length!==1||!port(raw.localPort)||!port(raw.targetPort,kind==='sdk'&&!name.startsWith('bash-')?1:1024))fail();
  if(kind==='sdk'&&!name.startsWith('bash-')){
   if(!isPrivateServiceAddress(raw.targetAddress))fail();
  }else if(raw.targetAddress!==undefined&&raw.targetAddress!=='127.0.0.1')fail();
  return Object.freeze({name,localPort:raw.localPort,targetAddress:kind==='sdk'&&!name.startsWith('bash-')?raw.targetAddress:'127.0.0.1',targetPort:raw.targetPort});
 });
 if(new Set(ordered.map(r=>r.localPort)).size!==ordered.length||routes.some(r=>!names.includes(r?.name)))fail();
 const digest=canonicalSha256({schema:'meri-d005-network-compartment/1',allocation:a,binding:b,kind});
 const slot=parseInt(digest.slice(0,8),16)%32768,base=slot*4;
 const block=`198.${18+Math.floor(base/65536)}.${Math.floor((base%65536)/256)}.${base%256}`;
 const address=n=>`198.${18+Math.floor((base+n)/65536)}.${Math.floor(((base+n)%65536)/256)}.${(base+n)%256}`;
 const plan={kind,namespaceName:`meri-${kind}-${digest.slice(0,12)}`,
  namespacePath:`/run/netns/meri-${kind}-${digest.slice(0,12)}`,
  hostVethName:`mh${kind[0]}${digest.slice(0,10)}`,toolVethName:`mt${kind[0]}${digest.slice(0,10)}`,
  hostTable:`mh${digest.slice(0,12)}`,toolTable:`mt${digest.slice(0,12)}`,
  hostRelayCgroupPath:`/meri/hosts/${a.hostId}-${a.generation}/${canonicalSha256(b)}/host-relay-${kind}`,
  subnet:`${block}/30`,hostAddress:address(1),toolAddress:address(2),
  allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),routes:Object.freeze(ordered)};
 return Object.freeze(plan);
}
