/** Trusted durable control delivery to a single SDK Query; the owner keeps the journal. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertWorkerControl} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fail=code=>{throw new Error(code);};
export function createSdkCommandAdapter(options) {
  const {binding:rawBinding,contextSha256,input,query,lifetime}=own(options,['binding','contextSha256','input','query','lifetime']);
  const binding=data(rawBinding);validateShape('RunBinding',binding);
  if(typeof contextSha256!=='string'||!/^[a-f0-9]{64}$/.test(contextSha256)||
      ['enqueue','close'].some(k=>typeof input?.[k]!=='function')||['interrupt','close'].some(k=>typeof query?.[k]!=='function')||
      ['run','check'].some(k=>typeof lifetime?.[k]!=='function'))fail('SDK_CONTROL_CONFIGURATION');
  const submitted=new Map();let stopped=false,queryClosed=false;
  const interrupt=query.interrupt,closeQuery=query.close;
  const close=()=>{stopped=true;let failed=false;try{input.close();}catch{failed=true;}
    if(!queryClosed){queryClosed=true;try{closeQuery.call(query);}catch{failed=true;}}
    if(failed)fail('SDK_CLEANUP_UNKNOWN');return {physicalStopProven:false};};
  async function apply(value) {
    const command=assertWorkerControl(value);
    if(!same(command.binding,binding)||command.contextSha256!==contextSha256)fail('SDK_CONTROL_REFUSED');
    const digest=canonicalSha256(command),previous=submitted.get(command.controlId);
    if(previous){if(previous.digest!==digest)fail('SDK_CONTROL_REPLAY_REFUSED');return {controlId:command.controlId,outcome:'UNKNOWN',dispatched:false,physicalStopProven:false};}
    lifetime.check();if(stopped)fail('SDK_CONTROL_STOPPED');
    // Mark attempted before invoking SDK/input effects. Local retries are never
    // durable success, and a later activity must consult the owner's journal.
    submitted.set(command.controlId,{digest});
    if(command.action==='steer') {
      const receipt=input.enqueue({controlId:command.controlId,prompt:command.prompt});lifetime.check();
      return {controlId:command.controlId,inputId:receipt.inputId,outcome:'UNKNOWN',dispatched:true,physicalStopProven:false};
    }
    stopped=true;
    try {
      const raw=await lifetime.run(()=>interrupt.call(query));lifetime.check();
      let receipt=null;
      if(raw!==undefined){receipt=data(raw);own(receipt,['still_queued'],['cancelled']);
        if(!Array.isArray(receipt.still_queued)||receipt.still_queued.some(uuid=>typeof uuid!=='string')||
            receipt.cancelled!==undefined&&(!Array.isArray(receipt.cancelled)||receipt.cancelled.some(uuid=>typeof uuid!=='string')))fail('SDK_INTERRUPT_REFUSED');}
      return {controlId:command.controlId,outcome:'UNKNOWN',dispatched:true,interruptReceipt:receipt,physicalStopProven:false};
    }catch {lifetime.check();fail('SDK_CONTROL_UNKNOWN');}
    finally {close();}
  }
  return Object.freeze({apply,close});
}
