/** Closed declaration for the shared browser-host production composition. It names protected
 * material by path only: no address, credential, allocation, uid/gid or certificate is defaulted,
 * and reading the material stays with the trusted startup loader. */
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const file=value=>{
 if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)fail('BROWSER_HOST_CONFIGURATION');
 return value;
};
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const privateClient=value=>{
 const c=own(value,['clientName','certFile','keyFile','caFile']);
 if(typeof c.clientName!=='string'||!/^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/u.test(c.clientName))fail('BROWSER_HOST_CONFIGURATION');
 return Object.freeze({clientName:c.clientName,certFile:file(c.certFile),keyFile:file(c.keyFile),caFile:file(c.caFile)});
};
const hostServer=value=>{
 const c=own(value,['serverName','certFile','keyFile','clientCaFile']);
 if(typeof c.serverName!=='string'||!/^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/u.test(c.serverName))fail('BROWSER_HOST_CONFIGURATION');
 return Object.freeze({serverName:c.serverName,certFile:file(c.certFile),keyFile:file(c.keyFile),clientCaFile:file(c.clientCaFile)});
};
/** `browserHosts` is a control-role opt-in. Absent or `enabled:false` composes no owner at all, so
 * the browser routes stay exactly as they are today rather than half-wired. */
export function compileBrowserHostConfiguration(configuration){
 const h=configuration?.browserHosts;
 if(h===undefined)return null;
 const c=own(data(h),['enabled'],['tls','requestMs','maxCurrentnessMs','maxLeaseMs','bind']);
 if(typeof c.enabled!=='boolean')fail('BROWSER_HOST_CONFIGURATION');
 if(c.enabled===false){
  if(c.tls!==undefined||c.requestMs!==undefined||c.maxCurrentnessMs!==undefined||c.maxLeaseMs!==undefined||c.bind!==undefined)fail('BROWSER_HOST_CONFIGURATION');
  return null;
 }
 if(c.tls===undefined)fail('BROWSER_HOST_CONFIGURATION');
 const t=own(data(c.tls),['privateClient'],['hostServer']);
 const requestMs=c.requestMs??10000,maxCurrentnessMs=c.maxCurrentnessMs??3000,maxLeaseMs=c.maxLeaseMs??10000;
 if(!integer(requestMs,1,30000)||!integer(maxCurrentnessMs,1,3000)||!integer(maxLeaseMs,1,30000))fail('BROWSER_HOST_CONFIGURATION');
 const declaration={enabled:true,requestMs,maxCurrentnessMs,maxLeaseMs,tls:Object.freeze({privateClient:privateClient(t.privateClient),
  ...(t.hostServer===undefined?{}:{hostServer:hostServer(t.hostServer)})})};
 // The host-currentness listener is mounted only when its own server material and bind are declared together.
 if(t.hostServer!==undefined){
  const b=own(data(c.bind),['address','port']);
  if(typeof b.address!=='string'||!integer(b.port,1,65535))fail('BROWSER_HOST_CONFIGURATION');
  declaration.bind=Object.freeze({address:b.address,port:b.port});
 }else if(c.bind!==undefined)fail('BROWSER_HOST_CONFIGURATION');
 return Object.freeze(declaration);
}
