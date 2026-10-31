import {receiveConversationHistoryRequest,receiveConversationHistoryResponse,conversationHistoryMetadata,type ConversationPromptLineage,type ConversationHistoryListResponse,type ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
import type {ConversationSubmittedResponse} from '@capiro/meri-contracts/conversation-application';
import type {NativeBillTextSourceEvent,NativeHearingSourceEvent} from '@capiro/meri-contracts/conversation-sources';
import type {RunBinding,Scope,UIEvent} from '@capiro/meri-contracts';
type Run=ConversationSubmittedResponse['run'];
type Conversation=ConversationHistoryListResponse['conversations'][number];
type NativeUploadSourceEvent=Extract<ConversationHistoryTranscriptResponse['events'][number]['event'],{type:'source.native-upload'}>;
type BrowserReceipt=Extract<ConversationHistoryTranscriptResponse['events'][number]['event'],{type:'browser.receipt'}>;
type QuestionEvent=Extract<ConversationHistoryTranscriptResponse['events'][number]['event'],{type:'question.pending'|'question.answered'}>;
function preservedRun(value:Run):ConversationHistoryTranscriptResponse['latestRun']{return value;}
void preservedRun;
const bytes=new TextEncoder().encode('{}'),list=receiveConversationHistoryRequest('list',bytes),listed=await receiveConversationHistoryResponse('list',200,bytes,list);
if(!('error'in listed)){const c:Conversation|undefined=listed.conversations[0];void c;}
const request=receiveConversationHistoryRequest('transcript',bytes),response=await receiveConversationHistoryResponse('transcript',200,bytes,request);
if(!('error'in response)){const run:Run=response.latestRun,conversation:Conversation=response.conversation,binding:RunBinding=response.latestRun.binding,scopes:Scope[]=response.latestRun.scopes,event:UIEvent|NativeBillTextSourceEvent|NativeHearingSourceEvent|NativeUploadSourceEvent|QuestionEvent|BrowserReceipt|undefined=response.events[0]?.event,lineage:ConversationPromptLineage|undefined=response.turns[0]?.promptLineage;void [run,conversation,binding,scopes,event,lineage];}
const cap:number=conversationHistoryMetadata.limits.responseBytes;void cap;
const deletionRequest=receiveConversationHistoryRequest('deletionStatus',bytes),deletion=await receiveConversationHistoryResponse('deletionStatus',200,bytes,deletionRequest);
if(!('error'in deletion)){const state:'pending'|'blocked'|'unknown'|'completed'|'superseded'=deletion.state,retained:boolean=deletion.retainedSharedCopies;void [state,retained];}
const deletionList=receiveConversationHistoryRequest('deletions',bytes),deletions=await receiveConversationHistoryResponse('deletions',200,bytes,deletionList);
if(!('error'in deletions)){const id:string|undefined=deletions.requests[0]?.requestId,unknown:boolean=deletions.olderRequestsUnavailable;void [id,unknown];}
const exportRequest=receiveConversationHistoryRequest('export',bytes),exported=await receiveConversationHistoryResponse('export',200,bytes,exportRequest);
if(!('error'in exported)){const text:string|undefined=exported.turns[0]?.messages[0]?.text,expires:string=exported.expiresAt,through:number=exported.throughSequence;void [text,expires,through];}
const summaries=receiveConversationHistoryRequest('summaries',bytes),summary=await receiveConversationHistoryResponse('summaries',200,bytes,summaries);
if(!('error'in summary)){const title:string|undefined=summary.conversations[0]?.title,client:string|null|undefined=summary.conversations[0]?.clientId;void [title,client];}
const manage=receiveConversationHistoryRequest('manage',bytes),managed=await receiveConversationHistoryResponse('manage',200,bytes,manage);
if(!('error'in managed)){const revision:string=managed.conversation.revision;void revision;}
// @ts-expect-error route names are fixed, no invented search
receiveConversationHistoryRequest('search',bytes);
// @ts-expect-error a plain request has no local byte-admission provenance
await receiveConversationHistoryResponse('transcript',200,bytes,{conversationId:'id'});

if(!('error'in response)){const e=response.events[0]?.event;if(e?.type==='source.native-bill-text'){const native:NativeBillTextSourceEvent=e;void native;}else if(e?.type==='source.native-hearing-record'){const native:NativeHearingSourceEvent=e;void native;}else if(e?.type==='source.native-upload'){const upload:NativeUploadSourceEvent=e;void upload;}else if(e?.type==='question.pending'||e?.type==='question.answered'){const question:QuestionEvent=e;void question;}else if(e?.type==='browser.receipt'){const browser:BrowserReceipt=e;void browser;}else{const legacy:UIEvent|undefined=e;void legacy;}}
