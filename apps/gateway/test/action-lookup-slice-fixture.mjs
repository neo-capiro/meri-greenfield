/** Local composition of actual owners over separately labelled inert HTTP/SQL ports. */
import {randomUUID} from 'node:crypto';
import {harness,canonicalSha256,NOW} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createActionItemsHttpAdapter} from '../sources/action-items/http-adapter.mjs';
import {createActionItemsReadHandler} from '../sources/action-items/handler.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore} from '../../control/task-lookup/index.mjs';
import {createTaskLookupPoolFixture} from '../../control/task-lookup/postgres-fixture.mjs';
import {fixture as controlFixture} from '../../control/task-lookup/fixtures.mjs';
import {nativeScopedPage,id} from '../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';

export async function actionLookupSlice(){
  const h=harness(),c=controlFixture(),sql=createTaskLookupPoolFixture(),trace=[],http=[];
  const operation={id:'actions.query',version:'0.2.0'},contract=resolveOperationContract(operation),descriptor=contract.descriptor;
  const scope={tenantId:h.f.binding.tenantId,kind:'client',resourceId:id(9),policyRevision:h.f.claims.policyRevision};
  const subject={...h.f.subject,kind:'client',entityType:'client',entityIds:[id(9)],scopes:[scope]};
  h.f.claims.scopes=[scope];h.f.state.grants=[...descriptor.requiredGrants];
  h.allocation.manifest.allowedOperations=[operation];h.allocation.manifest.requiredSources=descriptor.sourceRequirements;
  h.allocation.manifest.subjectKinds=['client'];h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);
  h.allocation.schedule.operations=[{operation,chargeMicrousd:10}];h.invocation.allocationSha256=canonicalSha256(h.allocation);
  h.f.ports.authorizeBusiness=async call=>{
    h.f.calls.push('policy');
    if(call.input.mode!=='client_scoped'||call.input.selection.clientId!==id(9))throw Error('Inert policy denies another client');
    return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:h.f.binding.tenantId,actorId:h.f.binding.actorId},
      operation:'actions.query@0.2.0',scopes:[scope],policyRevision:h.f.claims.policyRevision,evaluatedAt:new Date(h.f.state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},subject,grants:h.f.state.grants});
  };
  h.f.ports.authorizeSources=async()=>JSON.stringify({sourceIds:descriptor.sourceRequirements.map(s=>s.sourceId),enabled:h.f.state.sourceEnabled,policyRevision:h.f.claims.policyRevision,checkedAtMs:h.f.state.now});
  const adapter=createActionItemsHttpAdapter({origin:'https://synthetic.invalid',now:()=>h.f.state.now,
    getCredentials:async pins=>{const {input,deadlineMs,signal,...echo}=pins;return {...structuredClone(echo),
      authorizationScheme:'CapiroMeriRead',bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+10000};},
    fetchImpl:async(url,options)=>{http.push({url:String(url),method:options.method});
      const {input}=JSON.parse(options.body),selection=input.selection;
      const native=nativeScopedPage({clientId:selection.clientId,sort:selection.sort,limit:selection.limit,
        ...(selection.status===null?{}:{status:selection.status}),
        ...(selection.actionItemId===null?{}:{actionItemId:selection.actionItemId}),
        ...(input.cursor===null?{}:{cursor:input.cursor})});h.afterHttp?.();
      return new Response(JSON.stringify(native),{status:200,headers:{'content-type':'application/json'}});
    }});
  h.f.entry.contract=contract;h.f.entry.descriptor=descriptor;
  h.f.entry.execute=createActionItemsReadHandler({adapter,now:()=>h.f.state.now,newId:randomUUID});
  c.context={...c.context,binding:h.f.binding,scopes:[scope],selectedClientId:id(9),deliveryJson:h.delivery('action-lookup-slice'),deadlineMs:NOW+2000};
  c.readContext={currentBinding:{...h.f.binding,attemptId:id(51),workerId:id(52),writerFence:2},scopes:[scope],deadlineMs:NOW+2000};
  const authorize=async call=>{
    const receipt={authorized:!h.f.state.revoked,bindingSha256:call.binding.bindingSha256,expiresAtMs:NOW+2000};
    trace.push({phase:call.phase,binding:structuredClone(call.binding),receipt,observedAtMs:h.f.state.now});
    return receipt;
  };
  const create=()=>createTaskLookupDelivery({gateway:h.enabledGateway(),store:createPostgresTaskLookupStore({pool:sql.pool}),authorize,clock:()=>h.f.state.now});
  await h.bind();
  return {h,c,sql,http,trace,create,lookup:signal=>create().lookup({request:c.request,context:c.context,credential:h.credential,signal}),
    read:()=>create().read({resultReference:c.context.resultReference,context:c.readContext})};
}
