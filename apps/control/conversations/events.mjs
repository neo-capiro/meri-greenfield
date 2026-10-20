/** Bounded durable subscription. Reconnect cursor is an event sequence, never client authority. */
import {fail} from './boundary.mjs';
/** opened(run) runs once after the window's first authorized page read, before any event is released, and may refuse by throwing;
 * refused(error) receives the original failure of a window that never opened, so the route can answer it before any header. */
export function createConversationEventSource({service,credential,after=0,signal,maxSubscriptionMs=30000,pollMs=100,idleRecheckMs=10000,now=Date.now,opened,refused}){
 if(typeof service?.observe!=='function'||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(maxSubscriptionMs)||maxSubscriptionMs<1||maxSubscriptionMs>30000||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000||!Number.isSafeInteger(idleRecheckMs)||idleRecheckMs<pollMs||idleRecheckMs>30000||[opened,refused].some(f=>f!==undefined&&typeof f!=='function'))fail('SUBSCRIPTION_CONFIGURATION');
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const deadline=now()+maxSubscriptionMs;let cursor=after,closed=false,open=false;
 const close=()=>{if(!closed){closed=true;controller.abort();signal?.removeEventListener('abort',abort);}};
 // One observation window per subscription: the service releases each page only after its own fresh identity/current-context check
 // and, while idle, rechecks every idleRecheckMs so a revoked or suppressed subscription ends.
 return new ReadableStream({async pull(output){if(closed)return;
   try{await service.observe({credential,after:cursor,untilMs:deadline,pollMs,idleRecheckMs,signal:controller.signal,opened(run){opened?.(run);open=true;},deliver(events){controller.signal.throwIfAborted();
    for(const event of events){if(event.sequence!==cursor+1)fail('EVENT_SEQUENCE_REFUSED');cursor=event.sequence;output.enqueue(event);}}});}
   catch(error){if(!open)refused?.(error);if(!closed){close();output.error(Error('SUBSCRIPTION_UNAVAILABLE'));}return;}
   // A window that ended before its first page read never validated anything: it is refused like a failed one.
   if(!open)refused?.(Error('SUBSCRIPTION_UNAVAILABLE'));
   if(!closed){close();output.close();}},cancel(){close();}});
}
