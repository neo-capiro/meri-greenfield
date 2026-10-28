/** Correlates a private current-authorized source read with the immutable user selection.
 * The selector and source hashes are not permission. Model arguments cannot choose this base.
 *
 * Retained provenance: the immutable parent's stored evidence and the asset references its spec
 * carries are what the user selected. A generic full replacement cannot re-derive them, so it may
 * neither drop them nor invent new ones. They survive only through a trusted owner composed with
 * this preparer that re-presents the exact retained evidence and asset objects (`preservation`)
 * for the retained parent pins; the write result is re-checked after the write as well.
 *
 * The durable version record may itself retain the original id -> ObjectReference asset map next to
 * its immutable spec. When the private current-authorized source carries that map it is the exact
 * original mapping: the trusted owner must re-present the same objects, and a substituted object,
 * scope or hash is refused. A record written before the map existed, or an asset-bearing record whose
 * declared references the writer could not retain, stays explicitly unavailable for revision — this
 * module never infers a mapping, and a durable owner (not this module) is the only thing that may
 * reconstruct one. */
import {types} from 'node:util';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';
import {intentFault} from './faults.mjs';
const same=(left,right)=>v.hash(left)===v.hash(right);
const evidenceBindingKeys=['tenantId','actorId','conversationId'];
/** Asset identifiers an immutable spec references, in document order. Identification only, never a grant. */
export function referencedAssetIds(value){
  const found=[];
  const walk=node=>{
    if(node===null||typeof node!=='object')return;
    if(Object.hasOwn(node,'assetId')){found.push(node.assetId);return;}
    for(const child of Object.values(node))walk(child);
  };
  walk(value);return found;
}
/** The ONE canonical rule for a durable retained asset map: it is the exact original mapping of the
 * immutable spec's declared references — the same identifiers in the same document order, each entry
 * only {id,object}, each object admitted by the canonical ObjectReference validator and inside the
 * version's own admitted object scopes. `undefined` means "no map was retained" and is never inferred
 * into one; anything else that is missing, extra, duplicate, misordered, foreign-scoped or rehashed is
 * corruption of the retained mapping and is refused rather than stripped. Identification only, never a
 * grant, and this helper reads no bytes: the canonical owner that actually reads asset bytes verifies
 * them itself. */
export function retainedAssetMap(spec,assets,scopes){
  const assetIds=referencedAssetIds(spec);
  if(new Set(assetIds).size!==assetIds.length)throw 0;
  if(assets===undefined)return {assetIds:Object.freeze(assetIds),assets:null};
  if(!Array.isArray(assets)||assets.length!==assetIds.length)throw 0;
  const seen=new Set();
  const mapped=assets.map((entry,index)=>{
    const asset=own(v.snapshot(entry),['id','object']);
    if(asset.id!==assetIds[index]||seen.has(asset.id))throw 0;
    const object=v.object(asset.object);
    if(!same(object.scopes,scopes))throw 0;
    seen.add(asset.id);return Object.freeze({id:asset.id,object});
  });
  return {assetIds:Object.freeze(assetIds),assets:Object.freeze(mapped)};
}
/** Exactly what the immutable parent retains and a full replacement must keep.
 * `trustedAssets` is the parent record's own retained asset map, when the durable record carries one. */
