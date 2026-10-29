import type {ConversationSubmitRequest,ConversationStoredRequest} from '@capiro/meri-contracts/conversation-application';
import type {ConversationHistoryStoredRequest} from '@capiro/meri-contracts/conversation-history';
const siteWorkflow: NonNullable<ConversationSubmitRequest['siteWorkflow']> = {
  siteId:'synthetic-records',workflowId:'download-filings',version:1,manifestSha256:'a'.repeat(64),
};
const request: ConversationSubmitRequest = {requestId:'00000000-0000-4000-8000-000000000001',prompt:'Read filings',siteWorkflow};
const stored: Pick<ConversationStoredRequest,'siteWorkflow'> = {siteWorkflow};
const history: Pick<ConversationHistoryStoredRequest,'siteWorkflow'> = stored;
const invalid: NonNullable<ConversationSubmitRequest['siteWorkflow']> = {...siteWorkflow,
  // @ts-expect-error Credentials are not selected workflow data.
  cookie:'not allowed',
};
void [request,stored,history,invalid];
