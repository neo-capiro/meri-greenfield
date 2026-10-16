/** Closed native-task routing protocol; authority remains with the receiving task. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const taskRouterFault=()=>Object.assign(Error('TASK_ROUTER_REFUSED'),{code:'TASK_ROUTER_REFUSED'});
export const taskRouterFields=Object.freeze(Object.fromEntries(Object.entries({prepare:['descriptor'],start:['descriptorSha256'],stdin:['sequence','frame','end'],stdout:['sequence'],stop:[],inspect:[],retire:[],readiness:[], 'release-readiness':['taskArn'],release:['taskArn'],launch:['plan'],configuration:['tree'],registration:['request'],'workspace-restore':['request'],'workspace-verify':['request'],capture:['request'],'binding-read':[]}).map(([key,value])=>[key,Object.freeze(value)])));
const taskOperations=new Set(['prepare','start','stdin','stdout','stop']);
export function taskRouterOperation(value){if(typeof value!=='string'||!Object.hasOwn(taskRouterFields,value))throw taskRouterFault();return value;}
export function taskRouterRole(operation,control,task){taskRouterOperation(operation);return operation==='stop'?control||task:taskOperations.has(operation)?task:control;}
export function taskRouterBody(value,operation){return data(own(value,['original',...taskRouterFields[taskRouterOperation(operation)]]));}
/** Only the dedicated private listener may supply this marker; headers cannot create one. */
export function createTaskRouterIngress(){const markers=new WeakSet();return Object.freeze({issue(){const marker=Object.freeze({});markers.add(marker);return marker;},assert(marker){if(!markers.has(marker))throw taskRouterFault();}});}
/** ALB must append IPv4 without a port. The final element is the only trusted hop. */
export function taskRouterClientIPv4(value){
 if(typeof value!=='string'||value.length<1||value.length>4096||/[\r\n\x00]/u.test(value))throw taskRouterFault();
 const last=value.split(',').at(-1).trim(),parts=last.split('.');
 if(parts.length!==4||parts.some(part=>!/^(0|[1-9][0-9]{0,2})$/u.test(part)||Number(part)>255))throw taskRouterFault();
 const [a,b]=parts.map(Number);if(!(a===10||a===172&&b>=16&&b<=31||a===192&&b===168))throw taskRouterFault();return last;
}
