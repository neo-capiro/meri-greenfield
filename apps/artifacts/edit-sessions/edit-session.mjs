/** Office editor edit-session decisions (design section 4.2 and 4.4; owner answers accepted 15 October 2026: Q-O1 full
 * editing where only explicit saves publish new immutable versions, Q-O4 PDF preview-only, Q-O5 one editor per session,
 * Q-O6 on conflict keep the draft and offer branch / reopen-on-latest / discard and never overwrite, Q-O7 no extra
 * review, Q-O8 and Q-X3 desktop only, Q-O9 drafts are a private data class).
 *
 * PREPARATION ONLY: pure decisions the WOPI host and publish pipeline will call. No bytes, storage, editor process or
 * artifact write happens here. Nothing is composed: the editor activation is held (`activation.mjs`). Branch publishing
 * needs artifact lineage with a non-head parent, a contract change proposed to dot (Q-O10); until dot accepts it the
 * branch option is not offered. */
export const EDITOR_FORMATS=Object.freeze(['docx','xlsx','pptx']);
export const PREVIEW_ONLY_FORMATS=Object.freeze(['pdf']);
export const SAVE_KINDS=Object.freeze(['autosave','exit','explicit']);
export const DRAFT_STATES=Object.freeze(['draft','publish-pending','published','publish-refused','conflict','publish-unknown']);
/** Refusals the revise owner raises before any effect: the draft stays, marked publish-refused. */
export const DEFINITE_PUBLISH_REFUSALS=Object.freeze(['EDITOR_STRUCTURE_REFUSED','EDITOR_NATIVE_CHECK_REFUSED','ARTIFACT_FORMAT','ARTIFACT_REVISION_FORMAT','ARTIFACT_INSPECTION_MISMATCH','ARTIFACT_INPUT_LIMIT','ARTIFACT_OUTPUT_LIMIT','ARTIFACT_AUTHORITY']);
export const CONFLICT_CODE='ARTIFACT_STALE_PARENT';
const SHA=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fault=code=>Object.assign(new Error(code),{code});

/** Whether a user may open an editor on an exact version, and in which mode. Edit mode needs current inspect AND revise
 * authority; inspect alone opens read-only (WOPI UserCanWrite false). */
export function admitEditSession({format,suppressed,authority,desktop,activeEditor}){
 if(suppressed!==false)throw fault('EDITOR_VERSION_SUPPRESSED');
 if(authority?.inspect!==true)throw fault('EDITOR_NOT_AUTHORIZED');
 if(desktop!==true)throw fault('EDITOR_DESKTOP_ONLY');
 if(PREVIEW_ONLY_FORMATS.includes(format))throw fault('EDITOR_FORMAT_PREVIEW_ONLY');
 if(!EDITOR_FORMATS.includes(format))throw fault('EDITOR_FORMAT_UNSUPPORTED');
 if(activeEditor!==false)throw fault('EDITOR_SESSION_BUSY');
 const write=authority.revise===true;
 return Object.freeze({mode:write?'edit':'read-only',userCanWrite:write});
}

/** One accepted PutFile. Accepting bytes into the draft store is the durability point: no structural or native check
 * runs here, so a later failing check can never make the editor report a failed save. Identical bytes add no draft
 * sequence. Only an explicit save becomes a publish candidate. */
export function planSave({kind,sha256,bytes,maxBytes,draftSeq,draftSha256}){
 if(!SAVE_KINDS.includes(kind)||typeof sha256!=='string'||!SHA.test(sha256)||!Number.isSafeInteger(bytes)||bytes<1||!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(draftSeq)||draftSeq<0||draftSha256!==null&&!SHA.test(draftSha256??''))throw fault('EDITOR_SAVE_INVALID');
 if(bytes>maxBytes)throw fault('EDITOR_DRAFT_TOO_LARGE');
 const same=sha256===draftSha256;
 return Object.freeze({newDraft:!same,draftSeq:same?draftSeq:draftSeq+1,publishCandidate:kind==='explicit',closedWithDraft:kind==='exit'});
}

/** Q-O6 and Q-O10: never overwrite the head; branch only once dot accepts non-head-parent lineage. */
export function conflictOptions({nonHeadParentLineage=false}={}){
 return Object.freeze([...(nonHeadParentLineage===true?['branch']:[]),'reopen-on-latest','discard']);
}

/** Maps one publish attempt's settlement to the draft state. A created version publishes; a definite pre-effect refusal
 * keeps the draft as publish-refused; a stale parent is a conflict; everything else, including any error this module
 * does not recognise, is publish-unknown: an UNKNOWN barrier that only reconciliation lifts. */
export function publishOutcome(settlement,{nonHeadParentLineage=false}={}){
 if(settlement?.status==='created'){if(typeof settlement.versionId!=='string'||!UUID.test(settlement.versionId))throw fault('EDITOR_PUBLISH_INVALID');return Object.freeze({draft:'published',versionId:settlement.versionId});}
 const code=settlement?.code;
 if(DEFINITE_PUBLISH_REFUSALS.includes(code))return Object.freeze({draft:'publish-refused',reason:code});
 if(code===CONFLICT_CODE)return Object.freeze({draft:'conflict',options:conflictOptions({nonHeadParentLineage})});
 return Object.freeze({draft:'publish-unknown',reason:typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/u.test(code)?code:'EDITOR_PUBLISH_UNKNOWN'});
}

/** Lifts an UNKNOWN barrier only on a definite lookup by the intent key (editSessionId, draftSeq): present records the
 * version, absent re-enables publishing, anything else keeps the barrier. Never lifted by time. */
export function reconcilePublish(lookup){
 if(lookup?.state==='present'&&typeof lookup.versionId==='string'&&UUID.test(lookup.versionId))return Object.freeze({draft:'published',versionId:lookup.versionId});
 if(lookup?.state==='absent')return Object.freeze({draft:'draft',republish:true});
 return Object.freeze({draft:'publish-unknown',republish:false});
}
/** Only `draft` and `publish-refused` may start a new publish. A `conflict` waits for the user's choice (Q-O6); `publish-unknown` and `publish-pending` wait for settlement or reconciliation. */
export const mayPublish=state=>['draft','publish-refused'].includes(state);
