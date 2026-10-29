/** Private trusted-viewer input. Page objects come from the owned context, never
 * from a wire selector or model tool. This is not a viewer authentication layer. */
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {admitInputBatch,NAMED_KEYS} from './input.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_INPUT_REFUSED'),{code:'BROWSER_INPUT_REFUSED'});};
export function prepareNativeBrowserInput(context,page,raw,{leaseEpoch,limiter}){
 if(!context.pages().includes(page)||page.isClosed())fail();
 const action=data(raw);let events;
 if(action?.kind==='text'){
  own(action,['kind','text']);events=[{type:'text',text:action.text}];
 }else if(action?.kind==='key'){
  own(action,['kind','key']);if(typeof action.key!=='string')fail();
  const shift=action.key.startsWith('Shift+'),key=shift?action.key.slice(6):action.key;
  // Printable input must use text so it enters the session confidentiality
  // filter before a page input handler can remove and reflect its field.
  if(!NAMED_KEYS.includes(key))fail();
  events=['down','up'].map(action=>({type:'key',action,key,shift}));
 }else if(action?.kind==='click'){
  own(action,['kind','x','y']);events=['down','up'].map(kind=>({type:'mouse',action:kind,x:action.x,y:action.y,button:'left'}));
 }else if(action?.kind==='wheel'){
  own(action,['kind','x','y','deltaX','deltaY']);const {kind,...event}=action;events=[{type:'wheel',...event}];
 }else fail();
 // The session's existing input owner is the only source of key/text/viewport
 // bounds and rate admission. Press/click are atomic native conveniences, so
 // charge both their down and up events before any effect is dispatched.
 admitInputBatch({leaseEpoch,events},{viewport:page.viewportSize(),limiter});
 const frame=page.mainFrame(),url=page.url();let navigated=false,disposed=false,consumed=false;
 const changed=selected=>{if(selected===frame)navigated=true;};
 page.on('framenavigated',changed);
 return Object.freeze({text:action.kind==='text'?action.text:null,async perform({assertLease=()=>{}}={}){
  if(consumed)fail();consumed=true;
  const check=()=>{assertLease();if(disposed||navigated||!context.pages().includes(page)||page.isClosed()||page.mainFrame()!==frame||page.url()!==url)fail();};check();
  if(action.kind==='text')await page.keyboard.insertText(action.text);
  else if(action.kind==='key')await page.keyboard.press(action.key);
  else if(action.kind==='click')await page.mouse.click(action.x,action.y);
  else{await page.mouse.move(action.x,action.y);check();await page.mouse.wheel(action.deltaX,action.deltaY);}
 },dispose(){disposed=true;page.off('framenavigated',changed);}});
}
