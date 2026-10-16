import {receiveConversationHistoryRequest,receiveConversationHistoryResponse,conversationHistoryMetadata,type ConversationPromptLineage} from '@capiro/meri-contracts/conversation-history';
import type {Run,Conversation,Scope,UIEvent} from '@capiro/meri-contracts';
const bytes=new TextEncoder().encode('{}'),list=receiveConversationHistoryRequest('list',bytes),listed=await receiveConversationHistoryResponse('list',200,bytes,list);
if(!('error'in listed)){const c:Conversation|undefined=listed.conversations[0];void c;}
const request=receiveConversationHistoryRequest('transcript',bytes),response=await receiveConversationHistoryResponse('transcript',200,bytes,request);
if(!('error'in response)){const run:Run=response.latestRun,conversation:Conversation=response.conversation,scopes:Scope[]=response.latestRun.scopes,event:UIEvent|undefined=response.events[0]?.event,lineage:ConversationPromptLineage|undefined=response.turns[0]?.promptLineage;void [run,conversation,scopes,event,lineage];}
const cap:number=conversationHistoryMetadata.limits.responseBytes;void cap;
// @ts-expect-error route names are fixed, no invented search
receiveConversationHistoryRequest('search',bytes);
// @ts-expect-error a plain request has no local byte-admission provenance
await receiveConversationHistoryResponse('transcript',200,bytes,{conversationId:'id'});
