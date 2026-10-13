import {receiveActionResponse,ActionResponseError} from '@capiro/meri-contracts/action-application';
import type {ActionRoute,ActionQueryResponse,ActionDraftResponse,ActionPrepareResponse,ActionExecuteResponse,ActionErrorResponse,ActionResponse} from '@capiro/meri-contracts/action-application';
const body: unknown = '{"untrusted":true}';
const q: ActionResponse<'query'> = await receiveActionResponse('query',200,body);
if ('error' in q) { const message: string = q.error.code; void message; }
else { const accepted: false = q.acceptedTasks; const items = q.observation.result.actions; void accepted; void items; }
const d: ActionResponse<'draft'> = await receiveActionResponse('draft',200,body);
if (!('error' in d)) { const kind: 'draft' = d.status; const title: string = d.task.title; void kind; void title; }
const p = await receiveActionResponse('prepare',200,body);
if (!('error' in p)) { const state: 'approval_required' = p.status; const digest: string = p.proposal.commandSha256; void state; void digest; }
const e = await receiveActionResponse('execute',200,body);
if (!('error' in e) && e.status === 'observed') { const digest: string = e.outcome.receipt.commandSha256; const title: string = e.outcome.result.title; void digest; void title; }
const r: ActionRoute = 'prepare'; void r;
const types: [ActionQueryResponse?,ActionDraftResponse?,ActionPrepareResponse?,ActionExecuteResponse?,ActionErrorResponse?] = []; void types;
declare const failure: ActionResponseError;
const code: string = failure.code; void code;
// @ts-expect-error Unknown must be received before property access.
body.status;
// @ts-expect-error No arbitrary routes or callable operations.
receiveActionResponse('approve',200,body);
// @ts-expect-error Receiving is asynchronous.
const sync: ActionQueryResponse = receiveActionResponse('query',200,body);
// @ts-expect-error A successful query is not a pending task proposal.
const wrong: ActionPrepareResponse = q;
