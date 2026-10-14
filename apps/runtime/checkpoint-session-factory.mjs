/** Observe one real mirror's ACK/status; canonical client remains transcript owner. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {copySessionJson} from '../worker/qualification/checkpoint/session-store-data.mjs';
import {copySessionTranscript,scopedSessionKey} from '../worker/qualification/checkpoint/bound-session-store.mjs';
const fault=()=>Error('CHECKPOINT_SESSION_UNKNOWN'),refuse=()=>{throw fault();};
export function createCheckpointSessionFactory(configuration){
 const c=own(configuration,['factory','client','binding']),binding=data(c.binding),load=storageMethod(c.client,'load'),list=storageMethod(c.client,'listSubkeys');validateShape('RunBinding',binding);
 if(typeof c.factory!=='function'||types.isProxy(c.factory))refuse();let initialized=false,initializing=false,current,key,pending=0,failed=false,rejected=0,frozen=false,closing;
 const check=()=>{if(initializing||!current||failed||pending||rejected)refuse();};
 function assertFrozen(){check();if(!frozen||!key)refuse();}
 async function close(){frozen=true;if(!current){if(initializing)refuse();return;}return closing??=(async()=>{try{await current.close();if(pending||failed||rejected)refuse();}catch(error){failed=true;throw error;}})();}
 async function factory(value){const request=own(value,['binding'],['sessionKey','signal','runtimeSignal','continuation','nextTurn']);if(request.continuation!==undefined&&request.nextTurn!==undefined)refuse();if(hash(data(request.binding))!==hash(binding)||initialized||frozen)refuse();initialized=true;initializing=true;let closeProduced,retired=false;
  try{const produced=await c.factory(value);closeProduced=storageMethod(produced,'close');const raw=own(produced,['store','settle','close']),methods=Object.fromEntries(['append','load','listSubkeys'].map(name=>[name,storageMethod(raw.store,name)]));current={settle:storageMethod(produced,'settle'),close:storageMethod(produced,'close')};if(frozen){retired=true;await current.close();refuse();}
   async function call(name,args){const captured=name==='append'?scopedSessionKey(args[0],args[0]):null;if(name==='append'&&frozen){rejected++;refuse();}pending++;try{const result=await methods[name](...args);if(name==='append'){if(captured.subpath===undefined){if(key&&hash(key)!==hash(captured))refuse();key=captured;}}return result;}catch(error){failed=true;throw error;}finally{pending--;}}
   return Object.freeze({store:Object.freeze({append:(...args)=>call('append',args),load:(...args)=>call('load',args),listSubkeys:(...args)=>call('listSubkeys',args)}),settle:async(...args)=>{await current.settle(...args);check();},close});
  }catch(error){failed=true;if(closeProduced&&!retired&&!current){retired=true;try{await closeProduced();}catch{}}throw error;}finally{initializing=false;}
 }
 const session=Object.freeze({async settle(value={}){const v=own(value,[],['binding','controlId','sessionId','signal']);nativeSignal(v.signal);if(v.binding&&hash(v.binding)!==hash(binding))refuse();await current?.settle({signal:v.signal});check();if(!key||v.sessionId!==undefined&&key.sessionId!==v.sessionId)refuse();},close,
  async snapshot(value){const v=own(value,['binding','controlId','sessionId'],['signal']);nativeSignal(v.signal);assertFrozen();if(hash(data(v.binding))!==hash(binding)||v.sessionId!==key.sessionId)refuse();const pinned=key,subkeys=(await list({key:pinned},{signal:v.signal})).subkeys;assertFrozen();if(!Array.isArray(subkeys)||subkeys.length>255||new Set(subkeys).size!==subkeys.length)refuse();const transcripts=[];
   for(const subpath of [undefined,...subkeys.slice().sort()]){const part=scopedSessionKey({...pinned,...(subpath===undefined?{}:{subpath})},pinned),result=await load({key:part},{signal:v.signal});assertFrozen();if(result.entries===null)refuse();transcripts.push({... (subpath===undefined?{}:{subpath}),entries:copySessionTranscript(result.entries)});}
   assertFrozen();return {key:pinned,transcripts:copySessionJson(transcripts,8*1024*1024)};
  },assertFrozen});
 return Object.freeze({factory,session,status:()=>Object.freeze({initialized,initializing,frozen,pending,failed,rejected,hasMainAck:!!key})});
}
