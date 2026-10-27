/** Control-only actor-authenticated calls to the existing Outreach job owner. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {outreachSelection,outreachFailure} from '../../../packages/runtime/outreach-generation.mjs';
export function createOutreachCore({origin,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=3000}){
 const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw outreachFailure();
 async function call(operation,input,{credential,signal,deadlineMs=now()+maxRequestMs}){
  if(!['claim','read','complete','fail'].includes(operation)||typeof credential!=='string'||!credential||credential.length>8192)throw outreachFailure();
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:outreachFailure});
  try{
   const r=await life.run(signal=>fetchImpl(new URL('/api/engagement/outreach/sdk/'+operation,base),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{authorization:'Bearer '+credential,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(data(input))}));
   if(r.status!==200&&r.status!==201||r.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(r.headers.get('content-type')??'')){void r.body?.cancel().catch(()=>{});throw outreachFailure();}
   const length=r.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw outreachFailure();
   const value=await jsonBody({body:r.body,length:length===null?null:Number(length)},524288,life,life.check);
   if(operation==='claim'||operation==='read')return operation==='read'&&value===null?null:outreachSelection(value);
   const result=data(own(value,['status','result']));if(!(operation==='complete'?['done','held','failed']:['failed','unknown']).includes(result.status)||operation==='fail'&&result.result!==null)throw outreachFailure();
   return result;
  }finally{life.close();}
 }
 return Object.freeze(Object.fromEntries(['claim','read','complete','fail'].map(operation=>[operation,(input,options)=>call(operation,input,options)])));
}
