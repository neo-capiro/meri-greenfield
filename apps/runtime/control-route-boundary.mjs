import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
/** Product control has distinct public and protected listener applications.
 * Listener placement supplies trust; request headers never select a listener. */
import {OFFICE_ROUTES} from '../../packages/contracts/office-application/receive.mjs';
import {USER_PREFERENCES_PATHS} from '../control/settings/user-application/protocol.mjs';
import {taskCommandPaths} from '../../packages/contracts/task-command-application/protocol.mjs';
import {ROUTINE_PATHS} from '../control/schedules/application-http.mjs';
import {ROUTINE_MANAGEMENT_SESSION_PATH} from '../../packages/contracts/schedules-0.2/application-protocol.mjs';
import {TENANT_SETTINGS_PATHS} from '../control/settings/tenant-application/protocol.mjs';
import {MEMORY_PATHS} from '../control/memory/protocol.mjs';
import {DATA_ACCESS_PATH} from '../control/data-access/protocol.mjs';
import {matchUploadApplicationPath} from '../control/uploads/application.mjs';
import {OBJECTIVE_READER_PREFIX} from './product-ports/objective.mjs';
import {OBJECTIVE_ACTIVITIES_PREFIX} from './native-authority/objective-runs-http.mjs';
import {ROUTINES_OCCURRENCE_PREFIX} from './native-authority/routines-occurrence-http.mjs';
import {OBJECTIVE_GENERATION_START_PATH} from './objective-generation/start-application.mjs';
import {APPROVAL_METADATA_READ_PATH} from './agentcore-control-http.mjs';
import {workspaceGenerationPaths} from '../control/conversations/workspace-generation/protocol.mjs';
import {RETENTION_WITNESS_PATH} from '../control/retention/serving-witness.mjs';
import {NATIVE_OBSERVER_ROUTE} from '../../packages/contracts/native-observer.mjs';
import {SOURCE_EVENT_BINDING_PATH,SOURCE_EVENT_PATH} from '../control/schedules/source-event-contract.mjs';
import {OBJECTIVE_ACTIVITY_OPERATIONS} from './native-authority/objective-runs-http.mjs';
import {ROUTINES_OCCURRENCE_OPERATIONS} from './native-authority/routines-occurrence-http.mjs';
import {runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {BROWSER_RUN_OPERATIONS} from '../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {BROWSER_VIEWER_ROUTES} from '../../packages/contracts/browser-viewer/receive.mjs';
const SOURCE_EVENT_PATHS=Object.freeze([SOURCE_EVENT_PATH,SOURCE_EVENT_BINDING_PATH]);
/** The closed set of route patterns each listener answers, for the per-route response counters (telemetry/route-counters.mjs).
 * `:id` stands for exactly one identifier segment; a path matching none of these is counted as `other`, never as itself, so the
 * `Route` metric dimension can only take these values. Route tables are reused where a module exports one; the conversation,
 * document, upload, runner and native-task families list the literal operations their own route matchers accept. */
const RUN_OWNER_OPERATIONS=[...Object.keys(runOwnerOperations),'child-dispatch','child-settle',...Object.keys(BROWSER_RUN_OPERATIONS)];
export const CONTROL_ROUTE_PATTERNS=Object.freeze({
 public:Object.freeze([
  ...OFFICE_ROUTES.map(route=>'/api/meri/office/'+route),'/api/outreach-generation/start',OBJECTIVE_GENERATION_START_PATH,'/api/conversations',
  ...['submit','history','cancel','events','feedback','feedback-read','list','transcript','export','manage','summaries','next-turn','usage','usage-overview','source-read','control','input/admit','input/allocate',
   'deletions/list','deletions/status','runs/list','runs/detail','checkpoints/inspect','intents/list','intents/inbox','intents/inbox-count','intents/decide'].map(route=>'/api/conversations/'+route),
  '/api/conversations/events/:id/stream','/api/action-followthrough/session','/api/action-followthrough/browser-session','/api/action-followthrough/query',
  ...BROWSER_VIEWER_ROUTES.map(route=>'/api/meri/browser/'+route),ROUTINE_MANAGEMENT_SESSION_PATH,...Object.values(USER_PREFERENCES_PATHS),...Object.values(taskCommandPaths),
  ...Object.values(ROUTINE_PATHS),...Object.values(TENANT_SETTINGS_PATHS),...Object.values(MEMORY_PATHS),DATA_ACCESS_PATH,
  ...['create','revise','inspect','download','history','list','results','preview','preview-publish','federal-prepare','federal-load','federal-publish','federal-import','federal-approve','federal-history','links/issue','links/redeem'].map(route=>'/api/documents/'+route),
  ...['initiate','status','inspect','read','remove','original/:id'].map(route=>'/api/uploads/'+route),
 ]),
 private:Object.freeze([
  '/api/meri/office/wopi/files/:id','/api/meri/office/wopi/files/:id/contents',NATIVE_OBSERVER_ROUTE,RETENTION_WITNESS_PATH,APPROVAL_METADATA_READ_PATH,...Object.values(workspaceGenerationPaths),
  ...['acceptance/read','completion/read','retained-result/read'].map(route=>OBJECTIVE_READER_PREFIX+route),
  ...Object.values(OBJECTIVE_ACTIVITY_OPERATIONS).map(operation=>'/v1/'+operation),...Object.values(ROUTINES_OCCURRENCE_OPERATIONS).map(operation=>'/v1/'+operation),...SOURCE_EVENT_PATHS,
  ...RUN_OWNER_OPERATIONS.map(operation=>'/internal/conversations/'+operation),...RUN_OWNER_OPERATIONS.map(operation=>'/v1/runner/'+operation),
  ...['runtime','execution','execution/settle','checkpoint/capture','checkpoint/complete','checkpoint/read','files/capture','files/complete','files/restore','reads/execute','intents/availability','intents/prepare',
   'native/bootstrap','native/admitted','native/start','session/load','session/snapshot','outreach/complete','outreach/fail'].map(route=>'/v1/runner/'+route),
  ...['inspect','prepare','probe','release','release-readiness'].map(route=>'/v1/native-task/'+route),'/v1/runner-poststart/challenge','/v1/runner-poststart/redeem',
  '/v1/checkpoint/read','/v1/context/resolve','/v1/identity/verify','/v1/worker/authorize','/v1/readiness','/v1/retention/sweep','/v1/native-processing/lifecycle',
  '/v1/execution/kickoff','/v1/execution/kickoff/status','/v1/execution/kickoff/stop','/v1/execution/poll','/v1/execution/native/host-authority','/v1/execution/native/host-teardown','/v1/execution/native/prerequisite',
  '/v1/selected/read','/v1/selected/publish','/v1/selected/finish',
 ]),
});
const absent=()=>Response.json({error:{code:'ROUTE_NOT_FOUND'}},{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const OFFICE_PUBLIC_PATHS=Object.freeze(OFFICE_ROUTES.map(route=>'/api/meri/office/'+route));
const publicPath=path=>OFFICE_PUBLIC_PATHS.includes(path)||path==='/api/outreach-generation/start'||path==='/api/conversations'||path.startsWith('/api/conversations/')||path==='/api/action-followthrough/session'||path==='/api/action-followthrough/browser-session'||path.startsWith('/api/meri/browser/')||path==='/api/action-followthrough/query'||path===ROUTINE_MANAGEMENT_SESSION_PATH||Object.values(USER_PREFERENCES_PATHS).includes(path)||Object.values(taskCommandPaths).includes(path)||Object.values(ROUTINE_PATHS).includes(path)||Object.values(TENANT_SETTINGS_PATHS).includes(path)||Object.values(MEMORY_PATHS).includes(path)||path===DATA_ACCESS_PATH||path.startsWith('/api/documents/')||Boolean(matchUploadApplicationPath(path));
const privatePath=path=>path.startsWith('/v1/')||path.startsWith('/internal/conversations/')||path.startsWith(OBJECTIVE_READER_PREFIX);

export function createControlRouteApplications({assembly,candidate,router=null,poststart=null,privateIngress=null,objectiveReader=null,approvalMetadataReader=null,objectiveRuns=null,objectiveStart=null,routinesOccurrences=null,sourceEvents=null,workspaceGeneration=null,retentionWitness=null,office=null,nativeObserver=null}){
 if(typeof assembly?.handle!=='function'||typeof candidate?.handle!=='function'||(office!==null&&(typeof office?.handleControl!=='function'||typeof office?.handleWopi!=='function'))||[objectiveReader,approvalMetadataReader,objectiveRuns,objectiveStart,routinesOccurrences,sourceEvents,workspaceGeneration,retentionWitness,nativeObserver].some(app=>app!==null&&typeof app?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 const marker=privateIngress?.issue();
 if(router!==null&&(!marker||typeof router.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 if(poststart!==null&&(!marker||typeof poststart.privateApplication?.handle!=='function'))throw Error('PRIVATE_CONTROL_CONFIGURATION');
 return Object.freeze({
  public:Object.freeze({async handle(request){const path=new URL(request.url).pathname;
   // The Objective generation starter (default off) answers null when not composed: the route stays 404.
   if(path===OBJECTIVE_GENERATION_START_PATH)return (objectiveStart===null?null:await objectiveStart.handle(request))??absent();
   if(OFFICE_PUBLIC_PATHS.includes(path))return office===null?absent():(await office.handleControl(request))??absent();
   return publicPath(path)?assembly.handle(request):absent();}}),
  private:Object.freeze({async handle(request){const path=new URL(request.url).pathname;
   if(path.startsWith('/api/meri/office/wopi/files/'))return office===null?absent():(await office.handleWopi(request))??absent();
   if(!privatePath(path))return absent();
   if(path===NATIVE_OBSERVER_ROUTE)return nativeObserver===null?absent():(await nativeObserver.handle(request))??absent();
   if(path===RETENTION_WITNESS_PATH)return (retentionWitness===null?null:await retentionWitness.handle(request))??absent();
   if(path===APPROVAL_METADATA_READ_PATH)return (approvalMetadataReader===null?null:await approvalMetadataReader.handle(request))??absent();
   // The Workspace generation leaf: the current identity credential in the request authenticates the
   // turn; the Core service secret is transport. Not composed, the route is absent.
   if(Object.values(workspaceGenerationPaths).includes(path))return (workspaceGeneration===null?null:await workspaceGeneration.handle(request))??absent();
   // Core's saved-job readback stays on the private listener.
   if(path.startsWith(OBJECTIVE_READER_PREFIX))return (objectiveReader===null?null:await objectiveReader.handle(request))??absent();
   // The Temporal worker's Objective `runs` native operations (control capability only); disabled answers null, so 404.
   if(path.startsWith(OBJECTIVE_ACTIVITIES_PREFIX))return (objectiveRuns===null?null:await objectiveRuns.handle(request))??absent();
   // The schedule worker's routine occurrence operations (control capability only, lane B3); disabled answers null, so 404.
   if(path.startsWith(ROUTINES_OCCURRENCE_PREFIX))return (routinesOccurrences===null?null:await routinesOccurrences.handle(request))??absent();
   // MB-05 producer events (private listener only; listener placement is the trust boundary).
   // `/v1/...` is already the private classifier, so no public path, middleware or guard changes.
   if(SOURCE_EVENT_PATHS.includes(path))return (sourceEvents===null?null:await sourceEvents.handle(request))??absent();
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
