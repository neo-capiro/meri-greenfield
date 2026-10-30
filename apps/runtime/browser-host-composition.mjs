/** Production composition of the shared browser-host owners Control already owns. It creates the
 * router and, when declared, the host-currentness listener; the pool, conversation store, action
 * sessions and Core authority client are borrowed and never closed here. A missing owner refuses
 * the whole composition instead of mounting a partially wired browser family. */
import {createBrowserHostCurrentness} from '../control/browser-hosts/currentness.mjs';
import {createPostgresHostAllocationReader} from '../control/browser-hosts/postgres-allocations.mjs';
import {createBrowserHostRouter} from '../control/browser-hosts/router.mjs';
import {createBrowserHostRunFacts,createBrowserHostSiteWorkflowPort} from './browser-host-run-facts.mjs';
import {createPostgresHostCurrentnessStore} from '../worker/conversation/host/control/postgres-store.mjs';
import {createHostCurrentnessServer} from '../worker/conversation/host/control/server.mjs';
import {transact} from '../control/product-persistence/transaction.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const bytes=(value,label)=>{
 if(!(value instanceof Uint8Array)||value.length===0)fail('BROWSER_HOST_COMPOSITION');
 return Buffer.from(value);
};
/** Loads exactly the declared protected references through the trusted material reader. It never
 * invents a path, defaults an address or inspects a secret beyond reading the named files. */
export async function readBrowserHostMaterial(declaration,read){
 if(declaration===null||declaration===undefined)return null;
 if(typeof read!=='function')fail('BROWSER_HOST_COMPOSITION');
 const load=async path=>{const bytes=await read(path);if(!(bytes instanceof Uint8Array)||bytes.length===0)fail('BROWSER_HOST_COMPOSITION');return bytes;};
 const p=declaration.tls.privateClient;
 const privateClient=Object.freeze({cert:await load(p.certFile),key:await load(p.keyFile),ca:await load(p.caFile)});
 if(declaration.tls.hostServer===undefined)return Object.freeze({privateClient});
 const s=declaration.tls.hostServer;
 return Object.freeze({privateClient,hostServer:Object.freeze({cert:await load(s.certFile),key:await load(s.keyFile),clientCa:await load(s.clientCaFile)})});
}
/** `material` is already-loaded protected key material for exactly the declared references:
 * {privateClient:{clientName,cert,key,ca}, hostServer?:{serverName,cert,key,clientCa}}. */
