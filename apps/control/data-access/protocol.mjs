/** Browser-facing transport declarations for the data-access read route, derived from its owners. Declarations only: nothing here
 * mounts a route or grants authority. The contract generator (`packages/contracts/generate-data-access.mjs`) reads these constants. */
import {PRODUCT_ERROR_STATUSES} from '../product-access/http.mjs';
export const DATA_ACCESS_PATH='/api/data-access/read';
/** A read body is `{clientId}`; the answer is bounded by the catalog (a few hundred families and relations at most). */
export const DATA_ACCESS_LIMITS=Object.freeze({maxRequestMs:30000,maxRequestBytes:1024,maxResponseBytes:1048576});
/** Domain refusals; transport/membership codes belong to `product-access/http.mjs`. */
export const DATA_ACCESS_ERRORS=Object.freeze({DATA_ACCESS_REQUEST_INVALID:400,DATA_ACCESS_CLIENT_REFUSED:403,DATA_ACCESS_POLICY_UNAVAILABLE:503});
export const DATA_ACCESS_ERROR_STATUSES=Object.freeze({...PRODUCT_ERROR_STATUSES,...DATA_ACCESS_ERRORS});
/** Why a family is or is not readable for this member and client right now, in the order the reader decides them. */
export const DATA_ACCESS_STATES=Object.freeze(['not_installed','policy_off','client_required','available']);
/** What a family needs beyond policy before a read can answer; the frontend joins it with the member's own connections. */
export const DATA_ACCESS_REQUIREMENTS=Object.freeze(['mailbox']);
