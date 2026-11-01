/** Browser-facing transport declarations for the conversation intent routes, derived from their real owners. Declarations only:
 * nothing here mounts a route, grants authority or widens what `approval.mjs` admits. The contract generator
 * (`packages/contracts/generate-intents.mjs`) reads these constants, never a copy of them. */
import {PRODUCT_ERROR_STATUSES} from '../product-access/http.mjs';
import {INTENT_PATHS} from './http.mjs';
import {APPROVABLE_ACTIONS,INBOX_KINDS,INTENT_APPROVAL_ERRORS} from './approval.mjs';
import {INTENT_FAILURE_CODES} from './faults.mjs';
export const INTENTS_PATHS=INTENT_PATHS;
/** The request ceiling is the contract's own (list/decide bodies are tiny); the response ceiling and deadline are the product-access
 * maxima (`createProductApplication`). A composition may configure lower response/deadline limits, never higher. */
export const INTENTS_LIMITS=Object.freeze({maxRequestMs:30000,maxRequestBytes:4096,maxResponseBytes:16777216});
/** Every outcome the intent owners attach to a failure (`approval.mjs` fail/ProductError calls; `http.mjs` effect:true adds UNKNOWN and RESULT_NOT_RELEASED). */
export const INTENTS_ERROR_OUTCOMES=Object.freeze(['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED']);
/** Transport/membership statuses plus the intent domain codes, exactly as `createProductApplication` answers them. */
export const INTENTS_ERROR_STATUSES=Object.freeze({...PRODUCT_ERROR_STATUSES,...INTENT_APPROVAL_ERRORS});
/** Actions an approved intent may execute today; every other prepared proposal answers INTENT_NOT_APPROVABLE. */
export const INTENTS_APPROVABLE_ACTIONS=APPROVABLE_ACTIONS;
/** Closed `failed` item codes from the intent journal. */
export const INTENTS_FAILURE_CODES=INTENT_FAILURE_CODES;
/** The item kinds the actor-wide inbox lists: what a person decides inline in a conversation. */
export const INTENTS_INBOX_KINDS=INBOX_KINDS;
