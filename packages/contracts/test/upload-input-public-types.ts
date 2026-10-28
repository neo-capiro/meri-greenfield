import type {ConversationSubmitRequest,ConversationStoredRequest} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationInputRequest,type ConversationInputAdmittedResponse} from '@capiro/meri-contracts/conversation-input';
import type {ConversationInitialInputRequest} from '@capiro/meri-contracts/conversation-initial-input';
import type {ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
const selector={uploadId:'3f2504e0-4f89-41d3-9a0c-0305e82c3301',sha256:'a'.repeat(64)};
const submitted:ConversationSubmitRequest={requestId:'id',prompt:'Attach',uploads:[selector]};
const stored:ConversationStoredRequest={...submitted,skill:null,window:null,windowRequest:null};
const input=receiveConversationInputRequest(new TextEncoder().encode(JSON.stringify(submitted))),retained:ConversationInputAdmittedResponse['request']=stored,initial:ConversationInitialInputRequest=submitted;
const history:ConversationHistoryTranscriptResponse['turns'][number]['request']=stored;
const selectorField:ConversationSubmitRequest['uploads']=stored.uploads,orderedUploadId:string|undefined=history.uploads?.[0]?.uploadId;
type UploadEvent=Extract<ConversationHistoryTranscriptResponse['events'][number]['event'],{type:'source.native-upload'}>;
declare const uploadEvent:UploadEvent;
const sourceIdentity:string=uploadEvent.data.source.uploadId,pageNumber:number=uploadEvent.data.page.number;
// @ts-expect-error durable source receipts are metadata only, never extracted text fragments
const sourceText=uploadEvent.data.fragments;
// @ts-expect-error the selector carries retained identity only, never a retention status
const status:ConversationSubmitRequest={requestId:'id',prompt:'Attach',uploads:[{uploadId:selector.uploadId,sha256:selector.sha256,status:'clean'}]};
// @ts-expect-error the selector carries no storage locator or source content
const located:ConversationSubmitRequest={requestId:'id',prompt:'Attach',uploads:[{uploadId:selector.uploadId,sha256:selector.sha256,url:'https://storage.example/original'}]};
// @ts-expect-error uploadId is required for every selector
const incomplete:ConversationSubmitRequest={requestId:'id',prompt:'Attach',uploads:[{sha256:'a'.repeat(64)}]};
// @ts-expect-error the selection is always an array of selectors, never a bare identifier
const widened:ConversationSubmitRequest={requestId:'id',prompt:'Attach',uploads:'upload-1'};
void [input,retained,initial,selectorField,orderedUploadId,sourceIdentity,pageNumber,sourceText,status,located,incomplete,widened];
