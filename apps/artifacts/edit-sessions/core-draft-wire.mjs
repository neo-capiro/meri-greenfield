/** Receiving boundary for Core's control-only office-drafts routes (Core PR226).
 * Core owns locks, sequences and state transitions. These checks correlate its
 * answer with the exact call; they do not reproduce its state machine. */
import {createHash} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const OFFICE_DRAFT_MAX_BYTES=20*1024*1024;
export const OFFICE_DRAFT_JSON_BYTES=28000000;
export const OFFICE_DRAFT_ROUTES=Object.freeze({open:'open',read:'read',lock:'lock',save:'save',discard:'discard',beginPublish:'publish/begin',settlePublish:'publish/settle'});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
const uuid=value=>typeof value==='string'&&UUID.test(value),sha=value=>typeof value==='string'&&SHA.test(value);
const fail=()=>{throw Object.assign(Error('OFFICE_DRAFT_WIRE'),{code:'OFFICE_DRAFT_WIRE'});};
const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,1024}$/u.test(value);
const sequence=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceKeys=['artifactId','baseVersionId','baseSha256','format','filename'];
const receiptKeys=['draftId','conversationId',...sourceKeys,'sequence','sha256','byteLength','state','publishIntent','publishedVersionId','savedAt','expiresAt'];
const states=['draft','publish-pending','publish-unknown','publish-refused','conflict','published'];
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function source(b){
 if(!uuid(b.artifactId)||!uuid(b.baseVersionId)||!sha(b.baseSha256)||!['docx','xlsx','pptx'].includes(b.format)||
  typeof b.filename!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,190}$/u.test(b.filename)||!b.filename.endsWith('.'+b.format))fail();
}
function savedBytes(base64,sha256){
 if(typeof base64!=='string'||!base64||base64.length>4*Math.ceil(OFFICE_DRAFT_MAX_BYTES/3)||!sha(sha256))fail();
 const bytes=Buffer.from(base64,'base64');if(!bytes.length||bytes.length>OFFICE_DRAFT_MAX_BYTES||bytes.toString('base64')!==base64||digest(bytes)!==sha256)fail();return bytes.length;
}
export function officeDraftRequest(route,value){
 try{
  if(typeof route!=='string'||!Object.hasOwn(OFFICE_DRAFT_ROUTES,route))fail();
  const key=['conversationId','draftId'];let extra=[];
  if(route==='open')extra=sourceKeys;
  if(route==='save')extra=['lock','expectedSequence','sha256','bytesBase64','kind'];
  if(route==='beginPublish')extra=['sequence','sha256'];
  if(route==='settlePublish')extra=['sequence','sha256','intent','outcome','versionId'];
  if(route==='lock'){
   const b=own(value,[...key,'operation'],['lock','oldLock']);
   if(!['get','lock','refresh','unlock','relock'].includes(b.operation))fail();
   extra=['operation',...(b.operation==='get'?[]:['lock']),...(b.operation==='relock'?['oldLock']:[])];
  }
  const b=own(value,[...key,...extra]);if(!uuid(b.conversationId)||!uuid(b.draftId))fail();
  if(route==='open')source(b);
  if(route==='lock'&&(b.lock!==undefined&&!token(b.lock)||b.oldLock!==undefined&&!token(b.oldLock)))fail();
  if(route==='save'){
   if(!token(b.lock)||!sequence(b.expectedSequence)||!['autosave','explicit','exit'].includes(b.kind))fail();savedBytes(b.bytesBase64,b.sha256);
  }
  if(['beginPublish','settlePublish'].includes(route)&&(!sequence(b.sequence)||b.sequence<1||!sha(b.sha256)))fail();
  if(route==='settlePublish'&&(!['published','refused','conflict','unknown'].includes(b.outcome)||b.intent!==`office:${b.draftId}:${b.sequence}`||
   (b.outcome==='published'?!uuid(b.versionId):b.versionId!==null)))fail();
  return Object.freeze(b);
 }catch{fail();}
}
function receipt(value,request){
 const r=own(value,receiptKeys);source(r);
 if(r.draftId!==request.draftId||r.conversationId!==request.conversationId||!sequence(r.sequence)||!states.includes(r.state)||
  !Number.isInteger(r.byteLength)||r.byteLength<0||r.byteLength>OFFICE_DRAFT_MAX_BYTES||!instant(r.savedAt)||!instant(r.expiresAt)||r.expiresAt<=r.savedAt)fail();
 if(r.sequence===0?r.sha256!==null||r.byteLength!==0:r.byteLength<1||!sha(r.sha256))fail();
 if(r.state==='draft'?r.publishIntent!==null:r.sequence<1||r.publishIntent!==`office:${r.draftId}:${r.sequence}`)fail();
 if(r.state==='published'?!uuid(r.publishedVersionId):r.publishedVersionId!==null)fail();
 return Object.freeze(r);
}
export function officeDraftResponse(route,value,request){
 try{
  if(typeof route!=='string'||!Object.hasOwn(OFFICE_DRAFT_ROUTES,route))fail();
  if(route==='discard'){const r=own(value,['discarded']);if(r.discarded!==true)fail();return Object.freeze(r);}
  if(route==='lock'){
   const r=own(value,['status'],['lock']);
   if(![200,409].includes(r.status)||r.lock!==undefined&&r.lock!==''&&!token(r.lock))fail();
   if(request.operation==='get'||r.status===409){if(typeof r.lock!=='string'||request.operation==='get'&&r.status!==200)fail();}
   else if(Object.hasOwn(r,'lock'))fail();
   return Object.freeze(r);
  }
  if(route==='save'){
   const r=own(value,['status'],['lock','receipt']);
   if(r.status===409){if(Object.hasOwn(r,'receipt')||typeof r.lock!=='string'||r.lock!==''&&!token(r.lock))fail();return Object.freeze(r);}
   if(r.status!==200||Object.hasOwn(r,'lock'))fail();const kept=receipt(r.receipt,request);
   if(kept.sha256!==request.sha256||kept.byteLength!==savedBytes(request.bytesBase64,request.sha256)||
    ![request.expectedSequence,request.expectedSequence+1].includes(kept.sequence)||!['draft','publish-refused'].includes(kept.state))fail();
   return Object.freeze({status:200,receipt:kept});
  }
  if(route==='beginPublish'){
   const r=own(value,['receipt','dispatch']),kept=receipt(r.receipt,request);
   if(typeof r.dispatch!=='boolean'||!['publish-pending','publish-unknown','published'].includes(kept.state)||r.dispatch&&kept.state!=='publish-pending'||kept.sequence!==request.sequence||kept.sha256!==request.sha256)fail();
   return Object.freeze({receipt:kept,dispatch:r.dispatch});
  }
  if(route==='read'){
   const r=own(value,[...receiptKeys,'bytesBase64']),{bytesBase64,...metadata}=r,kept=receipt(metadata,request);
   if(kept.byteLength===0?bytesBase64!==null:savedBytes(bytesBase64,kept.sha256)!==kept.byteLength)fail();return Object.freeze({...kept,bytesBase64});
  }
  const kept=receipt(value,request);
  if(route==='open'&&sourceKeys.some(k=>kept[k]!==request[k]))fail();
  if(route==='settlePublish'&&(kept.sequence!==request.sequence||kept.sha256!==request.sha256||kept.publishIntent!==request.intent||kept.publishedVersionId!==request.versionId||
   kept.state!==({published:'published',refused:'publish-refused',conflict:'conflict',unknown:'publish-unknown'})[request.outcome]))fail();
  return kept;
 }catch{fail();}
}
