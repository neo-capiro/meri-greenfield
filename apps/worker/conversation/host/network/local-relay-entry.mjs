#!/usr/bin/env node
/** Native-helper target for a D005 local loopback relay. The helper has already entered the exact netns/cgroup,
 * scrubbed the environment, hidden credentials and dropped privileges before exec. This process holds no secrets. */
import {pathToFileURL} from 'node:url';
import {startToolLoopbackRelays} from './relay.mjs';

export const LOCAL_RELAY_READY_SCHEMA='meri-d005-local-relay-ready/1';
export async function runLocalRelayEntry(config,{write=message=>process.stdout.write(message),on=process.on.bind(process)}={}){
 const relays=await startToolLoopbackRelays(config);
 const ready=Object.freeze({schema:LOCAL_RELAY_READY_SCHEMA,pid:process.pid,namespaceDev:config.namespaceDev,namespaceIno:config.namespaceIno,
  ports:config.routes.map(r=>r.localPort)});
 write(`${JSON.stringify(ready)}\n`);
 const stop=()=>{relays.close().then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=3;});};
 on('SIGTERM',stop);on('SIGINT',stop);
 return Object.freeze({ready,close:relays.close});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='--help'){
  process.stdout.write('Usage: local-relay-entry.mjs <base64url-json-config>\nExit: 0 clean stop, 2 invalid/start failure, 3 cleanup failure. Run only via the pinned native helper.\n');
 }else{
  try{
   const encoded=process.argv[2];if(typeof encoded!=='string'||encoded.length>4096||!/^[A-Za-z0-9_-]+$/u.test(encoded))throw Error('configuration');
   const config=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
   await runLocalRelayEntry(config);
  }catch{process.stderr.write('HOST_NETWORK_LOCAL_RELAY_UNKNOWN\n');process.exitCode=2;}
 }
}
