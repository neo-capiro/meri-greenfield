// @ts-check
/** One bounded user-input stream for the upstream SDK; no model-selection loop. */
import {Readable} from 'node:stream';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
function userMessage(value,initial=false) {
  const fields=data(own(value,initial?['requestId','prompt']:['controlId','prompt'],['sessionId']));
  const uuid=initial?fields.requestId:fields.controlId;
  if(typeof uuid!=='string'||!UUID.test(uuid)||typeof fields.prompt!=='string'||!fields.prompt.trim()||
      fields.prompt.length>100000||Buffer.byteLength(fields.prompt,'utf8')>131072||
      fields.sessionId!==undefined&&(typeof fields.sessionId!=='string'||!UUID.test(fields.sessionId)))fail('SDK_INPUT_REFUSED');
  return data({type:'user',message:{role:'user',content:fields.prompt},parent_tool_use_id:null,uuid,priority:'now',client_composed:true,
    ...(fields.sessionId===undefined?{}:{session_id:fields.sessionId})});
}
export function createConversationInput(options) {
  const {requestId,prompt,sessionId,maxQueued=8}=own(options,['requestId','prompt'],['sessionId','maxQueued']);
  if(!Number.isSafeInteger(maxQueued)||maxQueued<1||maxQueued>32)fail('SDK_INPUT_CONFIGURATION');
  const first=userMessage({requestId,prompt,...(sessionId===undefined?{}:{sessionId})},true);
  const source=new Readable({objectMode:true,highWaterMark:maxQueued,read(){}});let closed=false,consumed=false;
  source.push(first);
  const iterable=Object.freeze({[Symbol.asyncIterator](){if(consumed)fail('SDK_INPUT_ALREADY_CONSUMED');consumed=true;return source[Symbol.asyncIterator]();}});
  function enqueue(message) {
    if(closed||source.destroyed)fail('SDK_INPUT_CLOSED');
    const next=userMessage(message);if(source.readableLength>=maxQueued)fail('SDK_INPUT_LIMIT');
    source.push(next);return Object.freeze({inputId:next.uuid,outcome:'UNKNOWN'});
  }
  function close(){if(!closed){closed=true;while(source.readableLength>0)source.read();source.push(null);}return {physicalStopProven:false};}
  return Object.freeze({prompt:iterable,enqueue,close});
}
