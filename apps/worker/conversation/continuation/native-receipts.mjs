/** Correlate native-owner readback receipts; only configured owners can establish their provenance. */
import {canonicalSha256,validateShape,assertWorkspacePaths} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const fail=()=>{throw new Error('NATIVE_CHECKPOINT_RECEIPT_REFUSED');};
function fresh(receipt,started,now){const at=now();if(!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||
 !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=at||!uuid.test(receipt.verificationId))fail();return receipt.expiresAtMs;}
export function assertRestoreReceipt(raw,{continuation,binding,request,scopes,started,now}) {
 const r=data(own(raw,['verificationId','binding','checkpointId','checkpointSha256','workspaceSha256','opaqueSessionSha256','scopes','contextSha256','sourceRequestSha256','checkedAtMs','expiresAtMs']));
 if(!same(r.binding,binding)||r.checkpointId!==continuation.checkpoint.checkpointId||r.checkpointSha256!==continuation.checkpointSha256||
 r.workspaceSha256!==continuation.checkpoint.workspaceSha256||r.opaqueSessionSha256!==continuation.checkpoint.opaqueSession.sha256||!same(r.scopes,scopes)||
 r.contextSha256!==continuation.contextSha256||r.sourceRequestSha256!==continuation.sourceRequestSha256)fail();
 return fresh(r,started,now);
}
export function assertCaptureReceipt(raw,{binding,versions,request,scopes,contextSha256,sessionId,started,now}) {
 const r=data(own(raw,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','sessionId','resumeSessionAt','verificationId',
 'workspaceReadbackSha256','opaqueSessionReadbackSha256','checkedAtMs','expiresAtMs'])),cp=r.checkpoint;
 validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);
 if(!same(cp.binding,binding)||!same(cp.workspace.binding,binding)||!same(cp.versions,versions)||!same(cp.scopes,scopes)||!same(cp.workspace.scopes,scopes)||
 !same(cp.opaqueSession.scopes,scopes)||cp.workspace.entries.some(entry=>entry.object.scopes.some(scope=>!scopes.some(parent=>same(scope,parent))))||canonicalSha256(cp)!==r.checkpointSha256||cp.workspaceSha256!==canonicalSha256(cp.workspace)||
 r.workspaceReadbackSha256!==cp.workspaceSha256||r.opaqueSessionReadbackSha256!==cp.opaqueSession.sha256||r.contextSha256!==contextSha256||
 r.sourceRequestSha256!==canonicalSha256(request)||r.sessionId!==sessionId||cp.sessionId!==sessionId||
 r.resumeSessionAt!==null&&!uuid.test(r.resumeSessionAt))fail();
 return {receipt:r,expiresAtMs:fresh(r,started,now)};
}
