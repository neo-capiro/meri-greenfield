/** Bounded durable subscription. Reconnect cursor is an event sequence, never client authority. */
import {setTimeout as delay} from 'node:timers/promises';
import {terminal,fail} from './boundary.mjs';
export function createConversationEventSource({service,credential,after=0,signal,maxSubscriptionMs=30000,pollMs=100,now=Date.now}){
 if(typeof service?.history!=='function'||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(maxSubscriptionMs)||maxSubscriptionMs<1||maxSubscriptionMs>30000||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)fail('SUBSCRIPTION_CONFIGURATION');
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const deadline=now()+maxSubscriptionMs;let cursor=after,closed=false;const timer=setTimeout(()=>controller.abort(Error('SUBSCRIPTION_DEADLINE')),maxSubscriptionMs);
 const close=()=>{if(!closed){closed=true;clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);}};
 return new ReadableStream({async pull(output){try{while(!closed){controller.signal.throwIfAborted();if(now()>=deadline){close();output.close();return;}
    // Each page is read and released under the existing session's fresh identity/current-context checks.
    const page=await service.history({credential,after:cursor,limit:1,signal:controller.signal});controller.signal.throwIfAborted();if(now()>=deadline){close();output.close();return;}
    if(page.events.length){const event=page.events[0];if(event.sequence!==cursor+1)fail('EVENT_SEQUENCE_REFUSED');cursor=event.sequence;output.enqueue(event);if(terminal(page.run.state)&&cursor===page.lastSequence){close();output.close();}return;}
    if(terminal(page.run.state)){close();output.close();return;}await delay(Math.min(pollMs,Math.max(1,deadline-now())),undefined,{signal:controller.signal});
   }}catch(error){close();output.error(Error('SUBSCRIPTION_UNAVAILABLE'));}},cancel(){close();}});
}
