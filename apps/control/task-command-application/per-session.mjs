/** Per-session task-update application for a control serving many runs.
 *
 * `createTaskUpdateFeature` (feature.mjs) composes ONE run: `createTaskUpdateServices` binds its command context, budget producer
 * and approval-metadata owner to that run's binding (`intents/task-update-services.mjs`), and the native session correlator
 * (`native-session.mjs`) refuses every session whose run differs. A process-wide control therefore cannot construct it at startup.
 *
 * This owner builds the services per request, for the run of the request's own session:
 *  1. SELECT: one `authenticateSession` + `readCurrentState` on the canonical session owner, only to learn which run binding and
 *     selected client the session is on. Selection is never authority.
 *  2. `servicesFor({binding, selectedClientId, signal, deadlineMs})` (trusted; the Core grant owner) returns that run's
 *     `createTaskUpdateServices(...)` result. Its command context must be the run the session is on (stable keys); for a fresh
 *     attempt of the same run it is the run's ORIGINAL binding, so an approved proposal of that run stays executable.
 *  3. The existing native correlator is built over exactly those services and resolves the request: it re-authenticates, rereads
 *     current state and requires the exact binding for prepare (stable keys for execute) before and after every metadata,
 *     capability and execution step, exactly as for a single-run feature. A session cannot reach another run's services.
 *
 * Services are rebuilt per request (construction is inert); the grant owner binds the executor's trusted grant itself. Borrowed
 * session, grant and pool owners are never closed here. Construction calls nothing. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {refuse} from '../action-host/current.mjs';
import {createTaskCommandApplication} from './index.mjs';
import {createTaskCommandSessionResolver} from './native-session.mjs';
const STABLE=['tenantId','actorId','conversationId','runId'];
export function createPerSessionTaskUpdateApplication(configuration){
 const c=own(configuration,['sessions','servicesFor','authorizeExecution','now','httpLimits']);
 if(typeof c.servicesFor!=='function'||typeof c.authorizeExecution!=='function'||typeof c.now!=='function')throw Error('TASK_UPDATE_CONFIGURATION');
 const ports={authenticateSession:storageMethod(c.sessions,'authenticateSession'),readCurrentState:storageMethod(c.sessions,'readCurrentState')};
 /** Which run this session is on. Untrusted for authority: step 3 re-derives and compares everything. */
 async function select({credential,signal,deadlineMs}){
  const authentication=data(await ports.authenticateSession({credential,signal,deadlineMs}));
  const current=data(await ports.readCurrentState({authentication,signal,deadlineMs}));
  try{validateShape('RunBinding',current.binding);}catch{refuse();}
  if(typeof current.selectedClientId!=='string'||STABLE.some(k=>current.binding[k]!==authentication.principal?.[k]))refuse();
  return {binding:current.binding,selectedClientId:current.selectedClientId};
 }
 return createTaskCommandApplication({now:c.now,limits:c.httpLimits,async resolveSession(value){
  const call=own(value,['credential','intent','deadlineMs'],['signal']);
  const selection=await select(call);
  const services=own(await c.servicesFor({...selection,signal:call.signal,deadlineMs:call.deadlineMs}),['commandOptions'],['commandExecutor','commands','preparer']);
  const options=services.commandOptions;
  if(STABLE.some(k=>options?.commandContext?.binding?.[k]!==selection.binding[k]))refuse();
  const resolver=createTaskCommandSessionResolver({sessions:c.sessions,commandOptions:options,selectedClientId:selection.selectedClientId,authorizeExecution:c.authorizeExecution,now:c.now});
  return resolver.resolve(call);
 }});
}
