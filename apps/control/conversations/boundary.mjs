/** Control request facts reuse the canonical contracts and data boundary. */
import {canonicalSha256, validateShape} from '../../../packages/contracts/validate.mjs';
import {data, own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export {canonicalSha256 as hash, validateShape, data, own};
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function fail(code){throw Object.assign(new Error(code),{code});}
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))fail('INVALID_REQUEST');return value;}
export function bounded(value,max=131072){const v=data(value);if(Buffer.byteLength(JSON.stringify(v))>max)fail('REQUEST_TOO_LARGE');return v;}
export function assertRun(run){validateShape('Run',run);for(const s of run.scopes)if(s.tenantId!==run.binding.tenantId||s.policyRevision!==run.policyRevision)fail('SCOPE_REFUSED');return run;}
export const terminal=state=>['completed','failed','cancelled'].includes(state);
const transitions={queued:['starting','failed','cancelled'],starting:['running','failed','cancelled'],running:['waiting-for-approval','paused','completed','failed','cancelled'],'waiting-for-approval':['running','paused','failed','cancelled'],paused:['queued','cancelled']};
export function nextState(previous,event){if(event.type!=='run.status'){if(terminal(previous)||previous==='queued')fail('RUN_NOT_WRITABLE');return previous;}const next=event.data.state;if(!transitions[previous]?.includes(next))fail('RUN_TRANSITION_REFUSED');return next;}
