/** Private trusted-viewer input over the one wire batch `{leaseEpoch,events}` the frontend and the viewer relay
 * send. Page objects come from the owned context, never from a wire selector or model tool. This is not a viewer
 * authentication layer: the lease epoch itself is fenced by the session owner (`fence.mjs`). */
import {data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {admitInputBatch,NAMED_KEYS} from './input.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_INPUT_REFUSED'),{code:'BROWSER_INPUT_REFUSED'});};
export function prepareNativeBrowserInput(context,page,raw,{leaseEpoch,limiter}){
 if(!context.pages().includes(page)||page.isClosed())fail();
 // The session's existing input owner is the only source of key/text/viewport bounds and rate admission. The whole
 // batch is charged before any effect is dispatched; a refused batch injects nothing.
 const batch=admitInputBatch(data(raw),{viewport:page.viewportSize(),limiter});
 if(batch.leaseEpoch!==leaseEpoch)fail();
 // Printable input must travel as text so it enters the session confidentiality filter before a page handler can
 // remove and reflect its field. Shift is itself a named key the viewer sends as its own down/up events.
 if(batch.events.some(event=>event.type==='key'&&!NAMED_KEYS.includes(event.key)))fail();
 const text=batch.events.filter(event=>event.type==='text').map(event=>event.text).join('');
 const frame=page.mainFrame(),url=page.url();let navigated=false,disposed=false,consumed=false;
 const changed=selected=>{if(selected===frame)navigated=true;};
 page.on('framenavigated',changed);
 return Object.freeze({text:text===''?null:text,events:batch.events,async perform({assertLease=()=>{}}={}){
  if(consumed)fail();consumed=true;
  const check=()=>{assertLease();if(disposed||navigated||!context.pages().includes(page)||page.isClosed()||page.mainFrame()!==frame||page.url()!==url)fail();};
  for(const event of batch.events){
   check();
   if(event.type==='text')await page.keyboard.insertText(event.text);
   else if(event.type==='key')await (event.action==='down'?page.keyboard.down(event.key):page.keyboard.up(event.key));
   else if(event.type==='mouse'){
    await page.mouse.move(event.x,event.y);
    if(event.action!=='move'){check();await (event.action==='down'?page.mouse.down({button:event.button}):page.mouse.up({button:event.button}));}
   }else{await page.mouse.move(event.x,event.y);check();await page.mouse.wheel(event.deltaX,event.deltaY);}
  }
 },dispose(){disposed=true;page.off('framenavigated',changed);}});
}
