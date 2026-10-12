import {snapshotOperationData} from '../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
// Explicit general-analysis integration boundary. No code is evaluated here.
// Native admission/current authority belong to the trusted control owner.
export function createSandboxAnalysisBoundary({validatePublicShape,canonicalSha256,port=null,verifyAdmission=null,now=Date.now}){
  return Object.freeze({async execute(value){
    const {signal,...data}=value,request=snapshotOperationData(data);
    if(Object.keys(request).some(k=>!['program','inputs','outputs','binding','deadlineMs','admission'].includes(k)))fail('ANALYSIS_SANDBOX_INPUT');
    const {program,inputs,outputs,binding,deadlineMs,admission}=request;
    validatePublicShape('ObjectReference',program);validatePublicShape('RunBinding',binding);
    if(program.scopes.some(s=>s.tenantId!==binding.tenantId)||!Array.isArray(inputs)||inputs.length>30||!Array.isArray(outputs)||!outputs.length||outputs.length>10||outputs.some(x=>typeof x!=='string'||!/^[-A-Za-z0-9_]{1,60}\.(json|csv|png|xlsx)$/.test(x))||new Set(outputs).size!==outputs.length)fail('ANALYSIS_SANDBOX_INPUT');
    for(const input of inputs){validatePublicShape('ObjectReference',input);if(input.scopes.some(s=>s.tenantId!==binding.tenantId))fail('ANALYSIS_SANDBOX_INPUT');}
    if(!port||!verifyAdmission)fail('ANALYSIS_SANDBOX_UNAVAILABLE');
    if(typeof port.execute!=='function'||typeof verifyAdmission!=='function'||!admission||Object.keys(admission).sort().join()!=='imageDigest,receiptSha256'||!/^[a-f0-9]{64}$/.test(admission.receiptSha256)||!/^sha256:[a-f0-9]{64}$/.test(admission.imageDigest))fail('ANALYSIS_SANDBOX_ADMISSION_REQUIRED');
    const intent={program,inputs,outputs,binding,deadlineMs},intentSha256=canonicalSha256(intent);
    const life=createOperationLifetime({deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code:'ANALYSIS_'+code})});
    try{
      const proof=snapshotOperationData(await life.run(signal=>verifyAdmission({intent:snapshotOperationData(intent),intentSha256,admission:snapshotOperationData(admission),signal})));
      if(!proof||Object.keys(proof).sort().join()!=='allowed,expiresAtMs,imageDigest,intentSha256,receiptSha256'||proof.allowed!==true||proof.intentSha256!==intentSha256||proof.receiptSha256!==admission.receiptSha256||proof.imageDigest!==admission.imageDigest)fail('ANALYSIS_SANDBOX_ADMISSION_REQUIRED');life.limitDeadline(proof.expiresAtMs);
      const result=snapshotOperationData(await life.run(signal=>port.execute({intent:snapshotOperationData(intent),intentSha256,admission:snapshotOperationData(admission),signal})));
      if(Object.keys(result).sort().join()!=='admissionReceiptSha256,imageDigest,intentSha256,outputs'||result.intentSha256!==intentSha256||result.admissionReceiptSha256!==admission.receiptSha256||result.imageDigest!==admission.imageDigest||!Array.isArray(result.outputs)||result.outputs.length!==outputs.length)fail('ANALYSIS_SANDBOX_RECEIPT');
      const seen=new Set();for(const output of result.outputs){if(Object.keys(output).sort().join()!=='name,object'||!outputs.includes(output.name)||seen.has(output.name))fail('ANALYSIS_SANDBOX_RECEIPT');seen.add(output.name);validatePublicShape('ObjectReference',output.object);if(output.object.scopes.some(s=>s.tenantId!==binding.tenantId))fail('ANALYSIS_SANDBOX_RECEIPT');}
      return result;
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }});
}
