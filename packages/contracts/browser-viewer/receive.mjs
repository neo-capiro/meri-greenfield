import {parseBytes} from '../document-application/boundary.mjs';

export const BROWSER_VIEWER_SCHEMA='meri.browser-viewer/1';
export const BROWSER_VIEWER_ROUTES=Object.freeze(['read','ticket','connect','frame','input','release']);
export const BROWSER_VIEWER_LIMITS=Object.freeze({requestBytes:32768,responseBytes:12*1024*1024,pngBytes:8*1024*1024,ticketMs:60000,maxPages:32});
export const BROWSER_VIEWER_ERRORS=Object.freeze({INVALID_REQUEST:400,UNAUTHENTICATED:401,ACCESS_DENIED:403,NOT_FOUND:404,
 METHOD_NOT_ALLOWED:405,CONFLICT:409,EXPIRED:410,TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415,UNAVAILABLE:503,REFUSED:502});
const requests=new WeakMap(),frames=new WeakMap();
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const opaque=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(v);
const integer=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const fail=()=>{throw Error('INVALID_BROWSER_VIEWER_MESSAGE');};
function closed(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();}
function context(v){
 closed(v,['tenantId','actorId','conversationId','runId','selectedClientId']);
 if(!['tenantId','actorId','conversationId','runId'].every(k=>uuid(v[k]))||v.selectedClientId!==null&&!uuid(v.selectedClientId))fail();
}
export function sameBrowserViewerContext(a,b){return ['tenantId','actorId','conversationId','runId','selectedClientId'].every(k=>a[k]===b[k]);}
const namedKeys=['Enter','Tab','Backspace','Delete','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Shift','Space'];
function event(v){
 if(!v||typeof v!=='object')fail();
 if(v.type==='mouse'){
  closed(v,v.action==='move'?['type','action','x','y']:['type','action','x','y','button']);
  if(!['move','down','up'].includes(v.action)||v.action!=='move'&&!['left','middle','right'].includes(v.button))fail();
 }else if(v.type==='wheel'){
  closed(v,['type','x','y','deltaX','deltaY']);
  if(![v.deltaX,v.deltaY].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000))fail();
 }else if(v.type==='key'){
  closed(v,['type','action','key','shift']);
  if(!['down','up'].includes(v.action)||typeof v.shift!=='boolean'||typeof v.key!=='string'||
   !namedKeys.includes(v.key)&&!/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]$/u.test(v.key))fail();
 }else if(v.type==='text'){
  closed(v,['type','text']);if(typeof v.text!=='string'||![...v.text].length||[...v.text].length>256||!/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]*$/u.test(v.text))fail();
 }else fail();
 if(['mouse','wheel'].includes(v.type)&&![v.x,v.y].every(n=>Number.isFinite(n)&&n>=0&&n<4096))fail();
}
export function receiveBrowserViewerRequest(route,bytes){
 if(!BROWSER_VIEWER_ROUTES.includes(route))fail();
 const q=parseBytes(bytes,BROWSER_VIEWER_LIMITS.requestBytes),keys=['schema'];
 if(route!=='read')keys.push('requestId');
 if(route==='connect')keys.push('ticket');
 else if(!['read','ticket'].includes(route))keys.push('ownerId');
 if(['frame','input','release'].includes(route))keys.push('viewerId','leaseEpoch');
 if(['frame','input'].includes(route))keys.push('pageId');
 if(route==='input')keys.push('frameId','events');
 closed(q,keys);
 if(q.schema!==BROWSER_VIEWER_SCHEMA||route!=='read'&&!uuid(q.requestId)||q.ownerId!==undefined&&!uuid(q.ownerId)||
  q.ticket!==undefined&&!opaque(q.ticket)||q.viewerId!==undefined&&!uuid(q.viewerId)||q.pageId!==undefined&&!uuid(q.pageId)||
  q.leaseEpoch!==undefined&&!integer(q.leaseEpoch)||q.frameId!==undefined&&!opaque(q.frameId))fail();
 if(route==='input'){if(!Array.isArray(q.events)||!q.events.length||q.events.length>64)fail();q.events.forEach(event);}
 requests.set(q,route);return q;
}
function lease(v){
 if(v===null)return;
 closed(v,['viewerId','leaseEpoch','expiresAtMs','connectRequestId']);
 if(!uuid(v.viewerId)||!integer(v.leaseEpoch)||!integer(v.expiresAtMs)||!uuid(v.connectRequestId))fail();
}
function page(v){
 closed(v,['pageId','origin']);
 let origin;try{origin=new URL(v.origin);}catch{fail();}
 if(!uuid(v.pageId)||typeof v.origin!=='string'||origin.origin!==v.origin||!['https:','http:'].includes(origin.protocol))fail();
}
function frame(v,q){
 closed(v,['frameId','pageId','width','height','image']);closed(v.image,['mimeType','data']);
 if(!opaque(v.frameId)||v.pageId!==q.pageId||!integer(v.width,1,4096)||!integer(v.height,1,4096)||v.image.mimeType!=='image/png'||
  typeof v.image.data!=='string'||v.image.data.length>Math.ceil(BROWSER_VIEWER_LIMITS.pngBytes/3)*4||
  v.image.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/u.test(v.image.data))fail();
 let raw;try{raw=atob(v.image.data);}catch{fail();}
 if(raw.length<33||raw.length>BROWSER_VIEWER_LIMITS.pngBytes||btoa(raw)!==v.image.data)fail();
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),header=[137,80,78,71,13,10,26,10];
 const data=new DataView(bytes.buffer);
 if(!header.every((n,i)=>bytes[i]===n)||raw.slice(12,16)!=='IHDR'||data.getUint32(16)!==v.width||data.getUint32(20)!==v.height)fail();
 frames.set(v,bytes);
}
export function receiveBrowserViewerResponse(route,status,bytes,q,expected){
 if(requests.get(q)!==route)fail();context(expected);
 const r=parseBytes(bytes,BROWSER_VIEWER_LIMITS.responseBytes);
 if(status!==200){
  closed(r,['schema','error']);closed(r.error,['code','outcome']);
  if(r.schema!==BROWSER_VIEWER_SCHEMA||typeof r.error.code!=='string'||!Object.hasOwn(BROWSER_VIEWER_ERRORS,r.error.code)||
   BROWSER_VIEWER_ERRORS[r.error.code]!==status||!['NOT_DISPATCHED','UNKNOWN','READ_UNAVAILABLE'].includes(r.error.outcome))fail();return r;
 }
 const base=['schema','context','ownerId'];
 if(route==='read'){
  closed(r,[...base,'state','lease','pages']);context(r.context);lease(r.lease);
  if(!['unavailable','agent','taking','user','returning','ended'].includes(r.state)||r.ownerId!==null&&!uuid(r.ownerId)||
   !Array.isArray(r.pages)||r.pages.length>BROWSER_VIEWER_LIMITS.maxPages||new Set(r.pages.map(p=>p.pageId)).size!==r.pages.length)fail();
  r.pages.forEach(page);
  if((r.state==='user')!==(r.lease!==null)||r.ownerId===null&&(['user','returning'].includes(r.state)||r.pages.length)||r.state!=='user'&&r.pages.length)fail();
 }else if(route==='ticket'){
  closed(r,[...base,'requestId','ticket','expiresAtMs']);context(r.context);
  if(!uuid(r.ownerId)||!opaque(r.ticket)||!integer(r.expiresAtMs))fail();
 }else if(route==='connect'){
  closed(r,[...base,'requestId','state','lease']);context(r.context);lease(r.lease);
  if(!uuid(r.ownerId)||r.state!=='user'||!r.lease||r.lease.connectRequestId!==q.requestId)fail();
 }else{
  closed(r,[...base,'requestId','viewerId','leaseEpoch',route==='frame'?'frame':route==='input'?'accepted':'state']);context(r.context);
  if(r.viewerId!==q.viewerId||r.leaseEpoch!==q.leaseEpoch)fail();
  if(route==='frame')frame(r.frame,q);
  if(route==='input'&&r.accepted!==true||route==='release'&&r.state!=='returning')fail();
 }
 if(r.schema!==BROWSER_VIEWER_SCHEMA||!sameBrowserViewerContext(r.context,expected)||route!=='read'&&r.requestId!==q.requestId||
  q.ownerId!==undefined&&r.ownerId!==q.ownerId)fail();
 return r;
}
export function browserViewerPng(value){const bytes=frames.get(value);if(!bytes)fail();return bytes.slice();}
