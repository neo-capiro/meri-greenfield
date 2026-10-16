/** Additive original-input allocation transport. Validation supplies no creation, membership or dispatch authority. */
import {conversationInputMetadata} from '../dist/conversation-input.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const conversationInitialInputVersion='1.0.0';
export const conversationInitialInputPath='/api/conversations/input/allocate';
export const initialInputErrorStatuses=freeze({
 NOT_FOUND:[404],METHOD_NOT_ALLOWED:[405],INVALID_REQUEST:[400],SESSION_REFUSED:[401,403],SCOPE_REFUSED:[403],SESSION_CHANGED:[403],STALE_WRITER:[403],
 INITIAL_INPUT_CONFLICT:[409],INITIAL_INPUT_ALREADY_EXISTS:[409],INITIAL_INPUT_EXPIRED:[408],DEADLINE:[408],CANCELLED:[408],
 INITIAL_INPUT_REQUIRED:[503],INITIAL_INPUT_CORRUPT:[503],INITIAL_INPUT_UNAVAILABLE:[503],REQUEST_TOO_LARGE:[413],UNSUPPORTED_MEDIA_TYPE:[415],
});
export const conversationInitialInputErrorStatuses=initialInputErrorStatuses;
export const initialInputUnknownCodes=Object.freeze(['DEADLINE','CANCELLED','INITIAL_INPUT_UNAVAILABLE','INITIAL_INPUT_CORRUPT','INITIAL_INPUT_REQUIRED']);
/** Conservative HTTP default; a domain owner may positively prove NOT_DISPATCHED for an otherwise uncertain code. */
export const initialInputErrorOutcomes=freeze(Object.fromEntries(Object.keys(initialInputErrorStatuses).map(code=>[code,initialInputUnknownCodes.includes(code)?'UNKNOWN':'NOT_DISPATCHED'])));
export const conversationInitialInputMetadata=freeze({packageVersion:'0.1.8',initialInputVersion:conversationInitialInputVersion,schemaId:'urn:meri:conversation-initial-input:1.0.0',
 routes:{allocate:{method:'POST',path:conversationInitialInputPath,response:'json'}},
 authentication:{...conversationInputMetadata.authentication},limits:{requestBytes:131072,responseBytes:131072,maxRequestMs:3000},
 bridge:{owner:'accepted conversation-input receiver',responseBytes:conversationInputMetadata.limits.responseBytes,viewOwner:'conversationInputView'},
 recovery:'only the exact retained immutable request with its genuine allocation proof; digests, UNKNOWN and absence do not create input authority',
 errorOutcomes:['NOT_DISPATCHED','UNKNOWN'],errorOutcomeByCode:initialInputErrorOutcomes,errorStatuses:initialInputErrorStatuses});
