/** Receiving metadata describes isolated source routes and integrity only. It grants no approval or execution authority and is not
 * deployment, membership or runtime-mount evidence. */
import {INTENTS_SCHEMA_ID} from './schema.mjs';
export const intentsVersion='0.1.0';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createIntentsMetadata=({paths,limits,errorStatuses,errorOutcomes,failureCodes,approvableActions})=>freeze({contractVersion:intentsVersion,schemaId:INTENTS_SCHEMA_ID,
 routes:Object.fromEntries(Object.entries(paths).map(([route,path])=>[route,{method:'POST',path,response:'json'}])),
 authentication:{scheme:'Bearer',authority:'native session admitted by Core membership on every request; tenant, actor and clients come only from that admission, never from a body or a response'},
 limits:{requestBytes:limits.maxRequestBytes,responseBytes:limits.maxResponseBytes,requestMs:limits.maxRequestMs,listLimitDefault:20,listLimitMax:50,jsonDepth:64,jsonNodes:100000},
 errorStatuses,errorOutcomes,failureCodes,approvableActions,
 semantics:{
  list:'read-only durable history of this conversation\'s prepared intents; next is the last returned deliveryId when more remain, otherwise null',
  decision:'approved or rejected is recorded by the canonical decision owner for exactly the named proposal, command hash and approver; display, stream or model text never approves',
  execution:'only actions in approvableActions execute; any other prepared proposal answers INTENT_NOT_APPROVABLE and stays prepared',
  executed:'status executed returns the observed receipt and task result; the caller reads receipt.outcome, status alone does not assert success',
  uncertainty:'UNKNOWN and RESULT_NOT_RELEASED mean a decision or effect may exist: repeat the identical decide request or read list; never prepare a second proposal',
  withheld:'withheld items carry no content because the caller no longer sees a client scope of the retained command',
  expiry:'the caller compares proposal.expiresAt with a fresh clock before presenting a decision; the server rechecks current authority',
  phase:'phase is a reading of the durable decision and execution owners, never a decision',
  integration:'isolated source contract; route mounting, Core decision-owner wiring and runtime qualification remain handoff work',
 }});
