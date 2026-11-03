/** Protected startup data, never a serialized admission capability or request input. */
import {createHash} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createOperatorBrowserAdmission,assertOperatorBrowserControl} from './browser-operator-admission.mjs';
const fail=()=>{throw Error('OPERATOR_CONTROL_CONFIGURATION_REFUSED');};
export function operatorCaseNames(caseId){
 if(!/^[a-f0-9]{12}$/u.test(caseId))fail();
 const prefix=`meri-case-${caseId}`;
 return {prefix,control:`${prefix}-control`,worker:`${prefix}-worker`,queue:`${prefix}-conversations`,runtime:`meri_case_${caseId}`};
}
export function operatorControlConfiguration(raw){
 const d=data(own(raw,['schema','caseId','sourceCommit','expiresAtMs','selection','material','configurationSha256','controlCapabilitySha256','temporal']));
 const names=operatorCaseNames(d.caseId),t=own(d.temporal,['address','namespace','taskQueue']);
 if(d.schema!=='meri-operator-control-startup/1'||!/^[a-f0-9]{40}$/u.test(d.sourceCommit)||
  !['configurationSha256','controlCapabilitySha256'].every(k=>/^[a-f0-9]{64}$/u.test(d[k]))||
  t.taskQueue!==names.queue||typeof t.address!=='string'||typeof t.namespace!=='string'||!t.namespace)fail();
 return d;
}
export function createOperatorControlAdmission(raw,configuration,capabilityBytes,sourceCommit){
 const d=operatorControlConfiguration(raw);
 const {address,namespace,taskQueue}=configuration.temporal;
 if(sourceCommit!==d.sourceCommit||hash(configuration)!==d.configurationSha256||hash({address,namespace,taskQueue})!==hash(d.temporal)||
  createHash('sha256').update(capabilityBytes.toString('utf8').trim()).digest('hex')!==d.controlCapabilitySha256)fail();
 const capability=createOperatorBrowserAdmission(d);
 assertOperatorBrowserControl(capability,{configuration,sourceCommit});
 return capability;
}
