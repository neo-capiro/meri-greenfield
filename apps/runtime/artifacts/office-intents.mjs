/** The governed same-document Office owner for one control process: the `propose_office_edit` preparer for a run
 * whose immutable request selected an Office version, and the approval ports that apply or read a retained
 * proposal under the approver's current attended session. Every read and write goes through the existing
 * office access owner (current Core artifact authority, retention, exact bytes) and the artifact publisher;
 * this module borrows sessions and never mints, stores or forwards a credential. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {officeEditValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../../control/action-host/session/owner.mjs';
import {createOfficeEditPreparer} from '../../control/intents/office-edit-preparer.mjs';
import {currentAttendedSession} from '../native-authority/approval-session.mjs';
import {documentRevisionSelectionFor} from './intent-binding.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createOfficeIntentOwner({context,application,sessions,store,retention,now,limits}){
 if(!context||typeof context!=='object'||types.isProxy(context)||['readSelected','applyProposal','readProposal'].some(k=>typeof application?.[k]!=='function')||typeof now!=='function'||!Number.isSafeInteger(limits?.maxRequestMs))fail('OFFICE_CONFIGURATION');
 const borrow=borrowedRunSession(sessions);if(typeof borrow!=='function')fail('OFFICE_CONFIGURATION');
 /** Composed only for a run with a selected document; the read itself refuses a selection that is not Office. */
 async function prepareForRun(value){
  const v=own(value,['binding','scopes','selectedClientId','policyRevision','currentRights','deadlineMs'],['signal']);
  const selection=await documentRevisionSelectionFor(context,{binding:v.binding,signal:v.signal});
  if(selection===null)return [];
  const document={async read({signal}){
   const session=assertActionSessionReceipt(await borrow({binding:v.binding,selectedClientId:v.selectedClientId,signal}),now());
   return application.readSelected({credential:session.credential,selection,deadlineMs:Math.min(v.deadlineMs,session.expiresAtMs),signal});
  }};
  return [createOfficeEditPreparer({binding:v.binding,scopes:v.scopes,selectedClientId:v.selectedClientId,document,now,deadlineMs:v.deadlineMs,currentRights:v.currentRights,policyRevision:v.policyRevision})];
 }
 /** The approver's live attended session for the proposal's own conversation and scopes; Core still decides access. */
 async function attended(proposal,signal,deadlineMs){
  if(!store)fail('UNAVAILABLE');
  const check=()=>{signal?.throwIfAborted();if(now()>=deadlineMs)fail('DEADLINE');};
  return currentAttendedSession({store,sessions,retention,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId:proposal.context.selectedClientId,signal,check});
 }
 const run=method=>async value=>{
  const v=own(value,['proposal'],['principal','signal','deadlineMs']),proposal=officeEditValidators.assertProposal(v.proposal);
  if(v.principal!==undefined&&(v.principal.tenantId!==proposal.binding.tenantId||v.principal.actorId!==proposal.binding.actorId))fail('ACCESS_DENIED');
  const deadlineMs=Math.min(v.deadlineMs??Infinity,now()+limits.maxRequestMs),current=await attended(proposal,v.signal,deadlineMs);
  return application[method]({credential:current.session.credential,proposal,deadlineMs:Math.min(deadlineMs,current.session.expiresAtMs),signal:v.signal});
 };
 return Object.freeze({prepareForRun,apply:run('applyProposal'),read:run('readProposal')});
}
