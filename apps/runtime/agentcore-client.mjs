/** Standard AWS SDK transport. Dispatch/stream uncertainty never replays a model invocation. */
import {BedrockAgentCoreClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand} from '@aws-sdk/client-bedrock-agentcore';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {invocationInput,settlementResult,agentcoreFault,endedUnsettled} from './agentcore-contract.mjs';

async function readSettlement(stream,contentType,life){
 if(!stream||typeof stream[Symbol.asyncIterator]!=='function')throw agentcoreFault('AGENTCORE_RESULT_REFUSED');
 const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';const iterator=stream[Symbol.asyncIterator]();
 try{while(true){const next=await life.run(()=>iterator.next());if(next.done)break;if(!(next.value instanceof Uint8Array))throw agentcoreFault('AGENTCORE_RESULT_REFUSED');bytes+=next.value.byteLength;if(bytes>65536)throw agentcoreFault('AGENTCORE_RESULT_REFUSED');text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();}
 finally{stream.destroy?.();}
 if(contentType==='application/json')return JSON.parse(text);
 // This private stream has comments and exactly one JSON data event. User text is already persisted by control.
 const events=text.replace(/\r\n/gu,'\n').split('\n\n').filter(part=>part.trim()&&!part.split('\n').every(line=>!line||line.startsWith(':')));
 if(events.length!==1)throw agentcoreFault('AGENTCORE_RESULT_REFUSED');
 const lines=events[0].split('\n').filter(line=>line&&!line.startsWith(':'));
 if(lines.length!==1||!lines[0].startsWith('data: '))throw agentcoreFault('AGENTCORE_RESULT_REFUSED');return JSON.parse(lines[0].slice(6));
}
/** AgentCore's definitive answer that it holds no such session: 404 ResourceNotFoundException, documented for StopRuntimeSession
 * as "Session not found or already terminated" (an idle-terminated, ended or never-started session). It does not say the
 * session was never running, so only the execution owner, which knows the run's lease, may treat it as stopped. */
const sessionNotFound=error=>error?.name==='ResourceNotFoundException'&&error?.$metadata?.httpStatusCode===404;
// Bounded diagnostic categories only. Never retain provider messages, request IDs, headers or bodies.
function stopFailureReason(error){
 const status=error?.$metadata?.httpStatusCode;
 const known={AccessDeniedException:[403,'STOP_ACCESS_DENIED'],UnauthorizedException:[401,'STOP_UNAUTHORIZED'],
  ThrottlingException:[429,'STOP_THROTTLED'],ConflictException:[409,'STOP_CONFLICT'],RetryableConflictException:[409,'STOP_CONFLICT'],
  InternalServerException:[500,'STOP_SERVICE_ERROR'],RuntimeClientError:[424,'STOP_RUNTIME_ERROR'],
  ServiceQuotaExceededException:[402,'STOP_QUOTA_EXCEEDED'],ValidationException:[400,'STOP_VALIDATION_ERROR']};
 const match=Object.hasOwn(known,error?.name)?known[error.name]:null;
 if(match&&status===match[0])return match[1];
 if(error?.code==='AGENTCORE_STOP_REFUSED')return 'STOP_RESPONSE_REFUSED';
 if(error?.code==='DEADLINE'||error?.code==='CANCELLED')return 'STOP_INTERRUPTED';
 return Number.isInteger(status)&&status>=100&&status<=599?'STOP_PROVIDER_OTHER':'STOP_TRANSPORT_UNKNOWN';
}
export function createAgentCoreClient(configuration){
 const c=own(configuration,['region','agentRuntimeArn','qualifier'],['client','now']),now=c.now??Date.now;
 if(typeof c.region!=='string'||! /^[a-z]{2}(?:-[a-z]+)+-\d$/u.test(c.region)||typeof c.agentRuntimeArn!=='string'||! /^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/u.test(c.agentRuntimeArn)||c.agentRuntimeArn.split(':')[3]!==c.region||typeof c.qualifier!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u.test(c.qualifier)||typeof now!=='function')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 const client=c.client??new BedrockAgentCoreClient({region:c.region,maxAttempts:1});if(typeof client.send!=='function')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 return Object.freeze({
  async invoke({signal,...raw}){
   nativeSignal(signal);const input=invocationInput(raw),life=createOperationLifetime({now,signal,deadlineMs:input.execution.expiresAtMs,errorFactory:agentcoreFault});let dispatched=false,response;
   try{life.check();response=await life.run(abortSignal=>{dispatched=true;return client.send(new InvokeAgentRuntimeCommand({agentRuntimeArn:c.agentRuntimeArn,qualifier:c.qualifier,runtimeSessionId:input.execution.runtimeSessionId,contentType:'application/json',accept:'text/event-stream',payload:Buffer.from(JSON.stringify(input))}),{abortSignal});});
    if(response.statusCode!==200||response.$metadata?.httpStatusCode!==200||response.runtimeSessionId!==input.execution.runtimeSessionId||!['application/json','text/event-stream'].includes(response.contentType))throw agentcoreFault('AGENTCORE_RESULT_REFUSED');
    const value=await readSettlement(response.response,response.contentType,life);life.check();
    if(endedUnsettled(value))throw agentcoreFault('AGENTCORE_EXECUTION_ENDED');return settlementResult(value,input.execution);
   }catch(error){if(dispatched&&error?.code!=='AGENTCORE_EXECUTION_ENDED')throw agentcoreFault('AGENTCORE_OUTCOME_UNKNOWN');throw error;}
   finally{response?.response?.destroy?.();life.close();}
  },
  async stop(raw){
   const v=own(raw,['binding','executionId','runtimeSessionId'],['signal']);nativeSignal(v.signal);const binding=data(v.binding);validateShape('RunBinding',binding);
   if(v.executionId!==hash(binding)||typeof v.runtimeSessionId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{32,255}$/u.test(v.runtimeSessionId))throw agentcoreFault('AGENTCORE_STOP_REFUSED');
   const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+23000,errorFactory:agentcoreFault});let dispatched=false;
   try{life.check();const result=await life.run(abortSignal=>{dispatched=true;return client.send(new StopRuntimeSessionCommand({agentRuntimeArn:c.agentRuntimeArn,qualifier:c.qualifier,runtimeSessionId:v.runtimeSessionId,clientToken:v.executionId}),{abortSignal});});
    life.check();if(result.statusCode!==200||result.$metadata?.httpStatusCode!==200||result.runtimeSessionId!==v.runtimeSessionId)throw agentcoreFault('AGENTCORE_STOP_REFUSED');return {binding,executionId:v.executionId,runtimeSessionId:v.runtimeSessionId,stopped:true};
   }catch(error){if(dispatched)throw Object.assign(agentcoreFault(sessionNotFound(error)?'AGENTCORE_SESSION_NOT_FOUND':'AGENTCORE_STOP_UNKNOWN'),
    {reasonCode:sessionNotFound(error)?'STOP_SESSION_NOT_FOUND':stopFailureReason(error)});throw error;}finally{life.close();}
  },
  close(){if(c.client===undefined)client.destroy();},
 });
}
