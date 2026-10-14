/** Canonical captured bytes -> immutable objects and verified checkpoint proof.
 * Authority, capture dispatch and journal transitions remain caller-owned. */
import {createHash,randomUUID} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape,assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';
import {assertNativeExecution} from './execution-broker.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
import {verifyCheckpointReadback} from './checkpoint-readback.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const fail=()=>{throw Error('NATIVE_CHECKPOINT_CAPTURE_REFUSED');},sha=b=>createHash('sha256').update(b).digest('hex');
export const checkpointIdentity=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
export async function publishCapturedCheckpoint({captured,original,input,captureSequence,checkpointId,parentCheckpointId=null,objects,life,fresh,revalidate,now}){
 const objectPort={put:storageMethod(objects,'put'),get:storageMethod(objects,'get')};
 const source=own(copySessionJson(captured,56*1024*1024),['binding','controlId','key','transcripts','files','quiescence'],['sessionId']);
 if(hash(source.binding)!==hash(original.binding)||source.controlId!==input.controlId||source.key.sessionId!==input.sessionId||source.sessionId!==undefined&&source.sessionId!==input.sessionId)fail();
 const key=scopedSessionKey(source.key,source.key,true),stopped=assertNativeExecution(source.quiescence,original);if(!stopped.physicalStopProven||stopped.state!=='stopped')fail();
 const snapshot=await createCheckpointSdkSnapshot({key,transcripts:copySessionJson(source.transcripts,8*1024*1024)});life.check();
 const opaqueBytes=Buffer.from(JSON.stringify(snapshot.transcripts()));if(opaqueBytes.length>8*1024*1024||!Array.isArray(source.files)||source.files.length>256)fail();
 let total=0;const files=source.files.map(raw=>{const row=own(raw,['path','executable','bytes','sha256','base64']);if(typeof row.path!=='string'||typeof row.executable!=='boolean'||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>8*1024*1024||total+row.bytes>32*1024*1024||typeof row.base64!=='string'||row.base64.length!==Math.ceil(row.bytes/3)*4)fail();const bytes=Buffer.from(row.base64,'base64');if(bytes.length!==row.bytes||bytes.toString('base64')!==row.base64||sha(bytes)!==row.sha256)fail();total+=row.bytes;return {...row,rawBytes:bytes};});
 const intent={binding:original.binding,controlId:input.controlId},requestSha256=hash({...intent,sourceRequestSha256:hash(input.request),contextSha256:input.contextSha256}),createdAt=new Date(now()).toISOString();
 const manifest={contractVersion:'0.1.0',manifestId:checkpointIdentity({...intent,kind:'workspace'}),binding:original.binding,logicalCwd:'/workspace/conversation',entries:files.map(f=>({path:f.path,kind:'file',object:{objectId:checkpointIdentity({...intent,path:f.path}),versionId:'pending',sha256:f.sha256,bytes:f.bytes,scopes:input.scopes},executable:f.executable})),scopes:input.scopes,createdAt};
 assertWorkspacePaths(manifest);await fresh();await revalidate();
 async function put(bytes,objectId){await fresh();const ref=data(await life.run(signal=>objectPort.put({objectId,bytes,scopes:input.scopes,requestSha256},signal)));validateShape('ObjectReference',ref);
  if(ref.objectId!==objectId||hash(ref.scopes)!==hash(input.scopes)||ref.bytes!==bytes.length||ref.sha256!==sha(bytes)||ref.versionId==='null')fail();
  await fresh();const read=await life.run(signal=>objectPort.get(ref,signal));life.check();if(!Buffer.isBuffer(read)||!read.equals(bytes))fail();await fresh();return ref;}
 for(let i=0;i<files.length;i++)manifest.entries[i].object=await put(files[i].rawBytes,manifest.entries[i].object.objectId);
 const opaqueSession=await put(opaqueBytes,checkpointIdentity({...intent,kind:'session'}));
 const checkpoint={contractVersion:'0.1.0',checkpointId:checkpointId??checkpointIdentity({...intent,kind:'checkpoint'}),parentCheckpointId,binding:original.binding,sessionId:input.sessionId,opaqueSession,workspace:manifest,workspaceSha256:hash(manifest),versions:original.versions,lastEventSequence:captureSequence,scopes:input.scopes,createdAt,durableReceiptId:checkpointIdentity({...intent,kind:'durable-receipt'})};validateShape('Checkpoint',checkpoint);
 const proof={checkpoint,checkpointSha256:hash(checkpoint),sourceRequestSha256:hash(input.request),contextSha256:input.contextSha256,resumeSessionAt:null,readReceiptId:randomUUID()};
 await verifyCheckpointReadback({proof,binding:original.binding,versions:original.versions,objects:objectPort,life,revalidate:fresh});await fresh();await revalidate();return proof;
}
