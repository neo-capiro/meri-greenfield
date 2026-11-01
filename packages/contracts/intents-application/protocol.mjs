/** Receiving metadata describes isolated source routes and integrity only. It grants no approval or execution authority and is not
 * deployment, membership or runtime-mount evidence. */
import {INTENTS_SCHEMA_ID} from './schema.mjs';
export const intentsVersion='0.1.0';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createIntentsMetadata=({paths,limits,errorStatuses,errorOutcomes,failureCodes,approvableActions,inboxKinds})=>freeze({contractVersion:intentsVersion,schemaId:INTENTS_SCHEMA_ID,
 routes:Object.fromEntries(Object.entries(paths).map(([route,path])=>[route,{method:'POST',path,response:'json'}])),
 authentication:{scheme:'Bearer',authority:'native session admitted by Core membership on every request; tenant, actor and clients come only from that admission, never from a body or a response'},
 limits:{requestBytes:limits.maxRequestBytes,responseBytes:limits.maxResponseBytes,requestMs:limits.maxRequestMs,listLimitDefault:20,listLimitMax:50,jsonDepth:64,jsonNodes:100000},
 errorStatuses,errorOutcomes,failureCodes,approvableActions,inboxKinds,
 semantics:{
  list:'read-only durable history of this conversation\'s prepared intents; next is the last returned deliveryId when more remain, otherwise null',
  inbox:'read-only, newest-first page of the caller\'s prepared proposals across every conversation (inboxKinds only), read with the same visibility as list; rows list and link, the conversation\'s list/decide routes decide; pending.count counts this page\'s awaiting_approval rows and pending.complete says the page reached the journal\'s end',
  decision:'approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves',
  execution:'only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared',
  executed:'status executed returns the actual owner outcome: Core native task.create/task.update execution and result, a historical task.create receipt/result, document.draft ArtifactCreatedResult after publication, or native mail accepted/failed durable attempt (provider acceptance is not delivery); approval alone remains approved or indeterminate',
  correlation:'a list answer is admitted against its captured list request; a decide answer is admitted against the captured decide request and the proposal admitted from an earlier list answer; rejected and indeterminate replies carry no conversation or command of their own, so only that retained proposal binds them to the request\'s conversation and approver',
  uncertainty:'UNKNOWN and RESULT_NOT_RELEASED mean a decision or effect may exist: repeat the identical decide request or read list; never prepare a second proposal',
  withheld:'withheld items carry no content because the caller no longer sees a client scope of the retained command',
  expiry:'the caller compares proposal.expiresAt with a fresh clock before presenting a decision; the server rechecks current authority',
  phase:'phase is a reading of the durable decision and execution owners, never a decision',
  integration:'isolated source contract; route mounting, Core decision-owner wiring and runtime qualification remain handoff work',
 }});