export function createBrowserHostComposition({declaration,pool,store,sessions,core,capabilityPolicy,readBrowserPolicy,siteWorkflowAdmission=null,material,now=Date.now,limits={}}={}){
 if(declaration===null||declaration===undefined)return null;
 if(!pool||typeof pool.connect!=='function'||!store?.executions||!store?.lifecycle?.browserCustody||
  typeof sessions?.nativeCredentialFor!=='function'||typeof core?.readCurrent!=='function'||
  typeof capabilityPolicy?.forRun!=='function'||typeof readBrowserPolicy!=='function'||typeof now!=='function')fail('BROWSER_HOST_COMPOSITION');
 const maxRequestMs=Math.min(declaration.maxCurrentnessMs,Number.isSafeInteger(limits.requestMs)?limits.requestMs:declaration.maxCurrentnessMs);
 const currentness=createBrowserHostCurrentness({store,core,nativeCredentials:sessions,capabilityPolicy,readBrowserPolicy,now,maxRequestMs});
 const allocations=createPostgresHostAllocationReader({pool,readCanonicalRun:currentness.readRoute,now});
 const client=material?.privateClient;
 if(!client)fail('BROWSER_HOST_COMPOSITION');
 const privateTls=Object.freeze({clientName:declaration.tls.privateClient.clientName,
  cert:bytes(client.cert),key:bytes(client.key),ca:bytes(client.ca)});
 const browserHosts=createBrowserHostRouter({allocations,tls:privateTls,now,requestMs:declaration.requestMs});
 // The listener serves Control's canonical run facts to a mutually authenticated host peer; it is
 // mounted only when its own protected server material and bind are declared and loaded.
 let server=null,serverTls=null;
 if(declaration.tls.hostServer!==undefined){
  const s=material.hostServer;
  if(!s)fail('BROWSER_HOST_COMPOSITION');
  serverTls=Object.freeze({serverName:declaration.tls.hostServer.serverName,cert:bytes(s.cert),key:bytes(s.key),clientCa:bytes(s.clientCa)});
  const acknowledged=(body,options={})=>transact(pool,body,{check:()=>options.signal?.throwIfAborted(),unavailable:'HOST_CONTROL_UNAVAILABLE',uncertain:'HOST_CONTROL_UNKNOWN'});
  server=createHostCurrentnessServer({bind:declaration.bind,tls:serverTls,
   store:createPostgresHostCurrentnessStore({transact:acknowledged,readCanonicalRun:currentness.readHost,maxLeaseMs:declaration.maxLeaseMs}),
   maxFreshMs:declaration.maxCurrentnessMs,requestMs:Math.min(declaration.requestMs,5000),now});
 }
 // The facts answer is the Control-side source join for readRun: saved selection through the store's own
 // reader, then the canonical facts projection on the acknowledged transaction client.
 // The facts producer is the protected store's callback: it consumes that store's own client.
 const facts=createBrowserHostRunFacts({currentness});
 let siteWorkflows=null,starting,closing,address=null,closed=false;
 const wipe=()=>{for(const t of [privateTls,serverTls])if(t)for(const k of ['cert','key',t===privateTls?'ca':'clientCa'])try{t[k]?.fill?.(0);}catch{}};
 return Object.freeze({browserHosts,currentness,allocations,facts,
  get address(){return address;},
  // The protected nonce store binds THIS callback and passes its own transaction client.
  readCanonicalFacts:(client,input)=>facts.readCanonicalFacts(client,input),
  // The live site-workflow port needs the assembled conversation service, which does not exist yet when
  // this composition is built; it is late-bound once, like the other existing session binders.
  bindService({service}={}){
   if(closed)fail('BROWSER_HOST_CLOSED');
   if(siteWorkflows!==null)fail('BROWSER_HOST_COMPOSITION');
   siteWorkflows=createBrowserHostSiteWorkflowPort({store,service,nativeCredentials:sessions});return siteWorkflows;},
  siteWorkflows(){return siteWorkflows;},
  state:()=>Object.freeze({mounted:true,closed,listener:address,siteWorkflows:siteWorkflows!==null}),
  start(options={}){
   // A closed composition never opens a listener again.
   if(closed)return Promise.reject(Object.assign(new Error('BROWSER_HOST_CLOSED'),{code:'BROWSER_HOST_CLOSED'}));
   if(server===null)return Promise.resolve(Object.freeze({mounted:true,listener:null}));
   return starting??=(async()=>{try{const started=await server.start();address=started?.address??null;options.signal?.throwIfAborted();return Object.freeze({mounted:true,listener:address});}
    catch(error){
     // A failed start retires only what this composition created, and a cleanup failure stays visible
     // instead of being reported as a clean close.
     const failures=[];try{await server.close();}catch(cleanup){failures.push(cleanup);}wipe();
     if(failures.length)throw Object.assign(new Error('BROWSER_HOST_START_AND_CLEANUP_FAILED'),{code:'BROWSER_HOST_START_AND_CLEANUP_FAILED',cause:new AggregateError([error,...failures])});
     throw error;}})();
  },
  close(){return closing??=(async()=>{
   closed=true;
   // A close that arrives while a start is in flight waits for that attempt to settle (success or
   // failure) before retiring the listener, so the listener can never outlive the close.
   if(starting!==undefined)try{await starting;}catch{}
   const results=[];try{browserHosts.close();}catch(reason){results.push(reason);}
   if(server!==null)try{await server.close();}catch(reason){results.push(reason);}wipe();
   if(results.length)throw Object.assign(new Error('BROWSER_HOST_CLEANUP_FAILED'),{code:'BROWSER_HOST_CLEANUP_FAILED',failures:Object.freeze(results)});
   return Object.freeze({closed:true});})();},
 });
}
