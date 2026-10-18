import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
/** Product control has distinct public and protected listener applications.
 * Listener placement supplies trust; request headers never select a listener. */
import {USER_PREFERENCES_PATHS} from '../control/settings/user-application/protocol.mjs';
import {taskCommandPaths} from '../../packages/contracts/task-command-application/protocol.mjs';
import {ROUTINE_PATHS} from '../control/schedules/application-http.mjs';
import {TENANT_SETTINGS_PATHS} from '../control/settings/tenant-application/protocol.mjs';
import {OBJECTIVE_READER_PREFIX} from './product-ports/objective.mjs';
import {OBJECTIVE_RUNS_PREFIX} from './native-authority/objective-runs-http.mjs';
import {OBJECTIVE_GENERATION_START_PATH} from './objective-generation/start-application.mjs';
const absent=()=>Response.json({error:{code:'ROUTE_NOT_FOUND'}},{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const publicPath=path=>path==='/api/conversations'||path.startsWith('/api/conversations/')||path==='/api/action-followthrough/session'||Object.values(USER_PREFERENCES_PATHS).includes(path)||Object.values(taskCommandPaths).includes(path)||Object.values(ROUTINE_PATHS).includes(path)||Object.values(TENANT_SETTINGS_PATHS).includes(path)||path.startsWith('/api/documents/');
const privatePath=path=>path.startsWith('/v1/')||path.startsWith('/internal/conversations/')||path.startsWith(OBJECTIVE_READER_PREFIX);

export function createControlRouteApplications({assembly,candidate,router=null,poststart=null,privateIngress=null,objectiveReader=null,objectiveRuns=null,objectiveStart=null}){
 if(typeof assembly?.handle!=='function'||typeof candidate?.handle!=='function'||[objectiveReader,objectiveRuns,objectiveStart].some(app=>app!==null&&typeof app?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 const marker=privateIngress?.issue();
 if(router!==null&&(!marker||typeof router.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 if(poststart!==null&&(!marker||typeof poststart.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 return Object.freeze({
  public:Object.freeze({async handle(request){const path=new URL(request.url).pathname;
   // The Objective generation starter (default off) answers null when not composed: the route stays 404.
   if(path===OBJECTIVE_GENERATION_START_PATH)return (objectiveStart===null?null:await objectiveStart.handle(request))??absent();
   return publicPath(path)?assembly.handle(request):absent();}}),
  private:Object.freeze({async handle(request){const path=new URL(request.url).pathname;if(!privatePath(path))return absent();
   // Core's signed Objective reader v2 calls end here; they never reach poststart, the router, the native candidate or assembly.
   if(path.startsWith(OBJECTIVE_READER_PREFIX))return (objectiveReader===null?null:await objectiveReader.handle(request))??absent();
   // The Temporal worker's Objective `runs` native operations (control capability only); disabled answers null, so 404.
   if(path.startsWith(OBJECTIVE_RUNS_PREFIX))return (objectiveRuns===null?null:await objectiveRuns.handle(request))??absent();
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
  // With a private listener, readiness details are served only there; the public host gets liveness.
  publicListener=await listen({configuration,application:publicApplication,readiness,exposeReadiness:privateApplication===null,...(signal?{signal}:{})});checkStartup();
  return {publicListener,privateListener};
 }catch(error){
  // A failed public bind must retire the already-open private listener before startup returns.
  const results=await Promise.allSettled([publicListener?.close(),privateListener?.close()]);
  try{assertTemporalRuntimeCleanup(results);}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'CONTROL_BIND_AND_CLEANUP_FAILED'));}
  throw error;
 }
}
