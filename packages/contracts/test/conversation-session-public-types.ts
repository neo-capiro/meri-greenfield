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
const research:ConversationSessionExpectedContext={tenantId:'t',actorId:'a',conversationId:'c',selectedClientId:null,scopeKind:'research_portfolio',scope:{kind:'research_portfolio',researchPortfolioId:'p',researchPortfolioName:'Captured',researchPortfolioRevision:1,scopeVersion:'hash'}};
// @ts-expect-error Research always needs its independently admitted conversation and capture
const uncorrelatedResearch:ConversationSessionExpectedContext={tenantId:'t',actorId:'a',selectedClientId:null,scopeKind:'research_portfolio'};
// @ts-expect-error a captured Research scope never extends the legacy General branch
const researchAsGeneral:ConversationSessionExpectedContext={...general,scope:research.scope};
void research;void uncorrelatedResearch;void researchAsGeneral;
