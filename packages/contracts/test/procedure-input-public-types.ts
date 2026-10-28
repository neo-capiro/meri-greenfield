import type {ConversationSubmitRequest,ConversationStoredRequest} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationInputRequest,type ConversationInputAdmittedResponse} from '@capiro/meri-contracts/conversation-input';
import type {ConversationInitialInputRequest} from '@capiro/meri-contracts/conversation-initial-input';
import type {ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
const firm={source:'firm' as const,recordId:'id',version:2,manifestDigest:'a'.repeat(64)};
const submitted:ConversationSubmitRequest={requestId:'id',prompt:'Use this procedure',procedure:firm};
const builtin:ConversationSubmitRequest={requestId:'id',prompt:'Prepare',procedure:{source:'builtin',id:'briefing',version:1,manifestDigest:'b'.repeat(64)}};
const input=receiveConversationInputRequest(new TextEncoder().encode(JSON.stringify(builtin)));
const inputSelector:ConversationSubmitRequest['procedure']=input.procedure;
const initial:ConversationInitialInputRequest=submitted;
const stored:ConversationStoredRequest={...submitted,skill:null,window:null,windowRequest:null};
const admitted:ConversationInputAdmittedResponse['request']=stored;
const historical:ConversationHistoryTranscriptResponse['turns'][number]['request']=stored;
// @ts-expect-error the exact selector cannot contain tools or grants
const widened:ConversationSubmitRequest={requestId:'id',prompt:'Use',procedure:{...firm,allowedTools:['*']}};
// @ts-expect-error builtin identity is closed to the six canonical procedures
const invented:ConversationSubmitRequest={requestId:'id',prompt:'Use',procedure:{source:'builtin',id:'uninstalled',version:1,manifestDigest:'a'}};
// @ts-expect-error firm identity requires a record ID
const incomplete:ConversationInitialInputRequest={requestId:'id',prompt:'Use',procedure:{source:'firm',version:1,manifestDigest:'a'}};
void [submitted,builtin,inputSelector,initial,admitted,historical,widened,invented,incomplete];
