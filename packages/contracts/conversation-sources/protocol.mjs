/** Saved read provenance is not a capability or an answer-to-citation claim. */
import {historyErrorStatuses} from '../conversation-history/protocol.mjs';
export const BILL_TEXT_SOURCE_SCHEMA='meri.native-bill-text-source/1';
export const BILL_TEXT_SOURCE_READ_SCHEMA='meri.bill-text-source-read/1';
export {BILL_TEXT_SOURCE_EVENT} from './semantics.mjs';
export const BILL_TEXT_SOURCE_PATH='/api/conversations/source-read';
export const billTextSourceErrors=Object.freeze({...historyErrorStatuses,SOURCE_REFERENCE_NOT_FOUND:Object.freeze([404]),SOURCE_REFERENCE_STALE:Object.freeze([409]),SOURCE_REFERENCE_UNAVAILABLE:Object.freeze([503]),SOURCE_REQUEST_INVALID:Object.freeze([400])});
export const billTextSourceMetadata=Object.freeze({version:'1.0.0',packageVersion:'0.1.15',path:BILL_TEXT_SOURCE_PATH,method:'POST',requestBytes:4096,responseBytes:131072,
 authentication:'current native product bearer and Core access',authority:false,claimMapping:false,offsetUnit:'UTF-16 code units',scope:'successful sequential read_bill_text@0.2.0 pages only'});
