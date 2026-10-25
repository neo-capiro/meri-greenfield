/** Standalone task-update mounting over the same attended native intent owners. Construction is inert. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createStandaloneTaskApplication,createStandaloneActionApplication} from '../native-authority/standalone-tasks.mjs';
import {intentsComposition} from './intents.mjs';
export function createTasksFamily(context){
 const shared=intentsComposition(context),state=()=>context.configuration.sourceEnabled===true&&context.configuration.retention!==undefined&&shared.state==='composed'&&shared.tasks?'composed':'disabled';
 const actionState=()=>state()==='composed'&&context.configuration.reads?.enabled===true?'composed':'disabled';
 return {ports:{taskCommandApplicationFactory:Object.freeze({state,create(value){
  const {sessions,conversationStore,retention}=own(value,['sessions'],['conversationStore','retention']);
  if(state()!=='composed')return null;
  return createStandaloneTaskApplication({context,sessions,store:conversationStore,retention,shared});
 }}),actionApplicationFactory:Object.freeze({state:actionState,create(value){
  const {sessions,conversationStore,retention}=own(value,['sessions'],['conversationStore','retention']);
  if(actionState()!=='composed')return null;
  return createStandaloneActionApplication({context,sessions,store:conversationStore,retention,shared});
 }})}};
}
