/** Shared canonical immutable bytes proof; authorization belongs to each caller. */
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash,validateShape,assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createCheckpointSdkSnapshot} from './checkpoint-snapshot.mjs';
const fail=()=>{throw Error('NATIVE_CHECKPOINT_READBACK_REFUSED');};
export async function verifyCheckpointReadback({proof,binding,versions,objects,life,revalidate}){
 const get=storageMethod(objects,'get'),cp=proof.checkpoint;validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);
 if(hash(cp)!==proof.checkpointSha256||hash(cp.workspace)!==cp.workspaceSha256||hash(cp.binding)!==hash(binding)||hash(cp.versions)!==hash(versions)||cp.workspace.entries.length>256||cp.workspace.entries.reduce((n,e)=>n+e.object.bytes,0)>32*1024*1024)fail();
 async function bytes(ref){validateShape('ObjectReference',ref);if(ref.bytes>8*1024*1024||ref.versionId==='null')fail();await revalidate();const raw=await life.run(signal=>get(ref,signal));life.check();if(!Buffer.isBuffer(raw)||raw.length!==ref.bytes||createHash('sha256').update(raw).digest('hex')!==ref.sha256)fail();await revalidate();return Buffer.from(raw);}
 const raw=await bytes(cp.opaqueSession);let transcripts;try{transcripts=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail();}
 await createCheckpointSdkSnapshot({key:{projectKey:cp.workspace.logicalCwd.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:cp.sessionId},transcripts});life.check();for(const entry of cp.workspace.entries)await bytes(entry.object);
}
