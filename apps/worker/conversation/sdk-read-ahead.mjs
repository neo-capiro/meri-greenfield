/** SDK messages the CLI has already produced, read while the activity awaits a publication so that consecutive text deltas can
 * share the next one. Reads stay one at a time and in order, at most `limit` ahead, and only inside `during()`; a read that fails
 * keeps its place, so the activity meets the failure exactly where it would have without reading ahead. */
export function createSdkReadAhead(read,{limit=512}={}){
 if(typeof read!=='function'||!Number.isSafeInteger(limit)||limit<1)throw Error('READ_AHEAD_CONFIGURATION');
 const queue=[];let pending=null,ended=false,filling=0;
 function pull(){
  if(pending||ended||filling===0||queue.length>=limit)return;
  pending=Promise.resolve().then(read).then(result=>{queue.push({result});if(result?.done)ended=true;},error=>{queue.push({error});ended=true;})
   .finally(()=>{pending=null;pull();});
 }
 return Object.freeze({
  /** Reads ahead while `operation` runs; a read still in flight when it settles lands in the queue. */
  async during(operation){filling++;pull();try{return await operation();}finally{filling--;}},
  /** The next message, already read, without waiting for the SDK: undefined when none is, or the next result is the end or a failure. */
  peek(){const head=queue[0];return head&&!head.error&&!head.result.done?head.result.value:undefined;},
  /** Removes the message peek() returned. */
  take(){return queue.shift().result.value;},
  /** The next result in order: one already read, the read in flight, or a new read. */
  async next(){if(!queue.length&&pending)await pending;if(!queue.length)return read();const {result,error}=queue.shift();if(error)throw error;return result;},
 });
}
