/** SYNTHETIC: pending lifecycle control can complete after its HTTP lifetime; no native or model effects. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationLifecycleApplication} from '../lifecycle/http.mjs';
for(const mode of ['deadline','cancel'])test(`invoked lifecycle control preserves UNKNOWN across ${mode}`,{timeout:2000},async()=>{
 const entered=Promise.withResolvers(),release=Promise.withResolvers(),settled=Promise.withResolvers(),controller=new AbortController();let effects=0;
 const service={submit(){},history(){},cancel(){},async control(){entered.resolve();await release.promise;effects++;settled.resolve();return {};}};
 const app=createConversationLifecycleApplication({service,maxRequestMs:100});
 const pending=app.handle(new Request('https://meri.invalid/api/conversations/control',{method:'POST',signal:controller.signal,
  headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));
 try{await entered.promise;if(mode==='cancel')controller.abort();const response=await pending;assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:{code:'LIFECYCLE_EFFECT_UNKNOWN',outcome:'UNKNOWN'}});assert.equal(effects,0);
 }finally{release.resolve();await settled.promise;}
 assert.equal(effects,1,'HTTP cancellation never proves non-dispatch or physical stop');
});
