/** Explicit post-shipment opt-in for one trusted task-update run. Reuses the existing session, proposal and approval owners.
 * The host retains session issuance and runtime mounting. Disabled construction reads no service/session/journal ports. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createTaskUpdateServices} from '../intents/task-update-services.mjs';
import {createIntentMount} from '../intents/mount.mjs';
import {createPostgresIntentJournalStore} from '../intents/postgres-journal.mjs';
import {createTaskCommandApplication} from './index.mjs';
export function createTaskUpdateFeature(configuration){
 const c=own(configuration,['enabled'],['services','sessions','intentJournalPool','resultRelease','httpLimits']);
 if(typeof c.enabled!=='boolean')throw Error('TASK_UPDATE_CONFIGURATION');
 if(!c.enabled)return null;
 const session=own(c.sessions,['resolve']);if(typeof session.resolve!=='function')throw Error('TASK_UPDATE_CONFIGURATION');
 const services=createTaskUpdateServices(c.services),options=services.commandOptions;
 const intents=createIntentMount({binding:options.commandContext.binding,preparers:[services.preparer],
  journalStore:createPostgresIntentJournalStore({pool:c.intentJournalPool}),resultRelease:c.resultRelease,now:options.now,
  limits:{maxRequestMs:options.limits.maxRequestMs},enabled:true});
 const application=createTaskCommandApplication({now:options.now,limits:c.httpLimits,async resolveSession(value){
  // Existing session authority must resolve the browser credential freshly. Callers cannot replace the command owner.
  const fact=own(await session.resolve.call(c.sessions,value),['binding','authorizeExecution','checkedAtMs','expiresAtMs']);
  return {...fact,commandOptions:options};
 }});
 return Object.freeze({application,intents,commandExecutor:services.commandExecutor});
}
