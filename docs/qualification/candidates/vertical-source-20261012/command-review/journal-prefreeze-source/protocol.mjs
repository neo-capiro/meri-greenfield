/** Command-specific inert boundaries and content-free failures. */
import {types} from 'node:util';
import {snapshotOperationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
export class CommandError extends Error {constructor(code){super(code);this.name='CommandError';}}
export class CommandCommitUncertain extends CommandError {constructor(){super('COMMAND_COMMIT_UNCERTAIN');}}
export const deny=code=>{throw new CommandError(code);};
export function own(value,required,optional=[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))deny('INVALID_COMMAND');
 const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
 if(required.some(k=>!Object.hasOwn(d,k))||keys.some(k=>typeof k!=='string'||![...required,...optional].includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))deny('INVALID_COMMAND');
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
export function data(value){const v=snapshotOperationData(value);const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};return freeze(v);}
export const safe=error=>error instanceof CommandError?error:new CommandError('COMMAND_REFUSED');
export function nativeSignal(value){if(value!==undefined&&(types.isProxy(value)||!(value instanceof AbortSignal)))deny('INVALID_COMMAND');return value;}
export function instant(value){const n=Date.parse(value);if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)deny('INVALID_COMMAND');return n;}
