/** Product startup owner for the canonical token writer and Temporal API-key provider.
 * It creates no issuer, transport, directory or permission. Root startup must stop
 * its Temporal connection/poller when onUnavailable fires; file removal does not
 * revoke a key already held by a native connection or server. */
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {createTemporalProductTokenWriter,parseTemporalProductTokenWriterConfiguration} from './temporal-product-token-writer.mjs';
import {createTemporalAuthorization,createTemporalTokenFileReader} from './temporal-authorization.mjs';

const fault=code=>Object.assign(Error('TEMPORAL_PRODUCT_AUTHORIZATION_'+code),{code:'TEMPORAL_PRODUCT_AUTHORIZATION_'+code});
const fail=code=>{throw fault(code);};
const callable=value=>typeof value==='function'&&!types.isProxy(value);
function methods(owner,names){
 const record=own(owner,names);
 if(names.some(name=>!callable(record[name])))fail('CONFIGURATION');
 return Object.fromEntries(names.map(name=>[name,record[name].bind(owner)]));
}

/** Default construction always uses the canonical owners. The second argument is
 * an explicit trusted test-owner seam, never a field in JSON/runtime config. */
export function createTemporalProductAuthorization(options={},testOwners={}){
 const c=own(options,[],['configuration','delivery','onUnavailable','now','timers']);
 const factories=own(testOwners,[],['createWriter','createReader']);
 const configuration=parseTemporalProductTokenWriterConfiguration(c.configuration);
 const now=c.now??Date.now,timers=c.timers??{setTimeout,clearTimeout};
 const createWriter=factories.createWriter??createTemporalProductTokenWriter;
 const createReader=factories.createReader??createTemporalTokenFileReader;
 if(!callable(now)||!callable(timers?.setTimeout)||!callable(timers?.clearTimeout)||
    !callable(createWriter)||!callable(createReader)||configuration.enabled&&
    (!callable(c.onUnavailable)||types.isAsyncFunction(c.onUnavailable)||types.isGeneratorFunction(c.onUnavailable)))fail('CONFIGURATION');
 const writer=methods(createWriter({configuration,delivery:c.delivery,now,timers}),['refresh','start','close','status','healthy','watch']);
 let authorization=null,active=null,refreshing=null,closing=null,closed=false,started=false,failure=null,stopFailure=false;
 let unwatchWriter=null,unwatchAuthorization=null;
 const watchers=new Set();
 const healthy=()=>configuration.enabled&&!closed&&failure===null&&started&&writer.healthy()&&authorization?.healthy()===true;
 const status=()=>Object.freeze({enabled:configuration.enabled,state:failure?'unavailable':closed?'closed':!configuration.enabled?'disabled':healthy()?'current':started?'unavailable':'idle',failure,
  expiresAtMs:healthy()?Math.min(writer.status().expiresAtMs,authorization.current().expiresAtMs):null,physicalStopProven:false});
 function lifetime(signal){return createOperationLifetime({now,signal,deadlineMs:now()+configuration.maxRequestMs,schedule:timers.setTimeout,unschedule:timers.clearTimeout,errorFactory:()=>fault('INTERRUPTED')});}
 function unavailable(code){
  if(closed||failure!==null)return;
  failure=code==='TEMPORAL_AUTHORIZATION_IO_UNKNOWN'?'TEMPORAL_PRODUCT_AUTHORIZATION_IO_UNKNOWN':'TEMPORAL_PRODUCT_AUTHORIZATION_UNAVAILABLE';
  // Publish denial before any stop/cancellation callback or asynchronous cleanup.
  for(const watcher of [...watchers])try{watcher(failure);}catch{}
  try{
   const result=c.onUnavailable(failure);
   if(result!==undefined){if(types.isPromise(result))Promise.prototype.then.call(result,undefined,()=>{});stopFailure=true;}
  }catch{stopFailure=true;}
  close().catch(()=>{});
 }
 function assertOpen(){if(closed)fail('CLOSED');if(failure!==null)fail('UNAVAILABLE');}
 if(configuration.enabled){
  const reader=methods(createReader({tokenFile:configuration.authorization.tokenFile}),['read']);
  authorization=createTemporalAuthorization({configuration:configuration.authorization,now,timers,readTimeoutMs:configuration.maxRequestMs,refreshTimeoutMs:configuration.maxRequestMs,
   reader:{async read({signal}={}){assertOpen();if(!writer.healthy())fail('UNAVAILABLE');const token=await reader.read({signal});assertOpen();if(!writer.healthy())fail('UNAVAILABLE');return token;}}});
  unwatchWriter=writer.watch(unavailable);unwatchAuthorization=authorization.watch(unavailable);
  if(!callable(unwatchWriter)||!callable(unwatchAuthorization))fail('CONFIGURATION');
 }
 function refresh({signal}={}){
  nativeSignal(signal);try{signal?.throwIfAborted();assertOpen();}catch(error){return Promise.reject(error);}
  if(!configuration.enabled)return Promise.resolve(status());
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   let life;active=new AbortController();const abort=()=>active?.abort();signal?.addEventListener('abort',abort,{once:true});
   try{
    signal?.throwIfAborted();life=lifetime(active.signal);
    await life.run(signal=>writer.refresh({signal}));life.check();assertOpen();
    await life.run(signal=>authorization.refresh({signal}));life.check();assertOpen();
    if(!writer.healthy()||!authorization.healthy())fail('UNAVAILABLE');
    started=true;return status();
   }catch(error){
    if(!closed)unavailable();
    await close();
    if(error?.code==='TEMPORAL_PRODUCT_AUTHORIZATION_CLOSED')throw error;
    throw fault('UNAVAILABLE');
   }finally{
    const summary=life?.close();
    if(summary?.unsettledOperations>0||authorization?.failure()==='TEMPORAL_AUTHORIZATION_IO_UNKNOWN')failure='TEMPORAL_PRODUCT_AUTHORIZATION_IO_UNKNOWN';
    signal?.removeEventListener('abort',abort);active=null;refreshing=null;
   }
  })();return refreshing;
 }
 function close(){
  if(closing)return closing;
  closed=true;active?.abort();unwatchWriter?.();unwatchAuthorization?.();
  // close() on the canonical authorization clears its cached key synchronously.
  const authorizationClosed=authorization?.close();
  closing=(async()=>{
   if(!configuration.enabled){try{await writer.close();return Object.freeze({closed:true,physicalStopProven:false});}finally{watchers.clear();}}
   const life=lifetime();
   try{
    const outcomes=await life.run(()=>Promise.allSettled([authorizationClosed,writer.close()]));
    if(stopFailure||outcomes.some(result=>result.status==='rejected'))fail('CLEANUP_UNKNOWN');
    return Object.freeze({closed:true,physicalStopProven:false});
   }catch{failure??='TEMPORAL_PRODUCT_AUTHORIZATION_CLEANUP_UNKNOWN';throw fault('CLEANUP_UNKNOWN');}
   finally{const summary=life.close();if(summary.unsettledOperations>0||authorization?.failure()==='TEMPORAL_AUTHORIZATION_IO_UNKNOWN')failure='TEMPORAL_PRODUCT_AUTHORIZATION_IO_UNKNOWN';watchers.clear();}
  })();return closing;
 }
 return Object.freeze({start:refresh,refresh,close,healthy,status,
  readiness(){if(!healthy())fail('UNAVAILABLE');return Object.freeze({ready:true});},
  apiKey(){if(!healthy())fail('UNAVAILABLE');return authorization.apiKey();},
  attach(connection){if(!healthy())fail('UNAVAILABLE');return authorization.attach(connection);},
  current:()=>healthy()?authorization.current():null,
  failure:()=>failure,
  configuration:configuration.authorization??null,
  watch(listener){if(!callable(listener))fail('CONFIGURATION');watchers.add(listener);return ()=>watchers.delete(listener);},
 });
}
