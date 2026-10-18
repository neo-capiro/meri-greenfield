#!/usr/bin/env node
/** Fixed target byte relays in the original host network namespace. The root-owned pre-exec helper has already
 * attached this process to its dedicated cgroup, dropped UID/GID/caps, hidden cgroupfs and scrubbed its env. */
import {pathToFileURL} from 'node:url';
import {isIP} from 'node:net';
import {startPinnedRelay} from './relay.mjs';

export const HOST_RELAY_READY_SCHEMA='meri-d005-host-relay-ready/1';
const fail=()=>{throw Object.assign(new Error('HOST_NETWORK_HOST_RELAY_CONFIGURATION'),{code:'HOST_NETWORK_HOST_RELAY_CONFIGURATION'});};
const port=p=>Number.isSafeInteger(p)&&p>=1&&p<=65535;

/** All target choices come from the trusted supervisor and are also constrained by host OUTPUT nft rules. */
export async function runHostRelayEntry({kind,hostAddress,routes},{startRelay=startPinnedRelay,write=line=>process.stdout.write(line),on=process.on.bind(process)}={}){
 if(!['sdk','browser'].includes(kind)||isIP(hostAddress)!==4||!Array.isArray(routes)||
  routes.length!==(kind==='browser'?1:routes.length===2||routes.length===4?routes.length:0)||
  routes.map(r=>r?.name).join(',')!==(kind==='browser'?'browser-http':routes.length===2?'model-proxy,control':'model-proxy,control,bash-http,bash-socks')||
  routes.some(r=>isIP(r?.targetAddress)!==4||!port(r?.targetPort)))fail();
 const handles=[];
 try{
  for(const route of routes)handles.push(await startRelay({listenAddress:hostAddress,listenPort:0,
   targetAddress:route.targetAddress,targetPort:route.targetPort}));
  const ready=Object.freeze({schema:HOST_RELAY_READY_SCHEMA,pid:process.pid,kind,hostAddress,
   routes:Object.freeze(routes.map((route,i)=>Object.freeze({name:route.name,port:handles[i].port})))});
  write(`${JSON.stringify(ready)}\n`);
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;
   for(const handle of handles)handle.revoke();
   Promise.all(handles.map(h=>h.close())).then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=3;});};
  on('SIGTERM',stop);on('SIGINT',stop);
  return Object.freeze({ready,revoke:()=>{for(const h of handles)h.revoke();return {revoked:true};},
   async close(){stop();await Promise.all(handles.map(h=>h.close()));return {closed:true};}});
 }catch(error){for(const handle of handles)try{handle.revoke();}catch{}
  await Promise.allSettled(handles.map(h=>h.close()));throw error;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const encoded=process.argv[2];if(typeof encoded!=='string'||encoded.length>4096||!/^[A-Za-z0-9_-]+$/u.test(encoded))fail();
  await runHostRelayEntry(JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')));
 }catch{process.stderr.write('HOST_NETWORK_HOST_RELAY_UNKNOWN\n');process.exitCode=2;}
}
