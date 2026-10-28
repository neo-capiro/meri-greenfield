import {receiveUsageOverviewRequest,receiveUsageOverviewResponse,receiveUsageOverviewRequestV2,receiveUsageOverviewResponseV2,receiveConversationUsageRequest,receiveConversationUsageResponse,type AdmittedUsageOverviewRequest,type AdmittedUsageOverviewRequest2,type UsageOverviewResponse,type UsageOverviewResponse2,type UsageOverviewErrorResponse2,type UsageOverviewErrorCodeV2} from '@capiro/meri-contracts/conversation-usage';
const bytes=new Uint8Array(),overview=receiveUsageOverviewRequest(bytes),run=receiveConversationUsageRequest(bytes);
const admitted:AdmittedUsageOverviewRequest=overview;
receiveUsageOverviewResponse(200,bytes,admitted);
// @ts-expect-error ordinary run requests do not admit tenant overview responses
receiveUsageOverviewResponse(200,bytes,run);
// @ts-expect-error overview does not brand an exact run request
receiveConversationUsageResponse(200,bytes,overview);
// @ts-expect-error decoded data cannot fabricate an admitted request
const forged:AdmittedUsageOverviewRequest={schemaVersion:'meri.usage-overview/1'};
declare const result:UsageOverviewResponse;
// @ts-expect-error no provider billing observation exists
const billed:number=result.coverage.providerBilledMicroUsd;
// @ts-expect-error durable queue states are not physical capacity
const capacity:number=result.queue.availableCapacity;
void [forged,billed,capacity];
// Successor wire version is a distinct admitted brand on the same public export.
const overview2=receiveUsageOverviewRequestV2(bytes);
const admitted2:AdmittedUsageOverviewRequest2=overview2;
const value2=receiveUsageOverviewResponseV2(200,bytes,admitted2);
if('error' in value2){
 const code:UsageOverviewErrorCodeV2=value2.error.code;
 const unknown:'UNKNOWN'|undefined=value2.error.outcome;
 // @ts-expect-error the successor error code union is closed
 const invented:UsageOverviewErrorResponse2={error:{code:'NOT_A_PUBLIC_CODE'}};
 void [code,unknown,invented];
}else{
 const successor:UsageOverviewResponse2=value2;
 const jobIdentity:'measured'=successor.jobIdentity.status;
 const jobClosure:string=successor.jobIdentity.closure;
 const unavailableCapacity:'unavailable'=successor.occupiedCapacity.status;
 const providerBilled:null=successor.coverage.providerBilledMicroUsd;
 // Whole jobs are the canonical root Work/Delegate objectives, published as counts and an SDK-list estimate.
 const wholeJobs:number=successor.wholeJobs.jobs;
 const successfulJobs:number=successor.wholeJobs.states.successful.jobs;
 // @ts-expect-error a complete-job denominator is not published
 const completeJobs:number=successor.jobIdentity.completeJobs;
 // @ts-expect-error no cross-row correlation identifier is public
 const runId:string=successor.runId;
 void [jobIdentity,jobClosure,unavailableCapacity,providerBilled,wholeJobs,successfulJobs,completeJobs,runId];
}
// @ts-expect-error an ordinary /1 admitted request cannot settle a successor response
receiveUsageOverviewResponseV2(200,bytes,overview);
// @ts-expect-error a successor request does not brand an ordinary /1 request
receiveUsageOverviewResponse(200,bytes,overview2);
void [admitted2,value2];
