import type {WorkerOptions, NativeConnectionOptions} from '@temporalio/worker';
import type {ConnectionOptions} from '@temporalio/client';
import type {TLSConfig} from '@temporalio/client';
const tls:TLSConfig={serverRootCACertificate:Buffer.from('synthetic'),clientCertPair:{crt:Buffer.from('synthetic'),key:Buffer.from('synthetic')}};
const native:NativeConnectionOptions={address:'temporal.example.invalid:7233',tls};
const client:ConnectionOptions={address:'temporal.example.invalid:7233',tls,connectTimeout:3000};
const worker:WorkerOptions={connection:undefined,namespace:'meri-preview',taskQueue:'meri-conversations-v1',workflowsPath:'/opt/meri/apps/control/conversations/workflow.ts',activities:{executeConversation:async()=>({state:'completed'})},shutdownGraceTime:5000,shutdownForceTime:6000};
void [native,client,worker];

// Actual pinned AgentCore SDK wire, rather than a custom SigV4 or transport DTO.
import {BedrockAgentCoreClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand} from '@aws-sdk/client-bedrock-agentcore';
import type {InvokeAgentRuntimeCommandOutput,StopRuntimeSessionCommandOutput} from '@aws-sdk/client-bedrock-agentcore';
const agentCore=new BedrockAgentCoreClient({region:'us-east-1',maxAttempts:1});
const invocation:Promise<InvokeAgentRuntimeCommandOutput>=agentCore.send(new InvokeAgentRuntimeCommand({agentRuntimeArn:'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/synthetic',qualifier:'preview',runtimeSessionId:'synthetic-session-11111111111111111111',contentType:'application/json',accept:'text/event-stream',payload:Buffer.from('{}')}));
const stopped:Promise<StopRuntimeSessionCommandOutput>=agentCore.send(new StopRuntimeSessionCommand({agentRuntimeArn:'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/synthetic',qualifier:'preview',runtimeSessionId:'synthetic-session-11111111111111111111',clientToken:'a'.repeat(64)}));
void [invocation,stopped];

// Public Outreach launch receipt is consumed without private runtime DTOs.
import {receiveOutreachGenerationStartResponse,requireOutreachGenerationStartRequest} from '../../../packages/contracts/outreach-generation.js';
import type {OutreachGenerationStarted} from '../../../packages/contracts/outreach-generation.js';
const outreachRequest=requireOutreachGenerationStartRequest({generationJobId:'synthetic',itemId:'synthetic'});
const outreachReceipt=receiveOutreachGenerationStartResponse(202,'{}',outreachRequest,0);
if('session' in outreachReceipt){const started:OutreachGenerationStarted=outreachReceipt;void started.session.context.runId;}
