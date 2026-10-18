/** SYNTHETIC in-memory settings store with the PostgreSQL store's port semantics (revision compare-and-set plus audit in one step), and
 * a synthetic platform capability record. No database is involved. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {refuse} from '../../product-access/errors.mjs';
import {changedFields} from '../save-metadata.mjs';
export function createSettingsStoreDouble(){
 const docs=new Map(),audit=[];let sequence=0;
 const key=(kind,tenantId,actorId)=>kind==='user'?`user/${tenantId}/${actorId}`:`tenant/${tenantId}`;
 return {docs,audit,
  async read({kind,tenantId,actorId}){const d=docs.get(key(kind,tenantId,actorId));return d?structuredClone(d):null;},
  async save({kind,tenantId,actorId,expectedRevision,document,initialDocument=null,audit:a}){
   const k=key(kind,tenantId,actorId),before=docs.get(k);if((before?.revision??0)!==expectedRevision)refuse('SETTINGS_REVISION_CONFLICT');
   const sha=canonicalSha256(document),revision=expectedRevision+1;docs.set(k,{revision,document:structuredClone(document),documentSha256:sha});
   audit.push({sequence:++sequence,tenantId,auditId:a.auditId,target:kind,subjectActorId:kind==='user'?actorId:null,actorId:a.actorId,fromRevision:expectedRevision,toRevision:revision,
    beforeSha256:before?.documentSha256??null,afterSha256:sha,platformSha256:a.platformSha256,changedFields:changedFields(before?.document??initialDocument,document),recordedAt:new Date(Date.UTC(2026,9,16,12,0,sequence)).toISOString()});
   return {revision,documentSha256:sha};
  },
  async listAudit({tenantId,beforeSequence,limit}){
   return audit.filter(e=>e.tenantId===tenantId&&(beforeSequence===null||e.sequence<beforeSequence)).sort((a,b)=>b.sequence-a.sequence).slice(0,limit).map(({tenantId:ignored,...e})=>e);
  },
 };
}
/** Platform maximum: workspace tools and general reads may be enabled; Bash and subagents are not. Two role ceilings. */
export const PLATFORM=Object.freeze({
 maximum:{workspaceTools:true,generalReads:true,auditHooks:true,maxParallelSubagents:2},
 defaults:{auditHooks:true},
 roleCeilings:{member:{workspaceTools:true,generalReads:true,auditHooks:true,maxParallelSubagents:2},analyst:{generalReads:true,auditHooks:true,readFamilies:['mail']}},
});
