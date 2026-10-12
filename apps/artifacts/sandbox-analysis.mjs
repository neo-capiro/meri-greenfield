// Explicit general-analysis boundary. No implementation here evaluates code.
// An independently admitted native sandbox owns execution and physical isolation.
export function createSandboxAnalysisBoundary({validatePublicShape,canonicalSha256,port=null}){
  return Object.freeze({async execute({program,inputs,outputs,binding,deadlineMs,admission,signal}){
    validatePublicShape('ObjectReference',program);validatePublicShape('RunBinding',binding);
    if(!Array.isArray(inputs)||inputs.length>30||!Array.isArray(outputs)||!outputs.length||outputs.length>10||outputs.some(x=>typeof x!=='string'||!/^[-A-Za-z0-9_]{1,60}\.(json|csv|png|xlsx)$/.test(x))||new Set(outputs).size!==outputs.length)throw new Error('ANALYSIS_SANDBOX_INPUT');
    for(const input of inputs)validatePublicShape('ObjectReference',input);
    if(!port)throw new Error('ANALYSIS_SANDBOX_UNAVAILABLE');
    if(typeof port.execute!=='function'||!admission||typeof admission.receiptSha256!=='string'||!/^[a-f0-9]{64}$/.test(admission.receiptSha256)||typeof admission.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(admission.imageDigest))throw new Error('ANALYSIS_SANDBOX_ADMISSION_REQUIRED');
    // The trusted integration owns admission verification; syntax is not approval.
    const intent={program,inputs,outputs,binding,deadlineMs};
    return port.execute({intent,intentSha256:canonicalSha256(intent),admission,signal});
  }});
}
