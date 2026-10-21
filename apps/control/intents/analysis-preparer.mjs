/** Typed ZIP drafts and admitted immutable-program analysis use their existing
 * artifact and sandbox budget owners. This boundary grants no execution authority. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {intentFault} from './faults.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertIntentArtifactDraft} from './artifact-draft-result.mjs';

export const ANALYSIS_INTENT_OPERATIONS=Object.freeze(['run_analysis']);
const operation=Object.freeze({id:'run_analysis',version:'0.2.0'});
const canonical=resolveOperationContract(operation).descriptor;
const descriptor=data({operation,requiredGrants:canonical.requiredGrants,sourceRequirements:canonical.sourceRequirements});
const same=(a,b)=>v.hash(a)===v.hash(b);

/** Execute ports are prebound by trusted composition to the SAME context,
 * allocation, capability, current authority and canonical durable owner. A
 * sandbox port additionally owns current native admission verification. */
export function createAnalysisIntentPreparer(configuration){
 let c,binding,artifact,sandbox;
 try{
  c=own(configuration,['binding','descriptor'],['artifact','sandbox']);binding=data(c.binding);validateShape('RunBinding',binding);
  if(!same(data(c.descriptor),descriptor))throw 0;
  function backend(raw,key,admitted){
   const value=own(raw,admitted?['context',key]:[key],admitted?[]:['context']),context=value.context===undefined?null:v.context(value.context);
   if(admitted&&context===null||context!==null&&(!same(context.binding,binding)||Boolean(context.analysisAdmission)!==admitted))throw 0;
   return Object.freeze({context,execute:storageMethod(value[key],'execute')});
  }
  artifact=c.artifact===undefined?null:backend(c.artifact,'writes',false);
  sandbox=c.sandbox===undefined?null:backend(c.sandbox,'executor',true);
  if(!artifact&&!sandbox)throw 0;
 }catch{throw intentFault('INTENT_CONFIGURATION');}
 return Object.freeze({operation,owner:'artifact',binding,
  formats:Object.freeze([...(artifact?['zip']:[]),...(sandbox?['sandbox']:[])]),
  async prepare(value){
   let call,request,selected;
   try{
    call=own(value,['arguments','deliveryId'],['signal']);nativeSignal(call.signal);
    if(typeof call.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(call.deliveryId))throw 0;
    request=v.request(call.arguments);
    if(request.operation!==operation.id)throw 0;
   }catch{throw intentFault('INVALID_ARGUMENTS','none');}
   if(call.signal?.aborted)throw intentFault('CANCELLED','none');
   selected=request.format==='zip'?artifact:sandbox;
   if(!selected)throw intentFault('UNAVAILABLE','none');
   try{if(selected.context!==null)v.normalizeArtifactInput(operation.id,request,selected.context);}
   catch{throw intentFault('INVALID_ARGUMENTS','none');}
   let result;
   try{
    result=data(await selected.execute({deliveryId:call.deliveryId,request,
     ...(request.format==='zip'?{baseVersionId:null}:{})},call.signal));
   }catch{throw intentFault('UNKNOWN','unknown');}
   try{
    if(call.signal?.aborted)throw 0;
    if(request.format==='zip')result=assertIntentArtifactDraft(result,{binding,request,context:selected.context});
    else v.assertArtifactOutput(operation.id,result,request,selected.context);
   }catch{throw intentFault('INVALID_RESULT','unknown');}
   return request.format==='zip'?{status:'draft',version:result.version}:
    {status:'analysis_pending',binding,scopes:selected.context.scopes,result};
  }});
}
