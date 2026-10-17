/** WOPI lock semantics for Office editor edit sessions (design section 4.2 "Locks"; WOPI Lock, GetLock, RefreshLock,
 * Unlock, UnlockAndRelock and PutFile). Owner answers Q-O1 and Q-O2 accepted 15 October 2026: full editing through WOPI,
 * with Collabora as the evaluation candidate and ONLYOFFICE as the fallback, both behind the same WOPI host, so this
 * module does not depend on the vendor choice.
 *
 * PREPARATION ONLY: a pure in-memory lock table on an injected clock (the durable edit-session store is a migration dot
 * allocates, Q-O9). WOPI lock tokens are not the artifact head lock. Locks expire after 30 minutes unless refreshed; an
 * expired lock reads as unlocked. A mismatch answers 409 with the current lock (empty string when unlocked), as WOPI
 * requires; PutFile requires the matching lock (the design's single-writer rule). */
export const WOPI_LOCK_TTL_MS=30*60*1000;
export const WOPI_LOCK_MAX_LENGTH=1024;
const FILE=/^[A-Za-z0-9_-]{1,128}$/u,LOCK=/^[\x21-\x7e]{1,1024}$/u;
const fault=code=>Object.assign(new Error(code),{code});
const ok=lock=>Object.freeze({status:200,...(lock===undefined?{}:{lock})});
const conflict=current=>Object.freeze({status:409,lock:current});

export function createWopiLockTable({now}){
 if(typeof now!=='function')throw fault('WOPI_CONFIGURATION');
 const locks=new Map();
 const current=fileId=>{
  if(typeof fileId!=='string'||!FILE.test(fileId))throw fault('WOPI_INVALID_FILE');
  const l=locks.get(fileId);if(l&&now()>=l.expiresAtMs){locks.delete(fileId);return null;}return l??null;
 };
 const token=value=>{if(typeof value!=='string'||!LOCK.test(value))throw fault('WOPI_INVALID_LOCK');return value;};
 const set=(fileId,lock)=>locks.set(fileId,{lock,expiresAtMs:now()+WOPI_LOCK_TTL_MS});
 return Object.freeze({
  lock(fileId,value){const l=current(fileId),t=token(value);if(l&&l.lock!==t)return conflict(l.lock);set(fileId,t);return ok();},
  getLock(fileId){const l=current(fileId);return ok(l?l.lock:'');},
  refreshLock(fileId,value){const l=current(fileId),t=token(value);if(!l||l.lock!==t)return conflict(l?l.lock:'');set(fileId,t);return ok();},
  unlock(fileId,value){const l=current(fileId),t=token(value);if(!l||l.lock!==t)return conflict(l?l.lock:'');locks.delete(fileId);return ok();},
  unlockAndRelock(fileId,oldValue,value){const l=current(fileId),o=token(oldValue),t=token(value);if(!l||l.lock!==o)return conflict(l?l.lock:'');set(fileId,t);return ok();},
  /** PutFile admission only: the bytes themselves go to the draft store (edit-session.mjs). */
  putFile(fileId,value){const l=current(fileId);if(typeof value!=='string'||!LOCK.test(value)||!l||l.lock!==value)return conflict(l?l.lock:'');return ok();},
 });
}
