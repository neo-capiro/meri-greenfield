/** Private trusted-viewer input. Page objects come from the owned context, never
 * from a wire selector or model tool. This is not a viewer authentication layer. */
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_INPUT_REFUSED'),{code:'BROWSER_INPUT_REFUSED'});};
const keys=new Set(['Tab','Shift+Tab','Enter','Escape','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
export function prepareNativeBrowserInput(context,page,raw){
 if(!context.pages().includes(page)||page.isClosed())fail();
 const action=data(raw);
 if(action?.kind==='text'){
  own(action,['kind','text']);
  if(typeof action.text!=='string'||!action.text||!action.text.isWellFormed()||action.text.includes('\0')||Buffer.byteLength(action.text)>65536)fail();
 }else if(action?.kind==='key'){
  own(action,['kind','key']);if(!keys.has(action.key))fail();
 }else if(action?.kind==='click'){
  own(action,['kind','x','y']);const size=page.viewportSize();
  if(!size||!Number.isFinite(action.x)||!Number.isFinite(action.y)||action.x<0||action.y<0||action.x>=size.width||action.y>=size.height)fail();
 }else fail();
 const frame=page.mainFrame(),url=page.url();
 return Object.freeze({text:action.kind==='text'?action.text:null,async perform(){
  if(!context.pages().includes(page)||page.isClosed()||page.mainFrame()!==frame||page.url()!==url)fail();
  if(action.kind==='text')await page.keyboard.insertText(action.text);
  else if(action.kind==='key')await page.keyboard.press(action.key);
  else await page.mouse.click(action.x,action.y);
 }});
}
