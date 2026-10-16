/** Synthetic CAS port only. Root state survives SQL fixture rollback. No native storage/durability qualification. */
import {v,storageLifetime} from '../boundary.mjs';
import {emptyArtifactPublications,createArtifactPublicationJournal} from '../artifact-publication.mjs';
export function publicationAuthority(record,now){return {authorization:{receiptId:'synthetic-authorization-'+record.version.versionId,decision:'allow',action:record.version.parentVersionId===null?'artifact.generate':'artifact.revise',binding:structuredClone(record.version.binding),scopesSha256:v.hash(record.version.scopes),resourceSha256:v.hash({synthetic:true}),requestSha256:record.requestSha256,expiresAtMs:now+60000},invocation:{versionId:record.version.versionId,budgetTicketId:'synthetic-budget-'+record.version.versionId,binding:structuredClone(record.version.binding),requestSha256:record.requestSha256,ownedInvocationId:null}};}
export function publicationFixture(tenantId,now){const state={index:emptyArtifactPublications(tenantId),revision:0,writes:0,lostAck:false,readHook:null,writeHook:null,deny:false};
 const transport={async operation(signal,body){const life=storageLifetime({now,maxRequestMs:1000},signal);try{return await body(life);}finally{life.close();}},
  async read(){if(state.deny)throw Error('SYNTHETIC_EVIDENCE_UNAVAILABLE');await state.readHook?.();return {value:structuredClone(state.index),etag:state.revision};},
  async write(life,current,next){await state.writeHook?.(next);life.check();if(current.etag!==state.revision)return false;state.index=structuredClone(next);state.revision++;state.writes++;if(state.lostAck){state.lostAck=false;throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN'});}return true;}};
 const create=()=>createArtifactPublicationJournal({transport,tenantId,now});return {state,transport,create,publication:create()};
}
