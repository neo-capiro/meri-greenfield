/** Owned artifact accounting over the canonical PostgreSQL budget owner. No startup I/O. */
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {createPostgresBudgetExecution} from '../gateway/index.mjs';
import {createArtifactService} from './service.mjs';
import {documentInvocationVersion} from './recovery.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const own=(value,required,optional=[])=>{if(!value||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))fail('ARTIFACT_BUDGET_CONFIGURATION');return value;};

export function createPostgresArtifactService(options){
  const {pool,allocationJson,producerContext,descriptor,context,validators:v,authority,authorize,versions,objects,executor,now,ids,newReservationId,limits,sourceEnabled=false,namespace='qualification'}=own(options,
    ['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled','namespace']);
  if(![v?.snapshot,v?.request,v?.context,authority?.check,authorize,versions?.commit,versions?.read,objects?.put,objects?.get,executor?.execute,now,ids,newReservationId].every(x=>typeof x==='function')||typeof sourceEnabled!=='boolean'||!['qualification','product'].includes(namespace))fail('ARTIFACT_BUDGET_CONFIGURATION');
  const trusted=v.snapshot({producerContext,descriptor,context,limits});trusted.context=v.context(trusted.context);
  own(trusted.producerContext,['context','producer']);validateShape('RunBinding',trusted.context.binding);
  own(trusted.descriptor,['operation','requiredGrants','sourceRequirements']);
  if(!same(trusted.producerContext.context.binding,trusted.context.binding)||trusted.descriptor.operation?.version!=='0.2.0')fail('ARTIFACT_BUDGET_CONFIGURATION');
  for(const key of ['maxRequestMs','maxResponseBytes'])if(!Number.isSafeInteger(trusted.limits[key])||trusted.limits[key]<1)fail('ARTIFACT_BUDGET_CONFIGURATION');
  if(trusted.limits.maxRequestMs>3600000||trusted.limits.maxResponseBytes>16*1024*1024)fail('ARTIFACT_BUDGET_CONFIGURATION');
  // Canonical owner validates the complete allocation. Only the output ceiling is read here.
  const configuredAllocation=v.snapshot(JSON.parse(allocationJson));
  function input(value){
    const call=v.snapshot(typeof value==='string'?JSON.parse(value):value);own(call,['deliveryId','baseVersionId','request']);
    if(typeof call.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/.test(call.deliveryId)||!(call.baseVersionId===null||typeof call.baseVersionId==='string'&&/^[0-9a-f-]{36}$/i.test(call.baseVersionId)))fail('ARTIFACT_BUDGET_INPUT');
    call.request=v.request(call.request);
    if(call.request.operation!==trusted.descriptor.operation.id)fail('ARTIFACT_BUDGET_OPERATION');
    if(call.request.format==='sandbox')fail('ANALYSIS_SANDBOX_DISPATCH_REQUIRED');
    if(trusted.context.analysisAdmission)fail('IRRELEVANT_ANALYSIS_ADMISSION');
    return call;
  }
  const intent=call=>({request:call.request,context:trusted.context,baseVersionId:call.baseVersionId});
  const requestIdentity=raw=>JSON.stringify({operation:trusted.descriptor.operation,arguments:{intentSha256:v.hash(intent(input(raw)))}});
  const delivery=call=>JSON.stringify({...trusted.producerContext,deliveryId:call.deliveryId});
  const ack=(raw,id,decision)=>{
    if(typeof raw!=='string'||Buffer.byteLength(raw)>trusted.limits.maxResponseBytes)fail('ARTIFACT_BUDGET_RECEIPT');
    const receipt=v.snapshot(JSON.parse(raw));own(receipt,['reservationId','decision']);
    if(receipt.reservationId!==id||receipt.decision!==decision)fail('ARTIFACT_BUDGET_RECEIPT');
  };
  // Each execute gets its own observation closure. The outer canonical lifetime can
  // reject before the inner service catches cancellation; do not lose effect identity.
  const compose=observation=>createPostgresBudgetExecution({pool,allocationJson,authority,limits:trusted.limits,now,requestIdentity,namespace,
    createExecutor:ports=>({async execute(raw,credential,signal){
      const call=input(raw),requestSha256=v.hash(intent(call)),document=['create_word','create_excel'].includes(call.request.operation);
      // Bookkeeping only; all artifact access below still requires current authority.
      const initial=document?await ports.budget.observe({signal}):null;
      const durableVersionId=document?documentInvocationVersion(initial):undefined;
      let current,selection,ticketId,committed,outputBytes=null,replaying=false;
      let deadlineMs=trusted.context.deadlineMs,maxBytes=Math.min(trusted.context.maxBytes,configuredAllocation.budgets.maxOutputBytes);
      const active=()=>{if(signal?.aborted||!Number.isSafeInteger(now())||now()>=deadlineMs)fail('ARTIFACT_DEADLINE');};
      const narrow=value=>{if(!Number.isSafeInteger(value))fail('ARTIFACT_BUDGET_DEADLINE');deadlineMs=Math.min(deadlineMs,value);active();};
      async function authorizeArtifact(resource){
        active();
        if(replaying)narrow((await ports.budget.recheck({signal:resource.signal})).deadlineMs);
        current=v.snapshot(await ports.authority.check({credential,descriptor:v.snapshot(trusted.descriptor),input:v.snapshot(intent(call)),signal:resource.signal,limitDeadline:narrow}));
        validateShape('CapabilityClaims',current.claims);validateShape('AuthorizationDecision',current.decision);
        if(!same(current.binding,trusted.context.binding)||!same(current.claims.binding,trusted.context.binding)||!same(current.decision.scopes,trusted.context.scopes)||current.decision.decision!=='allowed'||current.decision.operation!==`${trusted.descriptor.operation.id}@${trusted.descriptor.operation.version}`||current.policyRevision!==current.claims.policyRevision||current.decision.policyRevision!==current.policyRevision||trusted.context.scopes.some(s=>s.policyRevision!==current.policyRevision||!current.claims.scopes.some(c=>same(c,s))))fail('ARTIFACT_BUDGET_AUTHORITY');
        const subject=v.snapshot(current.subject);delete subject.authorizationDecisionId;
        if(selection&&!same(selection,subject))fail('ARTIFACT_BUDGET_AUTHORITY');selection??=subject;
        narrow(current.deadlineMs);narrow(Date.parse(current.claims.expiresAt));
        maxBytes=Math.min(maxBytes,current.claims.budgets.maxOutputBytes);
        if(outputBytes!==null&&outputBytes>maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
        const receipt=v.snapshot(await authorize({...resource,deadlineMs:Math.min(resource.deadlineMs,deadlineMs)}));
        // Publish even a shorter artifact release authority to the canonical marker owner.
        if(resource.signal?.aborted)fail('ARTIFACT_DEADLINE');narrow(receipt.expiresAtMs);
        // check() supplies the canonical owner a deadline publisher; a zero-effect repeat
        // below is unnecessary: reserve/settle explicitly carry the narrower deadline.
        return {...receipt,expiresAtMs:deadlineMs};
      }
      const budget={
        async reserve(value){
          active();if(!current||!same(value.binding,trusted.context.binding)||value.requestSha256!==requestSha256)fail('ARTIFACT_BUDGET_BINDING');
          ticketId=newReservationId();observation.ticketId=ticketId;observation.reservationStarted=true;
          ack(await ports.budget.reserve({reservationId:ticketId,binding:value.binding,operation:trusted.descriptor.operation,argumentsSha256:requestSha256,budgets:current.claims.budgets,claims:current.claims,deadlineMs:Math.min(value.deadlineMs,deadlineMs),limitDeadline:narrow,signal:value.signal}),ticketId,'reserved');
          observation.reservationAcknowledged=true;active();return {ticketId,binding:value.binding,requestSha256,maxBytes,deadlineMs};
        },
        async settle(value){
          active();if(value.ticketId!==ticketId||value.requestSha256!==requestSha256)fail('ARTIFACT_BUDGET_BINDING');
          // Canonical UNKNOWN is already durable. A failed generator is never refunded
          // or given a fabricated completed/failed-settled accounting receipt.
          if(value.outcome!=='completed'||!committed)fail('ARTIFACT_FAILED_ACCOUNTING_UNKNOWN');
          if(value.bytes!==committed.version.object.bytes||value.bytes>maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
          observation.settlementStarted=true;ack(await ports.budget.settle({reservationId:ticketId,outcome:'completed',outputBytes:value.bytes,resultSha256:v.hash(committed),deadlineMs,signal:value.signal}),ticketId,'settled');observation.settlementAcknowledged=true;
          active();return {ticketId,requestSha256,bytes:value.bytes,outcome:value.outcome,status:'settled'};
        },
      };
      // Completion is the immutable committed storage record, not proof of delivery.
      const versionPort={async read(...args){
        const record=await versions.read(...args);
        if(args[0]?.kind==='artifact-replay'){
          active();committed=v.snapshot({...record,expectedParentVersionId:call.baseVersionId});
          outputBytes=committed.version?.object?.bytes;
        }
        return record;
      },async commit(value,abort){
        active();const record=v.snapshot(value);if(record.requestSha256!==requestSha256||record.version.object.bytes>maxBytes)fail('ARTIFACT_BUDGET_BINDING');
        observation.versionCommitStarted=true;const receipt=v.snapshot(await versions.commit(value,abort));active();committed=record;
        // Observe the accepted service's exact ACK predicate; do not turn a started
        // or malformed acknowledgement into a confirmed immutable version.
        if(Object.keys(receipt).sort().join()==='requestSha256,status,versionId,versionSha256'&&['committed','duplicate'].includes(receipt.status)&&receipt.versionId===record.version.versionId&&receipt.requestSha256===requestSha256&&receipt.versionSha256===v.hash(record.version))observation.versionCommitted=true;
        return receipt;
      }};
      const objectPort={get:(...args)=>objects.get(...args),put(...args){active();observation.writeStarted=true;return objects.put(...args);}};
      const executePort={async execute(value){active();const result=await executor.execute({...value,maxBytes:Math.min(value.maxBytes,maxBytes),deadlineMs:Math.min(value.deadlineMs,deadlineMs)});active();outputBytes=result.bytes?.length;if(!Number.isSafeInteger(outputBytes)||outputBytes>maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');return result;}};
      const service=createArtifactService({validators:v,authorize:authorizeArtifact,budget,versions:versionPort,objects:objectPort,executor:executePort,now,ids:()=>{const allocated=v.snapshot(ids());observation.versionId=durableVersionId??allocated.versionId;return allocated;}});
      async function recover(evidence){
        replaying=true;
        ticketId=evidence.reservationId;observation.ticketId=ticketId;observation.versionId=durableVersionId;
        observation.reservationStarted=true;observation.reservationAcknowledged=true;
        maxBytes=Math.min(maxBytes,evidence.maxOutputBytes);
        return service.recover(call.baseVersionId,call.request,trusted.context,{signal,evidence});
      }
      let result;
      if(initial&&initial.stage!=='PREPARED')result=await recover(initial);
      else try{
        result=await (call.baseVersionId===null?service.create(call.request,trusted.context,{signal,versionId:durableVersionId}):service.revise(call.baseVersionId,call.request,trusted.context,{signal,versionId:durableVersionId}));
      }catch(cause){
        // A concurrent winner may have claimed after our observation. Observe once;
        // never retry reserve/generate or wait for uncertain effects to finish.
        if(!document||!observation.reservationStarted||observation.reservationAcknowledged||observation.writeStarted)throw cause;
        const raced=await ports.budget.observe({signal});
        if(raced.stage==='PREPARED')throw cause;
        result=await recover(raced);
      }
      observation.versionCommitted=true;
      try{active();if(Buffer.byteLength(JSON.stringify(result))>trusted.limits.maxResponseBytes)fail('ARTIFACT_RESPONSE_LIMIT');return result;}
      catch(cause){throw Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:result.version.versionId,versionCommitted:true});}
    }})});
  const durable=compose({});
  function admitted(value){if(!sourceEnabled)fail('UNAVAILABLE');const call=input(value);return {raw:JSON.stringify(call),delivery:delivery(call)};}
  return Object.freeze({sourceEnabled,
    bindTrustedGrant:durable.bindTrustedGrant,
    prepareInvocation(value,signal){const call=admitted(value);return durable.prepareInvocation(call.delivery,call.raw,signal);},
    execute(value,credential,signal){
      const call=admitted(value),observation={},requestSha256=v.hash(intent(input(call.raw)));
      return compose(observation).executeOwned(call.raw,credential,call.delivery,signal).catch(cause=>{
        if(cause.code?.startsWith('ARTIFACT_'))throw cause;
        if(!observation.reservationStarted&&!observation.writeStarted)throw cause;
        const code=observation.writeStarted?'ARTIFACT_EFFECT_UNKNOWN':observation.reservationAcknowledged?'ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN':'ARTIFACT_BUDGET_RESERVATION_UNKNOWN';
        throw Object.assign(new Error(code),{code,cause,versionId:observation.versionId??null,versionCommitted:observation.versionCommitted===true,
          budget:{ticketId:observation.ticketId??null,requestSha256,binding:v.snapshot(trusted.context.binding)},
          budgetReservationUnknown:observation.reservationAcknowledged!==true,budgetSettlementUnknown:observation.reservationStarted===true&&observation.settlementAcknowledged!==true,
          uncertainty:v.snapshot({writeStarted:observation.writeStarted===true,versionCommitStarted:observation.versionCommitStarted===true,reservationAcknowledged:observation.reservationAcknowledged===true,settlementAcknowledged:observation.settlementAcknowledged===true})});
      });
    },
    reconcileInvocation(value){const call=input(value);return durable.reconcileInvocation(delivery(call),JSON.stringify(call));},
  });
}
