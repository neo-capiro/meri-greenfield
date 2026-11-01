/** Filtered model tool boundary shared by native stdio and authenticated Control calls.
 * The caller authenticates its transport. Only the session owner supplies tools/call. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';
import {browserRefusalCode,browserRefusalResult,isBrowserRefusalResult} from '../browser/refusals.mjs';

export const BROWSER_MODEL_MAX_BYTES=262144;
const fail=()=>{throw Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'});};
const wire=value=>{const result=data(value);if(Buffer.byteLength(JSON.stringify(result))>BROWSER_MODEL_MAX_BYTES)fail();return result;};

export function createBoundBrowserModelPort({binding,policy,tools,call,deadlineMs=Number.MAX_SAFE_INTEGER,now=Date.now}){
 const bound=data(binding);validateShape('RunBinding',bound);const digest=canonicalSha256(bound),admitted=validateBrowserPolicy(policy);
 if(!admitted.enabled||typeof tools!=='function'||typeof call!=='function'||typeof now!=='function'||!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())fail();
 const owner=new AbortController();let closed=false;
 const input=(raw,keys)=>{const q=own(raw,['binding',...keys],['signal']);nativeSignal(q.signal);
  if(closed||q.signal?.aborted||canonicalSha256(data(q.binding))!==digest)fail();return q;};
 const run=async(signal,operation)=>{
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+Math.min(admitted.timeouts.actionMs+admitted.timeouts.navigationMs,130000)),
   now,signal:signal?AbortSignal.any([signal,owner.signal]):owner.signal,errorFactory:()=>Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'})});
  try{const value=await life.run(operation);life.check();if(closed)fail();return value;}
  catch{fail();}finally{life.close();}
 };
 return Object.freeze({
  async tools(raw){
   try{const q=input(raw,[]);return await run(q.signal,async signal=>{
    const listed=wire(await tools({signal}));
    if(!Array.isArray(listed)||listed.length>admitted.tools.length||listed.some(t=>!admitted.tools.includes(t?.name))||
     new Set(listed.map(t=>t.name)).size!==listed.length)fail();
    return wire({tools:listed});
   });}catch{fail();}
  },
  async call(raw){
   try{const q=input(raw,['requestId','tool','args']),request=wire({requestId:q.requestId,tool:q.tool,args:q.args});
    if(typeof request.requestId!=='string'||!/^[0-9a-f]{64}$/u.test(request.requestId)||!admitted.tools.includes(request.tool)||
     !request.args||typeof request.args!=='object'||Array.isArray(request.args))fail();
    return await run(q.signal,async signal=>{
     // A closed refusal from the session owner is delivered to the model as its fixed text result; anything
     // else stays a transport failure. The refusal carries no page content and crosses the wire unchanged.
     let answered;
     try{answered=await call({...request,signal});}
     catch(error){const code=browserRefusalCode(error);if(code==='BROWSER_CALL_REFUSED')throw error;return browserRefusalResult(code);}
     const result=wire(answered);own(result,['content'],['isError']);
     if(Object.hasOwn(result,'isError')&&!isBrowserRefusalResult(result))fail();
     if(!Array.isArray(result.content)||!result.content.length||result.content.some(x=>!x||Object.keys(x).sort().join(',')!=='text,type'||x.type!=='text'||typeof x.text!=='string'))fail();
     return result;
    });
   }catch{fail();}
  },
  close(){closed=true;owner.abort();},
 });
}
