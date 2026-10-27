import type {ConversationSubmitRequest,ConversationStoredRequest} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationInputRequest,type ConversationInputAdmittedResponse} from '@capiro/meri-contracts/conversation-input';
import type {ConversationInitialInputRequest} from '@capiro/meri-contracts/conversation-initial-input';
import type {ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
const selection={artifactId:'id',versionId:'id',objectSha256:'hash'};
const submitted:ConversationSubmitRequest={requestId:'id',prompt:'Revise',documentRevision:selection};
const stored:ConversationStoredRequest={...submitted,skill:null,window:null,windowRequest:null};
const input=receiveConversationInputRequest(new TextEncoder().encode(JSON.stringify(submitted))),retained:ConversationInputAdmittedResponse['request']=stored,initial:ConversationInitialInputRequest=submitted;
const history:ConversationHistoryTranscriptResponse['turns'][number]['request']=stored;
const objectHash:string|undefined=history.documentRevision?.objectSha256;
// @ts-expect-error the selector cannot carry browser authority or arbitrary source content
const wrong:ConversationSubmitRequest={requestId:'id',prompt:'Revise',documentRevision:{...selection,credential:'no'}};
void [input,retained,initial,objectHash,wrong];
