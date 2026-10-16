import {receiveConversationHistoryRequest,receiveConversationHistoryResponse,conversationHistoryMetadata,type ConversationPromptLineage,type ConversationHistoryListResponse,type ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
import type {ConversationSubmittedResponse} from '@capiro/meri-contracts/conversation-application';
import type {RunBinding,Scope,UIEvent} from '@capiro/meri-contracts';
type Run=ConversationSubmittedResponse['run'];
type Conversation=ConversationHistoryListResponse['conversations'][number];
function preservedRun(value:Run):ConversationHistoryTranscriptResponse['latestRun']{return value;}
void preservedRun;
const bytes=new TextEncoder().encode('{}'),list=receiveConversationHistoryRequest('list',bytes),listed=await receiveConversationHistoryResponse('list',200,bytes,list);
if(!('error'in listed)){const c:Conversation|undefined=listed.conversations[0];void c;}
const request=receiveConversationHistoryRequest('transcript',bytes),response=await receiveConversationHistoryResponse('transcript',200,bytes,request);
if(!('error'in response)){const run:Run=response.latestRun,conversation:Conversation=response.conversation,binding:RunBinding=response.latestRun.binding,scopes:Scope[]=response.latestRun.scopes,event:UIEvent|undefined=response.events[0]?.event,lineage:ConversationPromptLineage|undefined=response.turns[0]?.promptLineage;void [run,conversation,binding,scopes,event,lineage];}
const cap:number=conversationHistoryMetadata.limits.responseBytes;void cap;
// @ts-expect-error route names are fixed, no invented search
receiveConversationHistoryRequest('search',bytes);
// @ts-expect-error a plain request has no local byte-admission provenance
await receiveConversationHistoryResponse('transcript',200,bytes,{conversationId:'id'});
