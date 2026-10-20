/** Bounded durable subscription. Reconnect cursor is an event sequence, never client authority. */
import {fail} from './boundary.mjs';
export function createConversationEventSource({service,credential,after=0,signal,maxSubscriptionMs=30000,pollMs=100,idleRecheckMs=10000,now=Date.now}){
 if(typeof service?.observe!=='function'||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(maxSubscriptionMs)||maxSubscriptionMs<1||maxSubscriptionMs>30000||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000||!Number.isSafeInteger(idleRecheckMs)||idleRecheckMs<pollMs||idleRecheckMs>30000)fail('SUBSCRIPTION_CONFIGURATION');
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const deadline=now()+maxSubscriptionMs;let cursor=after,closed=false;
 const close=()=>{if(!closed){closed=true;controller.abort();signal?.removeEventListener('abort',abort);}};
 // One observation window per subscription: the service releases each page only after its own fresh identity/current-context check
 // and, while idle, rechecks every idleRecheckMs so a revoked or suppressed subscription ends.
 return new ReadableStream({async pull(output){if(closed)return;
   try{await service.observe({credential,after:cursor,untilMs:deadline,pollMs,idleRecheckMs,signal:controller.signal,deliver(events){controller.signal.throwIfAborted();
    for(const event of events){if(event.sequence!==cursor+1)fail('EVENT_SEQUENCE_REFUSED');cursor=event.sequence;output.enqueue(event);}}});}
   catch{if(!closed){close();output.error(Error('SUBSCRIPTION_UNAVAILABLE'));}return;}
   if(!closed){close();output.close();}},cancel(){close();}});
}
