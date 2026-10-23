import {receiveConversationSessionReceipt, type ConversationSessionExpectedContext} from '@capiro/meri-contracts/conversation-session';
import {skillCatalog} from '@capiro/meri-contracts/skill-catalog';
const general:ConversationSessionExpectedContext={tenantId:'t',actorId:'a',conversationId:'c',runId:'r',selectedClientId:null,scopeKind:'general'};
// @ts-expect-error client selection cannot masquerade as General
const forged:ConversationSessionExpectedContext={...general,scopeKind:'general',selectedClientId:'client'};
const receipt=receiveConversationSessionReceipt(new Uint8Array(),new Uint8Array(),0);
const selected:string|null=receipt.context.selectedClientId;
for(const skill of skillCatalog.skills){const unavailable:false=skill.available;void unavailable;}
void general;void forged;void selected;
