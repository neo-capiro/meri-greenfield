import type {Options,SDKUserMessage,Query} from '@anthropic-ai/claude-agent-sdk';
const resume:Pick<Options,'resume'|'resumeSessionAt'|'forkSession'|'sessionId'>={resume:'00000008-0000-4000-8000-000000000000',resumeSessionAt:'00000017-0000-4000-8000-000000000000',forkSession:true,sessionId:'00000018-0000-4000-8000-000000000000'};
const initial:SDKUserMessage={type:'user',message:{role:'user',content:'Typed synthetic input'},parent_tool_use_id:null,uuid:'00000001-0000-4000-8000-000000000000',priority:'now',client_composed:true};
const prompt:Options={...resume};
void prompt;void initial;
export function supportedInterrupt(query:Query){return query.interrupt();}
export function supportedInput(query:Query,input:AsyncIterable<SDKUserMessage>){return query.streamInput(input);}
