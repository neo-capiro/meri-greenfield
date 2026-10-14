/** Existing opaque SessionStore snapshot array; never interprets native JSONL. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {copySessionTranscript,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';
export async function createCheckpointSdkSnapshot({key,transcripts}){
 const pinned=scopedSessionKey(key,key,true),copied=copySessionJson(transcripts,34*1024*1024);
 if(!Array.isArray(copied)||!copied.length||copied.length>256)throw Error('CHECKPOINT_SNAPSHOT_FORMAT');
 const streams=new Map();let total=0,count=0;
 for(const raw of copied){const row=own(raw,['entries'],['subpath']),part=scopedSessionKey({...pinned,...(row.subpath===undefined?{}:{subpath:row.subpath})},pinned),name=part.subpath??'';
  if(streams.has(name))throw Error('CHECKPOINT_SNAPSHOT_FORMAT');const entries=copySessionTranscript(row.entries);total+=Buffer.byteLength(JSON.stringify(entries));count+=entries.length;
  if(total>32*1024*1024||count>100000)throw Error('CHECKPOINT_SNAPSHOT_BOUND');streams.set(name,entries);
 }
 const store=Object.freeze({async load(value){const part=scopedSessionKey(value,pinned);return streams.has(part.subpath??'')?copySessionTranscript(streams.get(part.subpath??'')):null;},async listSubkeys(value){scopedSessionKey(value,pinned,true);return [...streams.keys()].filter(Boolean).sort();}});
 // The qualification readback helper adopts the installed SDK reference store.
 // Load it only when a real snapshot is requested, keeping service imports inert.
 const {verifySessionStoreSnapshot}=await import('../../worker/qualification/checkpoint/verify-session-store.mjs');
 await verifySessionStoreSnapshot(store,pinned,copied);
 return Object.freeze({key:pinned,store,transcripts:()=>copySessionJson(copied,34*1024*1024)});
}
