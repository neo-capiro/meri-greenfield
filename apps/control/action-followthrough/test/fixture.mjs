/** Actual control/store/authority/command modules, explicitly inert source/SQL/metadata ports. */
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {fixture as commandFixture,id,NOW} from '../../test/commands-fixture.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore,assertTaskLookupStoredBinding} from '../../task-lookup/index.mjs';
import {createTaskLookupPoolFixture} from '../../task-lookup/postgres-fixture.mjs';
import {envelope} from '../../task-lookup/fixtures.mjs';
import {prepare} from '../../task-lookup/binding.mjs';
import {createLocalActionIdentity} from '../../../gateway/local-action/identity.mjs';
import {createLocalLookupAuthorizer} from '../../../gateway/local-action/control-authorizer.mjs';
import {scoped,id as sourceId} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {createCommandToolInterface} from '../../commands/tool-interface.mjs';
import {createActionFollowthrough} from '../index.mjs';
export {id,NOW};
export async function setup(){
 const f=commandFixture('task.create',{policy:'a'.repeat(64)}),clientId=sourceId(9),clock=()=>f.state.now;
 f.context.clientResolution={reference:clientId,clientId};
 const identity=createLocalActionIdentity({mode:'synthetic-local',binding:f.binding,clientId,policyRevision:'a'.repeat(64),deadlineMs:NOW+50000,budgets:f.claims.budgets,grants:['tool.read'],sourceEnabled:true,now:clock});
 const issued=identity.issueCredential({ttlMs:50000}),scopes=identity.status().scopes;
 const c={lookupId:id(61),resultReference:id(62),requestId:id(63),binding:f.binding,scopes,selectedClientId:clientId,deliveryJson:JSON.stringify({context:{binding:f.binding},producer:{namespace:'fixture',executionId:'lookup'},deliveryId:'lookup'}),slots:{started:{eventId:id(64),sequence:1},terminal:{eventId:id(65),sequence:2}},deadlineMs:NOW+45000};
 const request={limit:20},b=prepare(request,c,NOW),observation=envelope(b);observation.subject.policyRevision='a'.repeat(64);
 const row=scoped().actions[0];Object.assign(observation.result,{total:1,returned:1,actions:[row]});observation.result.coverage.returnedCount=1;observation.result.pageCoverage.absenceSupported=false;
 const pool=createTaskLookupPoolFixture(),store=createPostgresTaskLookupStore({pool:pool.pool}),authorize=createLocalLookupAuthorizer({identity,credential:issued.credential,assertStoredBinding:assertTaskLookupStoredBinding,now:clock});
 const lookup=createTaskLookupDelivery({store,authorize,gateway:{executeOwned:async()=>JSON.stringify(observation)},clock});
 const retained=await lookup.lookup({request,context:c,credential:issued.credential});
 let prepared,metadataCalls=0;const hooks={};
 const metadata={async prepare(call){metadataCalls++;if(hooks.metadata)await hooks.metadata(call);f.command.arguments=call.input.arguments;
  prepared={operation:call.operation,action:call.action,binding:call.binding,request:call.request,inputSha256:call.inputSha256,commandId:f.command.commandId,idempotencyKey:f.command.idempotencyKey,proposalId:f.proposal.proposalId,scopes:f.scopes,createdAt:f.proposal.createdAt,expiresAt:f.proposal.expiresAt,requiredApprover:f.proposal.requiredApprover,checkedAtMs:clock()};return structuredClone(prepared);},
  async read(){return {...structuredClone(prepared),checkedAtMs:clock()};}};
 f.state.fetchHook=async(url,init,native)=>{const args=JSON.parse(init.body);native.task.title=args.title;native.task.clientId=args.clientId;native.task.dueDate=args.dueDate??null;return new Response(JSON.stringify(native),{headers:{'content-type':'application/json'}});};
 const commandOptions={operation:resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor.operation,action:'task.create',outputShape:'TaskCreateToolResult',commandContext:f.context,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner:metadata,executor:f.create(),now:clock,limits:{maxRequestMs:5000,maxFactBytes:65536}};
 const readContext={currentBinding:f.binding,scopes,deadlineMs:NOW+10000};
 const config={lookup,readContext,selectedClientId:clientId,commandOptions,now:clock,limits:{maxRequestMs:1000,maxFactBytes:65536}};
 const wanted={resultReference:retained.resultReference,resultSha256:retained.resultSha256,actionId:row.id};
 const make=changes=>createActionFollowthrough({...config,...changes});
 return {f,identity,issued,scopes,clientId,pool,store,lookup,observation,retained,wanted,readContext,commandOptions,config,clock,hooks,make,metadataCalls:()=>metadataCalls,
  async execute(proposal){f.execution.commandSha256=proposal.commandSha256;f.execution.proposalId=proposal.proposalId;f.execution.idempotencyKey=proposal.command.idempotencyKey;f.decision.proposalId=proposal.proposalId;f.decision.commandSha256=proposal.commandSha256;return createCommandToolInterface(commandOptions).executeApproved(proposal,f.execution,'synthetic');},canonicalSha256};
}
