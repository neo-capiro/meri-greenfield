/** Hash data options and declared callback surfaces, never invoke worker getters. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault} from './execution-broker.mjs';
const callbacks=new Set(['abortController','sessionStore','canUseTool','mcpServers','hooks']);
const fields=['cwd','settingSources','settings','skills','allowedTools','tools','permissionMode','includePartialMessages','systemPrompt','model','maxTurns','maxBudgetUsd','sessionStoreFlush','env','resume','forkSession','resumeSessionAt','outputFormat'];
const singleton=value=>{if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)refuse();const d=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(d).length!==2||d.length?.value!==1||!Object.hasOwn(d['0']??{},'value'))refuse();return d['0'].value;};
const refuse=()=>{throw executionFault('SDK_OPTIONS_REFUSED');};
export function projectNativeSdkOptions(options){
 const o=own(options,[],[...fields,...callbacks]),result={};
 for(const [k,v]of Object.entries(o)){
  if(!callbacks.has(k)){if(k==='env'){if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))refuse();const env=own(v,[],Object.keys(v));result.env=Object.fromEntries(Object.entries(env).map(([name,value])=>[name,value===undefined?null:value]));}else result[k]=v;continue;}
  if(k==='canUseTool'){if(typeof v!=='function'||types.isProxy(v))refuse();result[k]='approved-runner-callback';}
  else if(k==='abortController'){if(types.isProxy(v)||!(v instanceof AbortController))refuse();result[k]='owned-abort-controller';}
  else if(k==='sessionStore'){const s=own(v,['load','append'],['listSubkeys']);if(Object.values(s).some(fn=>typeof fn!=='function'||types.isProxy(fn)))refuse();result[k]=Object.keys(s).sort();}
  else if(k==='mcpServers'){const servers=own(v,[],['meri_original_reads']),s=own(servers.meri_original_reads,['type','name','instance'],['timeout']);if(s.type!=='sdk'||s.name!=='meri_original_reads')refuse();storageMethod(s.instance,'close');if(s.timeout!==undefined&&(!Number.isSafeInteger(s.timeout)||s.timeout<1||s.timeout>2147483647))refuse();result[k]={meri_original_reads:{type:s.type,name:s.name,instance:'approved-runner-server',...(s.timeout===undefined?{}:{timeout:s.timeout})}};}
  else{const h=own(v,['PreToolUse']);const row=own(singleton(h.PreToolUse),['matcher','hooks']);if(typeof singleton(row.hooks)!=='function'||types.isProxy(singleton(row.hooks)))refuse();result[k]={PreToolUse:[{matcher:row.matcher,hooks:['approved-runner-callback']}]};}
 }
 return data(result);
}
