/** Standard AWS SDK transport. Dispatch/stream uncertainty never replays a model invocation. */
import {BedrockAgentCoreClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand} from '@aws-sdk/client-bedrock-agentcore';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {invocationInput,settlementResult,agentcoreFault} from './agentcore-contract.mjs';

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
export function createAgentCoreClient(configuration){
 const c=own(configuration,['region','agentRuntimeArn','qualifier'],['client','now']),now=c.now??Date.now;
 if(typeof c.region!=='string'||! /^[a-z]{2}(?:-[a-z]+)+-\d$/u.test(c.region)||typeof c.agentRuntimeArn!=='string'||! /^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/u.test(c.agentRuntimeArn)||c.agentRuntimeArn.split(':')[3]!==c.region||typeof c.qualifier!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u.test(c.qualifier)||typeof now!=='function')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 const client=c.client??new BedrockAgentCoreClient({region:c.region,maxAttempts:1});if(typeof client.send!=='function')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 return Object.freeze({
  async invoke({signal,...raw}){
   nativeSignal(signal);const input=invocationInput(raw),life=createOperationLifetime({now,signal,deadlineMs:input.execution.expiresAtMs,errorFactory:agentcoreFault});let dispatched=false,response;
   try{life.check();response=await life.run(abortSignal=>{dispatched=true;return client.send(new InvokeAgentRuntimeCommand({agentRuntimeArn:c.agentRuntimeArn,qualifier:c.qualifier,runtimeSessionId:input.execution.runtimeSessionId,contentType:'application/json',accept:'text/event-stream',payload:Buffer.from(JSON.stringify(input))}),{abortSignal});});
    if(response.statusCode!==200||response.$metadata?.httpStatusCode!==200||response.runtimeSessionId!==input.execution.runtimeSessionId||!['application/json','text/event-stream'].includes(response.contentType))throw agentcoreFault('AGENTCORE_RESULT_REFUSED');
    const value=await readSettlement(response.response,response.contentType,life);life.check();return settlementResult(value,input.execution);
   }catch(error){if(dispatched)throw agentcoreFault('AGENTCORE_OUTCOME_UNKNOWN');throw error;}
   finally{response?.response?.destroy?.();life.close();}
  },
  async stop(raw){
   const v=own(raw,['binding','executionId','runtimeSessionId'],['signal']);nativeSignal(v.signal);const binding=data(v.binding);validateShape('RunBinding',binding);
   if(v.executionId!==hash(binding)||typeof v.runtimeSessionId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{32,255}$/u.test(v.runtimeSessionId))throw agentcoreFault('AGENTCORE_STOP_REFUSED');
   const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+23000,errorFactory:agentcoreFault});let dispatched=false;
   try{life.check();const result=await life.run(abortSignal=>{dispatched=true;return client.send(new StopRuntimeSessionCommand({agentRuntimeArn:c.agentRuntimeArn,qualifier:c.qualifier,runtimeSessionId:v.runtimeSessionId,clientToken:v.executionId}),{abortSignal});});
    life.check();if(result.statusCode!==200||result.$metadata?.httpStatusCode!==200||result.runtimeSessionId!==v.runtimeSessionId)throw agentcoreFault('AGENTCORE_STOP_REFUSED');return {binding,executionId:v.executionId,runtimeSessionId:v.runtimeSessionId,stopped:true};
   }catch(error){if(dispatched)throw agentcoreFault('AGENTCORE_STOP_UNKNOWN');throw error;}finally{life.close();}
  },
  close(){if(c.client===undefined)client.destroy();},
 });
}
