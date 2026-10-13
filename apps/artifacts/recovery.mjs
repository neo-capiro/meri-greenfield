/** Exact immutable document recovery; receives only producer-owned journal evidence. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function documentInvocationVersion(evidence){
  if(typeof evidence?.invocationId!=='string'||!evidence.invocationId.startsWith('owned_')||!uuid.test(evidence.invocationId.slice(6)))fail('ARTIFACT_REPLAY_EVIDENCE');
  return evidence.invocationId.slice(6);
}
export async function recoverArtifact(owner,baseVersionId,requestValue,contextValue,{signal,evidence}={}){
  const {v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,budget}=owner;
  const request=v.request(requestValue),context=v.context(contextValue),requestSha256=v.hash({request,context,baseVersionId});
  const stableVersionId=documentInvocationVersion(evidence),life=operation(context,signal);
  let versionId=stableVersionId,verified=false;
  try{
    if(!['create_word','create_excel'].includes(request.operation)||request.format==='sandbox'||context.analysisAdmission||
      !['UNKNOWN','SETTLED'].includes(evidence.stage)||typeof evidence.reservationId!=='string'||!evidence.reservationId||
      evidence.argumentsSha256!==requestSha256||!Number.isSafeInteger(evidence.maxOutputBytes)||evidence.maxOutputBytes<1)fail('ARTIFACT_REPLAY_EVIDENCE');
    const action=baseVersionId===null?'artifact.generate':'artifact.revise';
    const resource={versionId:baseVersionId,object:null,assetObjects:context.assets.map(a=>a.object)};
    await authority(life,action,resource,requestSha256,context);
    const candidate=await life.run(signal=>versions.read({kind:'artifact-replay',versionId:stableVersionId,
      requestSha256,resultSha256:evidence.completion?.resultSha256??null},signal));
    versionId=candidate?.version?.versionId??stableVersionId;
    const record=scopeVersion(candidate,versionId,context),commit={...record,expectedParentVersionId:baseVersionId};
    if(record.requestSha256!==requestSha256||record.specSha256!==v.hash(request)||
      record.version.parentVersionId!==baseVersionId||v.hash(record.version.binding)!==v.hash(context.binding)||
      v.hash(record.version.evidence)!==v.hash(context.evidence)||
      (evidence.completion?evidence.completion.resultSha256!==v.hash(commit)||evidence.completion.outputBytes!==record.version.object.bytes:
        record.version.versionId!==stableVersionId))fail('ARTIFACT_REPLAY_EVIDENCE');
    await authority(life,action,{...resource,object:record.version.object},requestSha256,context);
    const bytes=await bytesFor(life,record.version.object,Math.min(context.maxBytes,evidence.maxOutputBytes));
    const inspection=inspectBytes(record.inspection,bytes,request.format);verified=true;
    // Only verified, published bytes may complete the original conservative charge.
    const settled=v.snapshot(await life.run(signal=>budget.settle({ticketId:evidence.reservationId,requestSha256,
      bytes:bytes.length,outcome:'completed',signal})));
    if(Object.keys(settled).sort().join()!=='bytes,outcome,requestSha256,status,ticketId'||settled.ticketId!==evidence.reservationId||
      settled.requestSha256!==requestSha256||settled.bytes!==bytes.length||settled.outcome!=='completed'||settled.status!=='settled')fail('ARTIFACT_BUDGET_RECEIPT');
    const receipt=await authority(life,action,{...resource,object:record.version.object},requestSha256,context);
    return {version:record.version,inspection,execution:{requestSha256,authorizationReceiptId:receipt.receiptId,
      budgetTicketId:evidence.reservationId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
  }catch(cause){
    throw Object.assign(new Error('ARTIFACT_REPLAY_UNRESOLVED'),{code:'ARTIFACT_REPLAY_UNRESOLVED',cause,versionId,
      versionCommitted:verified,budget:{ticketId:evidence.reservationId??null,requestSha256,binding:v.snapshot(context.binding)},
      budgetSettlementUnknown:evidence.stage!=='SETTLED',budgetReservationUnknown:false,lifetime:life.close()});
  }finally{life.close();}
}
