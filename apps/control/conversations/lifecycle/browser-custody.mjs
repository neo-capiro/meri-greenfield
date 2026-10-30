/** Browser custody is an extension of the existing control projection, not a
 * second hold journal. These records describe one trusted host resource; Core
 * access and the locked run/control owners still decide every use. */
import {own,data,same,fail} from '../boundary.mjs';
import {assertBrowserCustody,assertBrowserReturn} from '../../../../packages/runtime/browser-custody.mjs';
export {BROWSER_CUSTODY_SCHEMA,assertBrowserCustody} from '../../../../packages/runtime/browser-custody.mjs';
export const isPauseIntent=intent=>intent==='pause'||intent==='takeover.begin';
export const isHoldIntent=intent=>isPauseIntent(intent)||intent==='approval.wait';
export const isResumeIntent=intent=>intent==='resume'||intent==='takeover.end';
export const continuationMode=intent=>intent==='takeover.end'?'resume':intent;
/** Validate even historical records without treating expiry as corruption. */
export function assertStoredBrowserCustody(control){
 if(control.browserCustody!==undefined){
  if(control.input.intent!=='takeover.begin'||control.state!=='APPLIED'||!control.proof||control.checkpointId!==control.sourceBinding.runId)fail('STORE_CORRUPT');
  assertBrowserCustody(control.browserCustody,{binding:control.sourceBinding,controlId:control.input.controlId});
  if(control.browserReturn!==undefined)assertBrowserReturn(control.browserReturn,control.browserCustody);
 }else if(control.browserReturn!==undefined)fail('STORE_CORRUPT');
 if(control.browserHandoff!==undefined){
  const h=own(control.browserHandoff,['custody','returned']);
  if(control.input.intent!=='takeover.end'||!control.target||!control.retirement||!control.proof)fail('STORE_CORRUPT');
  assertBrowserCustody(h.custody,{binding:control.sourceBinding});assertBrowserReturn(h.returned,h.custody);
 }else if(control.input.intent==='takeover.end'&&control.target)fail('STORE_CORRUPT');
}
export function createBrowserCustodyJournal({tx,verifyRun,lookup,pins,save,now}){
 async function held(client,{binding,scopes,selectedClientId},check){
  const run=await verifyRun(client,binding,scopes);check();
  if(!run.hold_control_id||run.projection.state!=='paused'||run.sequence_end!=null)fail('BROWSER_CUSTODY_REFUSED');
  const control=await lookup(client,binding,run.hold_control_id);check();
  if(!control||control.input.intent!=='takeover.begin'||control.state!=='APPLIED'||!control.browserCustody||!control.proof)fail('BROWSER_CUSTODY_REFUSED');
  pins(control,run,binding,scopes,selectedClientId);assertStoredBrowserCustody(control);
  if(control.browserCustody.expiresAtMs<=now())fail('BROWSER_CUSTODY_EXPIRED');
  return {run,control};
 }
 async function read(value,check){return tx(value.binding,check,async client=>{
  const {binding,scopes,selectedClientId}=value,run=await verifyRun(client,binding,scopes);check();
  const result={sourceBinding:binding,selectedClientId,state:'unavailable',controlId:null,checkpointId:null,checkpointSha256:null,
   ownerInstanceId:null,leaseEpoch:null,leaseExpiresAtMs:null,custody:null};
  if(run.sequence_end!=null||!run.hold_control_id)return data(result);
  const control=await lookup(client,binding,run.hold_control_id);check();
  if(!control)fail('STORE_CORRUPT');pins(control,run,binding,scopes,selectedClientId);
  if(control.input.intent!=='takeover.begin')return data(result);
  result.controlId=control.input.controlId;
  if(run.projection.state==='running'&&['PENDING','DISPATCHING'].includes(control.state))return data({...result,state:'pending'});
  if(run.projection.state!=='paused'||control.state!=='APPLIED'||!control.browserCustody)return data(result);
  assertStoredBrowserCustody(control);if(control.browserCustody.expiresAtMs<=now())return data(result);
  return data({...result,state:control.browserReturn?'released':'held',checkpointId:control.checkpointId,
   checkpointSha256:control.proof.checkpointSha256,ownerInstanceId:control.browserCustody.ownerInstanceId,
   leaseEpoch:control.browserReturn?.leaseEpoch??control.browserCustody.leaseEpoch,custody:control.browserCustody,
   ...(control.browserReturn?{returned:control.browserReturn}:{})});
 });}
 /** Only the trusted host's explicit hand-back is recorded. Replays must retain
  * the exact owner, next lease epoch and freshly filtered snapshot digest. */
 async function returning(value,check){const {returned,...selected}=own(value,['binding','scopes','selectedClientId','returned']);
  return tx(selected.binding,check,async client=>{const {control}=await held(client,selected,check),receipt=assertBrowserReturn(returned,control.browserCustody);
   if(control.browserReturn){if(!same(receipt,control.browserReturn))fail('BROWSER_CUSTODY_REFUSED');return control.browserReturn;}
   const next={...control,browserReturn:receipt};delete next.controlSequence;await save(client,selected.binding,next);check();return receipt;
  });
 }
 async function currentHost(client,{binding,scopes,selectedClientId,allocation},check){
  const {control}=await held(client,{binding,scopes,selectedClientId},check),custody=control.browserCustody;
  if(custody.hostId!==allocation.hostId||custody.generation!==allocation.generation)fail('BROWSER_CUSTODY_REFUSED');
  return data({binding,browserPolicySha256:custody.policySha256,browserAdmitted:true,sdkAdmitted:false,bashAdmitted:false,
   phase:'browser-held',currentUntilMs:Math.min(custody.expiresAtMs,allocation.leaseDeadlineMs),browserCustody:custody});
 }
 return Object.freeze({read,returning,currentHost});
}
