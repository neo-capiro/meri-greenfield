/** Additive admission receipt. Validation never supplies identity or dispatch authority. */
import {conversationApplicationMetadata} from '../dist/conversation-application.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const conversationInputVersion='1.0.0';
export const conversationInputPath='/api/conversations/input/admit';
export const inputErrorStatuses=conversationApplicationMetadata.errorStatuses;
export const conversationInputMetadata=freeze({packageVersion:'0.1.7',inputVersion:conversationInputVersion,schemaId:'urn:meri:conversation-input:1.0.0',
 routes:{admit:{method:'POST',path:conversationInputPath,response:'json'}},
 authentication:{...conversationApplicationMetadata.authentication,expectedContext:'independently authenticated tenant, actor, conversation, run and selected client'},
 limits:{requestBytes:conversationApplicationMetadata.limits.requestBytes,responseBytes:conversationApplicationMetadata.limits.responseBytes},
 receipt:'durable immutable input; queued is not evidence of provider execution',
 recovery:'positive stored request only; errors, absent history and RESERVED mappings grant no input or dispatch authority',
 errorStatuses:inputErrorStatuses});
