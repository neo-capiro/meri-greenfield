/** Private viewer adapter for the existing browser owner. Canonical lifecycle
 * custody is resolved before every call by the authenticated control service;
 * this adapter owns only short-lived connection tickets and native page handles.
 * It never creates a hold, resumes the SDK, or handles model messages. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {BROWSER_VIEWER_SCHEMA as schema,BROWSER_VIEWER_LIMITS,receiveBrowserViewerRequest,
 receiveBrowserViewerResponse} from '../../../../packages/contracts/browser-viewer/receive.mjs';
const fault=code=>Object.assign(Error(code),{code});
const fail=code=>{throw fault(code);};
const encode=v=>new TextEncoder().encode(JSON.stringify(v));
const hash=s=>createHash('sha256').update(s).digest('hex');
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export const VIEWER_DISCONNECT_MS=30000;

export function createBrowserViewerRelay({ownerInstanceId,binding,expiresAtMs,now=Date.now}={}){
 if(typeof ownerInstanceId!=='string'||!binding||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now())fail('BROWSER_VIEWER_CONFIGURATION');
 const source=structuredClone(binding),lifetime=new AbortController();
 let native=null,closed=false,connection=null,ticket=null,displayed=null,busy=false,timer;
 const pages=new Map();
 function forget(){connection=null;ticket=null;displayed=null;pages.clear();clearTimeout(timer);}
 function disconnect(){forget();try{native?.controls.endLease('viewer-disconnect');}catch{closed=true;lifetime.abort();}}
 function touch(){clearTimeout(timer);timer=setTimeout(disconnect,Math.min(VIEWER_DISCONNECT_MS,expiresAtMs-now()));timer.unref?.();}
 function authority(grant,signal){
  signal?.throwIfAborted();lifetime.signal.throwIfAborted();
  if(closed||!native||now()>=expiresAtMs||!grant||grant.expiresAtMs<=now()||
    typeof grant.sessionKey!=='string'||!/^[a-f0-9]{64}$/u.test(grant.sessionKey)||!grant.context||
    !['tenantId','actorId','conversationId','runId'].every(k=>grant.context[k]===source[k])||
    grant.custody?.ownerInstanceId!==ownerInstanceId||!same(grant.custody.binding,source)||
    grant.custody.expiresAtMs<=now())fail('BROWSER_VIEWER_AUTHORITY_REFUSED');
 }
 async function state(grant,signal){
  authority(grant,signal);const state=await native.controls.readState({signal});authority(grant,signal);
  if(connection&&(state.state!=='user'||state.leaseEpoch!==connection.leaseEpoch||
    connection.expiresAtMs<=now()))forget();
  return state;
 }
 function ownConnection(grant,q,s){
  if(!connection||connection.sessionKey!==grant.sessionKey||q.ownerId!==ownerInstanceId||
    q.viewerId!==connection.viewerId||q.leaseEpoch!==connection.leaseEpoch||s.state!=='user'||
    s.leaseEpoch!==q.leaseEpoch||s.leaseExpiresAtMs<=now())fail('BROWSER_VIEWER_STALE_LEASE');
 }
 function listPages(){
  const live=native.pages();
  for(const [id,page] of pages)if(!live.includes(page)||page.isClosed())pages.delete(id);
  const result=[];
  for(const page of live){
   if(page.isClosed())continue;
   let origin;try{const url=new URL(page.url());if(!['https:','http:'].includes(url.protocol))continue;origin=url.origin;}catch{continue;}
   let id=[...pages].find(([,value])=>value===page)?.[0];
   if(!id){id=randomUUID();pages.set(id,page);}
   result.push({pageId:id,origin});if(result.length>=BROWSER_VIEWER_LIMITS.maxPages)break;
  }
  const visible=new Set(result.map(p=>p.pageId));
  for(const id of pages.keys())if(!visible.has(id))pages.delete(id);
  return result;
 }
 const publicLease=()=>connection&&({viewerId:connection.viewerId,leaseEpoch:connection.leaseEpoch,
  expiresAtMs:connection.expiresAtMs,connectRequestId:connection.connectRequestId});
 async function execute({route,request,grant,signal}={}){
  // The private transport receives bytes too; admit again at the native owner.
  const q=receiveBrowserViewerRequest(route,encode(request));
  authority(grant,signal);if(busy)fail('BROWSER_VIEWER_BUSY');busy=true;
  try{
   const s=await state(grant,signal),base={schema,context:grant.context,ownerId:ownerInstanceId};
   let answer;
   if(route==='read'){
    const owned=connection?.sessionKey===grant.sessionKey;
    if(connection&&!owned)fail('BROWSER_VIEWER_BUSY');
    const mode=s.state==='user'?(owned?'user':'taking'):s.state==='agent'?'agent':s.state==='returning'?'returning':s.state==='ended'?'ended':'taking';
    if(owned)touch();
    answer={...base,state:mode,lease:mode==='user'?publicLease():null,pages:mode==='user'?listPages():[]};
   }else if(route==='ticket'){
    if(s.state!=='user'||s.leaseEpoch!==grant.custody.leaseEpoch||s.leaseExpiresAtMs<=now())fail('BROWSER_VIEWER_NOT_HELD');
    if(connection&&connection.sessionKey!==grant.sessionKey)fail('BROWSER_VIEWER_BUSY');
    const token=randomBytes(32).toString('base64url'),until=Math.min(now()+BROWSER_VIEWER_LIMITS.ticketMs,
     grant.expiresAtMs,expiresAtMs,grant.custody.expiresAtMs,s.leaseExpiresAtMs);
    ticket={digest:hash(token),sessionKey:grant.sessionKey,leaseEpoch:s.leaseEpoch,expiresAtMs:until};
    if(!connection){clearTimeout(timer);timer=setTimeout(disconnect,Math.max(1,until-now()));timer.unref?.();}
    answer={...base,requestId:q.requestId,ticket:token,expiresAtMs:until};
   }else if(route==='connect'){
    if(!ticket||ticket.digest!==hash(q.ticket)||ticket.sessionKey!==grant.sessionKey||ticket.expiresAtMs<=now()||
      s.state!=='user'||s.leaseEpoch!==ticket.leaseEpoch)fail('BROWSER_VIEWER_TICKET_REFUSED');
    ticket=null;
    connection={viewerId:randomUUID(),leaseEpoch:s.leaseEpoch,connectRequestId:q.requestId,sessionKey:grant.sessionKey,
     expiresAtMs:Math.min(expiresAtMs,grant.expiresAtMs,grant.custody.expiresAtMs,s.leaseExpiresAtMs)};
    pages.clear();displayed=null;touch();answer={...base,requestId:q.requestId,state:'user',lease:publicLease()};
   }else{
    ownConnection(grant,q,s);
    const reply={...base,requestId:q.requestId,viewerId:q.viewerId,leaseEpoch:q.leaseEpoch};
    if(route==='release'){
     await native.controls.handBack();forget();answer={...reply,state:'returning'};
    }else{
     listPages();const page=pages.get(q.pageId);
     if(!page)fail('BROWSER_VIEWER_PAGE_REFUSED');
     if(route==='frame'){
      const frame=await native.controls.view({leaseEpoch:q.leaseEpoch,page,signal});
      displayed={pageId:q.pageId,frameId:frame.frameId};
      answer={...reply,frame:{frameId:frame.frameId,pageId:q.pageId,width:frame.width,height:frame.height,image:frame.image}};
     }else{
      if(displayed?.pageId!==q.pageId||displayed?.frameId!==q.frameId)fail('BROWSER_VIEWER_FRAME_REFUSED');
      displayed=null;
      await native.controls.userInput({leaseEpoch:q.leaseEpoch,page,frameId:q.frameId,input:{leaseEpoch:q.leaseEpoch,events:q.events},signal});
      answer={...reply,accepted:true};
     }
     authority(grant,signal);const after=await state(grant,signal);ownConnection(grant,q,after);touch();
    }
   }
   authority(grant,signal);
   return receiveBrowserViewerResponse(route,200,encode(answer),q,grant.context);
  }catch(error){
   // Unknown input cannot be replayed. The native session's own execution owner
   // destroys on ambiguous device effects; close the viewer admission as well.
   if(route==='input')disconnect();
   throw error;
  }finally{busy=false;}
 }
 async function close(){if(closed)return {closed:true};closed=true;lifetime.abort();disconnect();native=null;return {closed:true};}
 return Object.freeze({ownerInstanceId,execute,close,
  async readAdmission({binding:requested,signal}={}){
   if(closed||!native||!same(requested,source)||now()>=expiresAtMs)fail('BROWSER_VIEWER_AUTHORITY_REFUSED');
   signal?.throwIfAborted();const value=await native.controls.readState({signal});signal?.throwIfAborted();
   if(closed||now()>=expiresAtMs)fail('BROWSER_VIEWER_AUTHORITY_REFUSED');
   return Object.freeze({binding:source,admitted:value.state==='agent',expiresAtMs});
  },
  async bind({binding:requested,pages:readPages,controls}={}){
   if(closed||native||!same(requested,source)||typeof readPages!=='function'||
     !['readState','view','userInput','handBack','endLease'].every(name=>typeof controls?.[name]==='function'))fail('BROWSER_VIEWER_CONFIGURATION');
   native={pages:readPages,controls};return Object.freeze({close});
  },
 });
}
