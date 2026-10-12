/** General immutable-program analysis with the one canonical durable budget owner. */
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {createPostgresBudgetExecution} from '../gateway/index.mjs';
import {createSandboxAnalysisBoundary} from './sandbox-analysis.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const own=(value,required,optional=[])=>{if(!value||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))fail('ANALYSIS_BUDGET_CONFIGURATION');return value;};

export function createPostgresAnalysisExecutor(options){
  const {pool,allocationJson,producerContext,descriptor,context,validators:v,authority,port,verifyAdmission,now,newReservationId,limits,sourceEnabled=false}=own(options,
    ['pool','allocationJson','producerContext','descriptor','context','validators','authority','port','verifyAdmission','now','newReservationId','limits'],['sourceEnabled']);
  if(![v?.snapshot,v?.context,v?.normalizeArtifactInput,v?.assertArtifactOutput,authority?.check,port?.execute,verifyAdmission,now,newReservationId].every(x=>typeof x==='function')||typeof sourceEnabled!=='boolean')fail('ANALYSIS_BUDGET_CONFIGURATION');
  const trusted=v.snapshot({producerContext,descriptor,context,limits});trusted.context=v.context(trusted.context);
  own(trusted.producerContext,['context','producer']);own(trusted.descriptor,['operation','requiredGrants','sourceRequirements']);
  if(!same(trusted.producerContext.context.binding,trusted.context.binding)||!same(trusted.descriptor.operation,{id:'run_analysis',version:'0.2.0'}))fail('ANALYSIS_BUDGET_CONFIGURATION');
  for(const key of ['maxRequestMs','maxResponseBytes'])if(!Number.isSafeInteger(trusted.limits[key])||trusted.limits[key]<1)fail('ANALYSIS_BUDGET_CONFIGURATION');
  if(trusted.limits.maxRequestMs>3600000||trusted.limits.maxResponseBytes>16*1024*1024)fail('ANALYSIS_BUDGET_CONFIGURATION');
  const allocation=v.snapshot(JSON.parse(allocationJson));
  function input(value){
    const call=v.snapshot(typeof value==='string'?JSON.parse(value):value);own(call,['deliveryId','request']);
    if(typeof call.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/.test(call.deliveryId))fail('ANALYSIS_BUDGET_INPUT');
    call.request=v.normalizeArtifactInput('run_analysis',call.request,trusted.context).input;
    if(call.request.format!=='sandbox')fail('ANALYSIS_SANDBOX_REQUEST_REQUIRED');return call;
  }
  const requestHash=call=>canonicalSha256({request:call.request,context:trusted.context});
  const identity=raw=>JSON.stringify({operation:trusted.descriptor.operation,arguments:{intentSha256:requestHash(input(raw))}});
  const delivery=call=>JSON.stringify({...trusted.producerContext,deliveryId:call.deliveryId});
  const ack=(raw,id,decision)=>{if(typeof raw!=='string'||Buffer.byteLength(raw)>trusted.limits.maxResponseBytes)fail('ANALYSIS_BUDGET_RECEIPT');const receipt=v.snapshot(JSON.parse(raw));own(receipt,['reservationId','decision']);if(receipt.reservationId!==id||receipt.decision!==decision)fail('ANALYSIS_BUDGET_RECEIPT');};
  const durable=createPostgresBudgetExecution({pool,allocationJson,authority,limits:trusted.limits,now,requestIdentity:identity,
    createExecutor:ports=>({async execute(raw,credential,signal){
      const call=input(raw),requestSha256=requestHash(call),ctx=trusted.context;
      let deadlineMs=ctx.deadlineMs,current,selection,reservationId,reservationStarted=false,reserved=false,dispatchStarted=false,settlementAcknowledged=false,outputReceiptSha256=null,result=null;
      const active=abort=>{if(signal?.aborted||abort?.aborted||!Number.isSafeInteger(now())||now()>=deadlineMs)fail('ANALYSIS_DEADLINE');};
      const narrow=value=>{if(!Number.isSafeInteger(value))fail('ANALYSIS_BUDGET_DEADLINE');deadlineMs=Math.min(deadlineMs,value);active();};
      async function authorize(){
        active();current=v.snapshot(await ports.authority.check({credential,descriptor:v.snapshot(trusted.descriptor),input:{request:v.snapshot(call.request),context:v.snapshot(ctx)},signal,limitDeadline:narrow}));
        validateShape('CapabilityClaims',current.claims);validateShape('AuthorizationDecision',current.decision);
        if(!same(current.binding,ctx.binding)||!same(current.claims.binding,ctx.binding)||current.policyRevision!==current.claims.policyRevision||current.decision.policyRevision!==current.policyRevision||current.decision.decision!=='allowed'||current.decision.operation!=='run_analysis@0.2.0'||!same(current.decision.scopes,ctx.scopes)||ctx.scopes.some(s=>s.policyRevision!==current.policyRevision||!current.claims.scopes.some(c=>same(c,s))))fail('ANALYSIS_BUDGET_AUTHORITY');
        const subject=v.snapshot(current.subject);delete subject.authorizationDecisionId;if(selection&&!same(selection,subject))fail('ANALYSIS_BUDGET_AUTHORITY');selection??=subject;
        narrow(current.deadlineMs);narrow(Date.parse(current.claims.expiresAt));
        if(ctx.maxBytes>Math.min(allocation.budgets.maxOutputBytes,current.claims.budgets.maxOutputBytes))fail('ANALYSIS_BUDGET_CEILING');
        active();return current;
      }
      const boundary=createSandboxAnalysisBoundary({validatePublicShape:validateShape,canonicalSha256,now,
        verifyAdmission:async value=>{active(value.signal);const proof=v.snapshot(await verifyAdmission(value));active(value.signal);narrow(proof.expiresAtMs);return proof;},
        port:{async execute(value){active(value.signal);dispatchStarted=true;const receipt=v.snapshot(await port.execute(value));active(value.signal);outputReceiptSha256=canonicalSha256(receipt);return receipt;}}});
      try{
        await authorize();if(ctx.deadlineMs>deadlineMs)fail('ANALYSIS_IMMUTABLE_DEADLINE_EXCEEDS_AUTHORITY');
        reservationId=newReservationId();reservationStarted=true;
        ack(await ports.budget.reserve({reservationId,binding:ctx.binding,operation:trusted.descriptor.operation,argumentsSha256:requestSha256,budgets:current.claims.budgets,claims:current.claims,deadlineMs,limitDeadline:narrow,signal}),reservationId,'reserved');reserved=true;active();
        // The native intent is immutable. Never rewrite a prior admission hash to fit
        // a shorter persisted run window discovered while reserving.
        if(ctx.deadlineMs>deadlineMs)fail('ANALYSIS_IMMUTABLE_DEADLINE_EXCEEDS_AUTHORITY');
        const observed=await boundary.execute({...call.request.content,binding:ctx.binding,scopes:ctx.scopes,deadlineMs:ctx.deadlineMs,maxBytes:ctx.maxBytes,admission:ctx.analysisAdmission},{signal});
        // Detach verified output tuples before any later authority/accounting await.
        result=v.assertArtifactOutput('run_analysis',observed,call.request,ctx);active();
        await authorize();
        if(Buffer.byteLength(JSON.stringify(result))>trusted.limits.maxResponseBytes)fail('ANALYSIS_RESPONSE_LIMIT');
        const outputBytes=result.outputs.reduce((sum,x)=>sum+x.object.bytes,0);
        ack(await ports.budget.settle({reservationId,outcome:'completed',outputBytes,resultSha256:canonicalSha256(result),deadlineMs,signal}),reservationId,'settled');settlementAcknowledged=true;active();
        await authorize();return v.snapshot(result);
      }catch(cause){
        if(!reservationStarted)throw cause;
        const code=dispatchStarted?'ANALYSIS_EFFECT_UNKNOWN':reserved?'ANALYSIS_BUDGET_SETTLEMENT_UNKNOWN':'ANALYSIS_BUDGET_RESERVATION_UNKNOWN';
        throw Object.assign(new Error(code),{code,cause,uncertainty:{requestSha256,reservationId:reservationId??null,binding:v.snapshot(ctx.binding),reservationAcknowledged:reserved,dispatchStarted,settlementAcknowledged,outputReceiptSha256,resultSha256:result?canonicalSha256(result):null,outputs:result?v.snapshot(result.outputs):null,inspectionStatus:'pending',publicationStatus:'pending'}});
      }
    }})});
  function admitted(value){if(!sourceEnabled)fail('UNAVAILABLE');const call=input(value);return {raw:JSON.stringify(call),delivery:delivery(call)};}
  return Object.freeze({sourceEnabled,bindTrustedGrant:durable.bindTrustedGrant,
    prepareInvocation(value,signal){const call=admitted(value);return durable.prepareInvocation(call.delivery,call.raw,signal);},
    execute(value,credential,signal){const call=admitted(value);return durable.executeOwned(call.raw,credential,call.delivery,signal);},
    reconcileInvocation(value){const call=input(value);return durable.reconcileInvocation(delivery(call),JSON.stringify(call));},
  });
}
