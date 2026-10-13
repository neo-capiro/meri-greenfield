/** Private selected task wire; selectors carry no authority or compiler brand. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256} from '../validate.mjs';
const fault=()=>{throw Object.assign(Error('SELECTED_WIRE_REFUSED'),{code:'SELECTED_WIRE_REFUSED'});};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
export function assertSelectedRequest(operation,raw){const v=data(raw);if(operation==='prepare')own(v,['binding','requestSha256']);else{
 const keys=['binding','sessionId','requestSha256','selectionSha256'];if(operation==='read')keys.push('operation','arguments','deliveryId');else if(operation==='finish')keys.push('structuredOutput');else if(operation==='publish')keys.push('completionId');else fault();own(v,keys);if(!uuid(v.sessionId)||!digest(v.selectionSha256))fault();
 if(operation==='read'&&(!/^(sdk|compiler):[a-f0-9]{64}$/u.test(v.deliveryId)||!v.arguments||typeof v.arguments!=='object'))fault();if(operation==='publish'&&!uuid(v.completionId))fault();
 }validateShape('RunBinding',v.binding);if(!digest(v.requestSha256)||Buffer.byteLength(JSON.stringify(v))>2097152)fault();return v;}
export function assertSelectedCompletion(raw,selector,inputSha256){const v=data(raw);own(v,['completionId','binding','state','requestSha256','selectionSha256','inputSha256','preparationSha256','readsSha256']);if(!uuid(v.completionId)||canonicalSha256(v.binding)!==canonicalSha256(selector.binding)||!['awaiting-output-approval','delivered'].includes(v.state)||v.requestSha256!==selector.requestSha256||v.selectionSha256!==selector.selectionSha256||v.inputSha256!==inputSha256||![v.preparationSha256,v.readsSha256].every(digest))fault();return v;}
