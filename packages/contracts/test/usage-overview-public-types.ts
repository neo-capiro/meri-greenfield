import {receiveUsageOverviewRequest,receiveUsageOverviewResponse,receiveConversationUsageRequest,receiveConversationUsageResponse,type AdmittedUsageOverviewRequest,type UsageOverviewResponse} from '@capiro/meri-contracts/conversation-usage';
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
