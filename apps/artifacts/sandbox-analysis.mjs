import {snapshotOperationData} from '../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
// Explicit general-analysis integration boundary. No code is evaluated here.
// Native admission/current authority belong to the trusted control owner.
export function createSandboxAnalysisBoundary({validatePublicShape,canonicalSha256,port=null,verifyAdmission=null,now=Date.now}){
  return Object.freeze({async execute(value,{signal}={}){
    const request=snapshotOperationData(value);
    if(Object.keys(request).some(k=>!['program','inputs','outputs','binding','scopes','deadlineMs','maxBytes','admission'].includes(k)))fail('ANALYSIS_SANDBOX_INPUT');
    const {program,inputs,outputs,binding,scopes,deadlineMs,maxBytes,admission}=request;
    validatePublicShape('ObjectReference',program);validatePublicShape('RunBinding',binding);
    if(!Array.isArray(scopes)||!scopes.length||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8388608)fail('ANALYSIS_SANDBOX_INPUT');
    for(const scope of scopes){validatePublicShape('Scope',scope);if(scope.tenantId!==binding.tenantId)fail('ANALYSIS_SANDBOX_INPUT');}
    const scopeHashes=new Set(scopes.map(canonicalSha256));if(scopeHashes.size!==scopes.length)fail('ANALYSIS_SANDBOX_INPUT');
    if(program.scopes.some(s=>!scopeHashes.has(canonicalSha256(s)))||!Array.isArray(inputs)||inputs.length>30||!Array.isArray(outputs)||!outputs.length||outputs.length>10||outputs.some(x=>typeof x!=='string'||!/^[-A-Za-z0-9_]{1,60}\.(json|csv|png|xlsx)$/.test(x))||new Set(outputs).size!==outputs.length)fail('ANALYSIS_SANDBOX_INPUT');
    for(const input of inputs){validatePublicShape('ObjectReference',input);if(input.scopes.some(s=>!scopeHashes.has(canonicalSha256(s))))fail('ANALYSIS_SANDBOX_INPUT');}
    if(!port||!verifyAdmission)fail('ANALYSIS_SANDBOX_UNAVAILABLE');
    if(typeof port.execute!=='function'||typeof verifyAdmission!=='function'||!admission||Object.keys(admission).sort().join()!=='imageDigest,manifestSha256,receiptSha256'||!/^[a-f0-9]{64}$/.test(admission.receiptSha256)||!/^[a-f0-9]{64}$/.test(admission.manifestSha256)||!/^sha256:[a-f0-9]{64}$/.test(admission.imageDigest))fail('ANALYSIS_SANDBOX_ADMISSION_REQUIRED');
    const intent={program,inputs,outputs,binding,scopes,deadlineMs,maxBytes},intentSha256=canonicalSha256(intent);
    const life=createOperationLifetime({deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code:'ANALYSIS_'+code})});
    try{
      const proof=snapshotOperationData(await life.run(signal=>verifyAdmission({intent:snapshotOperationData(intent),intentSha256,admission:snapshotOperationData(admission),signal})));
      if(!proof||Object.keys(proof).sort().join()!=='allowed,expiresAtMs,imageDigest,intentSha256,manifestSha256,receiptSha256'||proof.allowed!==true||proof.intentSha256!==intentSha256||proof.receiptSha256!==admission.receiptSha256||proof.manifestSha256!==admission.manifestSha256||proof.imageDigest!==admission.imageDigest)fail('ANALYSIS_SANDBOX_ADMISSION_REQUIRED');life.limitDeadline(proof.expiresAtMs);
      const result=snapshotOperationData(await life.run(signal=>port.execute({intent:snapshotOperationData(intent),intentSha256,admission:snapshotOperationData(admission),signal})));
      if(Object.keys(result).sort().join()!=='admissionReceiptSha256,imageDigest,intentSha256,manifestSha256,outputs'||result.intentSha256!==intentSha256||result.admissionReceiptSha256!==admission.receiptSha256||result.manifestSha256!==admission.manifestSha256||result.imageDigest!==admission.imageDigest||!Array.isArray(result.outputs)||result.outputs.length!==outputs.length)fail('ANALYSIS_SANDBOX_RECEIPT');
      const seen=new Set();let bytes=0;for(const output of result.outputs){if(Object.keys(output).sort().join()!=='name,object'||!outputs.includes(output.name)||seen.has(output.name))fail('ANALYSIS_SANDBOX_RECEIPT');seen.add(output.name);validatePublicShape('ObjectReference',output.object);if(canonicalSha256(output.object.scopes)!==canonicalSha256(scopes))fail('ANALYSIS_SANDBOX_RECEIPT');bytes+=output.object.bytes;}if(bytes>maxBytes)fail('ANALYSIS_SANDBOX_RECEIPT');
      return {...result,inspectionStatus:'pending',publicationStatus:'pending'};
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }});
}
