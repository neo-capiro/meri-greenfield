import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
/** Product control has distinct public and protected listener applications.
 * Listener placement supplies trust; request headers never select a listener. */
const absent=()=>Response.json({error:{code:'ROUTE_NOT_FOUND'}},{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const publicPath=path=>path==='/api/conversations'||path.startsWith('/api/conversations/')||path==='/api/action-followthrough/session';
const privatePath=path=>path.startsWith('/v1/')||path.startsWith('/internal/conversations/');

export function createControlRouteApplications({assembly,candidate,router=null,poststart=null,privateIngress=null}){
 if(typeof assembly?.handle!=='function'||typeof candidate?.handle!=='function')throw Error('PRIVATE_CONTROL_CONFIGURATION');
 const marker=privateIngress?.issue();
 if(router!==null&&(!marker||typeof router.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 if(poststart!==null&&(!marker||typeof poststart.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 return Object.freeze({
  public:Object.freeze({handle(request){const path=new URL(request.url).pathname;return publicPath(path)?assembly.handle(request):absent();}}),
  private:Object.freeze({async handle(request){const path=new URL(request.url).pathname;if(!privatePath(path))return absent();
   if(poststart!==null){const delivered=await poststart.privateApplication.handle(request,{ingress:marker});if(delivered!==null)return delivered;}
   if(router!==null){const routed=await router.privateApplication.handle(request,{ingress:marker});if(routed!==null)return routed;}
   const native=await candidate.handle(request);if(native!==null)return native;
   if(path.startsWith('/internal/conversations/'))return await assembly.handle(request)??absent();
   return absent();}})
 });
}

/** Do not expose public first-chat routes until their private native route is listening. */
export async function listenControlApplications({configuration,publicApplication,privateApplication,readiness,signal,listen,checkStartup=()=>{}}){
 if(typeof checkStartup!=='function'||typeof listen!=='function'||typeof publicApplication?.handle!=='function'||privateApplication!==null&&typeof privateApplication?.handle!=='function')throw Error('PRIVATE_CONTROL_CONFIGURATION');
 let publicListener,privateListener;
 try{
  checkStartup();
  if(privateApplication!==null){privateListener=await listen({configuration:{...configuration,http:configuration.privateHttp},application:privateApplication,readiness,...(signal?{signal}:{})});checkStartup();}
  publicListener=await listen({configuration,application:publicApplication,readiness,...(signal?{signal}:{})});checkStartup();
  return {publicListener,privateListener};
 }catch(error){
  // A failed public bind must retire the already-open private listener before startup returns.
  const results=await Promise.allSettled([publicListener?.close(),privateListener?.close()]);
  try{assertTemporalRuntimeCleanup(results);}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'CONTROL_BIND_AND_CLEANUP_FAILED'));}
  throw error;
 }
}
