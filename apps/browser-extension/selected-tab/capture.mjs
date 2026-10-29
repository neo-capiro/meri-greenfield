/** Serialized by chrome.scripting into its isolated world, top frame only.
 * No page functions, attributes containing values, forms, frames or storage. */
export function captureRenderedText(){
 const started=performance.now(),out=[];let visited=0,characters=0;
 const deny='script,style,noscript,template,iframe,frame,object,embed,form,input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"]';
 const walk=node=>{
  if(++visited>20000||performance.now()-started>1000)throw Error('PAGE_LIMIT');
  if(node.nodeType===Node.ELEMENT_NODE){
   if(node.matches(deny))return;
   const style=getComputedStyle(node);
   if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0')return;
   for(const child of node.childNodes)walk(child);
  }else if(node.nodeType===Node.TEXT_NODE){
   if(!node.parentElement?.getClientRects().length)return;
   const raw=node.textContent;if(raw.length>131072)throw Error('PAGE_LIMIT');
   const text=raw.replace(/\s+/gu,' ').trim();if(!text)return;
   characters+=text.length;if(characters>131072)throw Error('PAGE_LIMIT');out.push(text);
  }
 };
 const address=new URL(location.href);
 if(!document.body||!['http:','https:'].includes(address.protocol)||address.username||address.password)throw Error('PAGE_UNAVAILABLE');
 walk(document.body);const text=out.join('\n');
 if(!text||new TextEncoder().encode(text).byteLength>262144)throw Error('PAGE_LIMIT');
 address.search='';address.hash='';
 const title=(document.title||address.hostname).replace(/[\u0000-\u001f\u007f]/gu,' ').trim().slice(0,256);
 return {text,title:title||address.hostname,url:address.href};
}
