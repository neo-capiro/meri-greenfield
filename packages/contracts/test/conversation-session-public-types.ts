import {receiveConversationSessionReceipt, type ConversationSessionExpectedContext} from '@capiro/meri-contracts/conversation-session';
const general:ConversationSessionExpectedContext={tenantId:'t',actorId:'a',conversationId:'c',runId:'r',selectedClientId:null,scopeKind:'general'};
// @ts-expect-error client selection cannot masquerade as General
const forged:ConversationSessionExpectedContext={...general,scopeKind:'general',selectedClientId:'client'};
const receipt=receiveConversationSessionReceipt(new Uint8Array(),new Uint8Array(),0);
const selected:string|null=receipt.context.selectedClientId;
const sourceRun:string|undefined=receipt.initialRunRebind?.sourceRunId;
const targetRun:string|undefined=receipt.initialRunRebind?.targetRunId;
// @ts-expect-error a browser recovery hint is not an expected selector
const recoveryHint:ConversationSessionExpectedContext={...general,recovery:true};
void general;void forged;void selected;
void sourceRun;void targetRun;void recoveryHint;
