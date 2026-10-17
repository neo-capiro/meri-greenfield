/** Actual runtime startup of the authenticated issuer, canonical writer and key provider. */
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createTemporalAuthorization,createTemporalTokenFileReader} from './temporal-authorization.mjs';
import {createTemporalProductAuthorization} from './temporal-product-authorization.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {startTemporalProductBootstrap} from './temporal-product-bootstrap.mjs';
import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';

export async function readRuntimeTemporalTls(config){const [serverRootCACertificate,crt,key]=await Promise.all([readSecret(config.caFile),readSecret(config.certFile),readSecret(config.keyFile)]);return {serverRootCACertificate,clientCertPair:{crt,key}};}

/** The default product path loads the concrete issuer client. Supplied delivery
 * and owner factories are trusted test boundaries, never JSON/module selectors.
 * The caller owns its connection/poller and synchronously fences them on loss. */
export async function startRuntimeTemporalAuthorization(configuration,options={}){
 const o=own(options,[],['signal','onUnavailable','delivery','testOwners']);nativeSignal(o.signal);
 const t=configuration.temporal;if(t.authorization===undefined)return null;
 if(t.tokenWriter===undefined){
  if(o.delivery!==undefined||o.testOwners!==undefined)throw fault('TEMPORAL_PRODUCT_CONFIGURATION');
  const authorization=createTemporalAuthorization({configuration:t.authorization,reader:createTemporalTokenFileReader({tokenFile:t.authorization.tokenFile})});
  try{await authorization.refresh({signal:o.signal});return authorization;}catch(error){await authorization.close();throw error;}
 }
 if(t.tokenWriter.enabled!==true||t.issuerDelivery===undefined||typeof o.onUnavailable!=='function')throw fault('TEMPORAL_PRODUCT_CONFIGURATION');
 const {createDelivery,createBootstrap,...lifecycleOwners}=own(o.testOwners??{},[],['createWriter','createReader','createDelivery','createBootstrap']);
 if(createDelivery!==undefined&&typeof createDelivery!=='function')throw fault('TEMPORAL_PRODUCT_CONFIGURATION');
 let delivery=o.delivery,lifecycle,bootstrap,client,clientRevision,owned=false,reading=false,closing;
 const close=()=>closing??=(async()=>{
  const results=await Promise.allSettled([lifecycle?.close(),owned?client?.close():undefined,bootstrap?.close(),...(owned?[Promise.resolve({pendingRequests:reading?1:0})]:[])]);
  assertTemporalRuntimeCleanup(results);
 })();
 try{
  if(delivery===undefined){
   const {createTemporalIssuerDelivery,parseTemporalIssuerDeliveryConfiguration}=await import('./temporal-issuer/client.mjs');
   // Validate before the issuer client may inspect private material.
   parseTemporalIssuerDeliveryConfiguration(t.issuerDelivery);
   bootstrap=await (createBootstrap??startTemporalProductBootstrap)(configuration,{signal:o.signal,onUnavailable:o.onUnavailable});
   if(!bootstrap||typeof bootstrap.ensureCurrent!=='function')throw fault('TEMPORAL_PRODUCT_CONFIGURATION');
   const drain=async()=>{const receipt=client?await client.close():{unsettledOperations:0};assertTemporalRuntimeCleanup([{status:'fulfilled',value:receipt}]);client=null;clientRevision=null;return receipt;};
   delivery=Object.freeze({async read(request){
    if(reading||closing)throw fault('TEMPORAL_PRODUCT_UNAVAILABLE');reading=true;
    try{
     const current=await bootstrap.ensureCurrent({signal:request.signal,beforeRotation:drain});
     if(!client||clientRevision!==current.revision){
      if(client)await drain();
      client=await (createDelivery??createTemporalIssuerDelivery)({configuration:parseTemporalIssuerDeliveryConfiguration(current.issuerDeliveryConfiguration),readMaterial:readSecret,now:Date.now});
      clientRevision=current.revision;
     }
     return await storageMethod(client,'read')(request);
    }finally{reading=false;}
   }});owned=true;
  }
  const read=storageMethod(delivery,'read');
  lifecycle=createTemporalProductAuthorization({configuration:t.tokenWriter,delivery:Object.freeze({read}),onUnavailable:o.onUnavailable},lifecycleOwners);
  await lifecycle.start({signal:o.signal});o.signal?.throwIfAborted();
  return Object.freeze({...lifecycle,close});
 }catch(error){try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'TEMPORAL_STARTUP_AND_CLEANUP_FAILED'));}throw error;}
}
