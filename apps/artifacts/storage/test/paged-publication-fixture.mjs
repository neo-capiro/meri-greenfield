/** Synthetic durable root/pages; reconstruction retains exact bytes. No native qualification. */
import {v,storageLifetime} from '../boundary.mjs';
import {emptyArtifactPublications} from '../artifact-publication.mjs';
import {createPagedArtifactPublicationJournal} from '../artifact-publication-paged-journal.mjs';
export function pagedPublicationFixture(tenantId,now){
 const state={index:emptyArtifactPublications(tenantId),revision:0,roots:[],pages:new Map(),reads:0,pageReads:0,pageWrites:0,lostRootAck:false,lostPageAck:false,writeHook:null};
 const transport={async operation(signal,body){const life=storageLifetime({now,maxRequestMs:30000},signal);try{return await body(life);}finally{life.close();}},
  async read(){state.reads++;return {value:structuredClone(state.index),etag:String(state.revision),versionId:state.revision?'root-'+state.revision:null};},
  async write(life,current,next){await state.writeHook?.();life.check();if(current.etag!==String(state.revision))return false;state.roots.push(structuredClone(state.index));state.index=structuredClone(next);state.revision++;if(state.lostRootAck){state.lostRootAck=false;throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN'});}return true;}};
 const pages={async read(life,ref){life.check();state.pageReads++;const item=state.pages.get(ref.sha256);if(!item||ref.versionId!=='page-'+ref.sha256)throw Error('SYNTHETIC_MISSING_PAGE');return JSON.parse(item);},
  async write(life,page,hash){life.check();state.pageWrites++;if(v.hash(page)!==hash)throw Error('SYNTHETIC_HASH');const bytes=JSON.stringify(page);if(state.pages.has(hash)&&state.pages.get(hash)!==bytes)throw Error('SYNTHETIC_IMMUTABLE');state.pages.set(hash,bytes);if(state.lostPageAck){state.lostPageAck=false;throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN'});}return {versionId:'page-'+hash};}};
 const create=(pagedWritesEnabled=true)=>createPagedArtifactPublicationJournal({transport,pages,tenantId,now,pagedWritesEnabled});return {state,transport,pages,create,owner:create()};
}
