/** SDK messages the CLI has already produced, read while the activity awaits a publication so that consecutive text deltas can
 * share the next one. Reads stay one at a time and in order, at most `limit` ahead, only inside `during()`, and never past a
 * message `last` accepts. A read that fails keeps its place, and a message read ahead is consumed only when `check` (what a read
 * made at that moment would face) passes, so the activity meets every failure exactly where it would have without reading ahead. */
export function createSdkReadAhead(read,{limit=512,last=()=>false,check=()=>{}}={}){
 if(typeof read!=='function'||typeof last!=='function'||typeof check!=='function'||!Number.isSafeInteger(limit)||limit<1)throw Error('READ_AHEAD_CONFIGURATION');
 const queue=[];let pending=null,stopped=false,filling=0;
 function pull(){
  if(pending||stopped||filling===0||queue.length>=limit)return;
  pending=Promise.resolve().then(read).then(result=>{queue.push({result});if(result?.done||last(result?.value))stopped=true;},error=>{queue.push({error});stopped=true;})
   .finally(()=>{pending=null;pull();});
 }
 return Object.freeze({
  /** Reads ahead while `operation` runs; a read still in flight when it settles lands in the queue. */
  async during(operation){filling++;pull();try{return await operation();}finally{filling--;}},
  /** The next message, already read, without waiting for the SDK: undefined when none is, or the next result is the end or a failure. */
  peek(){const head=queue[0];return head&&!head.error&&!head.result.done?head.result.value:undefined;},
  /** Consumes the message peek() returned. */
  take(){check();return queue.shift().result.value;},
  /** The next result in order: one already read, the read in flight, or a new read. */
  async next(){if(!queue.length&&pending)await pending;if(!queue.length)return read();check();const {result,error}=queue.shift();if(error)throw error;return result;},
 });
}