export function retainedProvenance(version,spec,trustedAssets=undefined){
  const evidence=version.evidence.map(item=>v.nativeSourceEvidence(item));
  if(new Set(evidence.map(item=>item.citationId)).size!==evidence.length)throw 0;
  const scopes=new Set(version.scopes.map(v.hash));
  for(const item of evidence){
    // The evidence-binding rule the canonical version validator applies: tenant/actor/conversation.
    if(evidenceBindingKeys.some(key=>item.binding[key]!==version.binding[key]))throw 0;
    if(item.scopes.some(scope=>!scopes.has(v.hash(scope))))throw 0;
  }
  // The durable map is the exact original mapping of the immutable spec's declared references, refused
  // rather than stripped when it is not (see retainedAssetMap, the one owner of that rule).
  const map=retainedAssetMap(spec,trustedAssets,version.object.scopes);
  return Object.freeze({evidence,assetIds:map.assetIds,assets:map.assets});
}
/** Verify the trusted owner's re-presented retained resources against the immutable parent. */
function preservedProvenance(retained,value,version,specSha256){
  const presented=data(own(value,['evidence','assets']));
  const evidence=presented.evidence.map(item=>v.nativeSourceEvidence(item));
  if(!same(evidence,retained.evidence)||!Array.isArray(presented.assets)||presented.assets.length!==retained.assetIds.length)throw 0;
  const assets=presented.assets.map((entry,index)=>{
    const asset=own(v.snapshot(entry),['id','object']);
    if(asset.id!==retained.assetIds[index])throw 0;
    const object=v.object(asset.object);
    if(!same(object.scopes,version.object.scopes))throw 0;
    return Object.freeze({id:asset.id,object});
  });
  // When the durable parent carries its own retained map, the re-presented pair must still be exactly
  // that mapping: a substituted object reference, hash or scope is a different asset, not the retained
  // one, so it is refused before any replacement write.
  if(retained.assets!==null&&!same(assets,retained.assets))throw 0;
  return Object.freeze({evidence,assets:Object.freeze(assets),evidenceSha256:v.hash(evidence),assetIds:retained.assetIds,
    parent:Object.freeze({versionId:version.versionId,objectSha256:version.object.sha256,specSha256})});
}
export function admitDocumentRevisionSource(raw,{selection,binding,request,preservation=null}){
 try{
  const s=assertDocumentRevisionSelection(selection),source=data(own(raw,['version','request','specSha256','inspection','headVersionId'],['assets']));
  const version=v.version(source.version),original=v.request(source.request),{currentBytesVerified,...inspection}=source.inspection;
  v.inspection(inspection);
  if(version.artifactId!==s.artifactId||version.versionId!==s.versionId||version.object.sha256!==s.objectSha256||source.specSha256!==v.hash(original)||
   version.binding.tenantId!==binding.tenantId||version.binding.actorId!==binding.actorId||version.binding.conversationId!==binding.conversationId||
   v.hash(version.scopes)!==v.hash(version.object.scopes)||currentBytesVerified!==true||inspection.sha256!==s.objectSha256||inspection.bytes!==version.object.bytes||inspection.format!==original.format||
   original.operation!==request.operation||original.format!==request.format)throw 0;
  if(source.headVersionId!==s.versionId)throw intentFault('CONFLICT','none');
  const retained=retainedProvenance(version,original,source.assets);
  // A full replacement cannot introduce an asset the immutable parent never had.
  for(const assetId of referencedAssetIds(request))if(!retained.assetIds.includes(assetId))throw intentFault('UNAVAILABLE','none');
  // Source-backed recipes need their existing compiler/source-access bridge. Never
  // turn their citations or retained assets into an uncited generic replacement.
  const requiresPreservation=retained.evidence.length>0||retained.assetIds.length>0;
  const owner=preservation===null?null:preservation;
  if(owner!==null&&(typeof owner!=='function'||types.isProxy(owner)))throw intentFault('UNAVAILABLE','none');
  if(requiresPreservation&&owner===null)throw intentFault('UNAVAILABLE','none');
  const preserved=requiresPreservation?preservedProvenance(retained,owner({retained,request,baseVersionId:s.versionId}),version,source.specSha256):null;
  return Object.freeze({selection:s,request:original,specSha256:source.specSha256,version,preserved});
 }catch(error){if(['CONFLICT','UNAVAILABLE'].includes(error?.code)&&error.effect==='none')throw error;throw intentFault('ACCESS_DENIED','none');}
}
