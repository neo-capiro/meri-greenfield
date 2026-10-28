/** The report-side preservation join for an immutable parent's own durable retained asset map.
 * The ONE canonical rule (`retainedAssetMap` in the intent layer) decides whether a durable map is the
 * parent spec's exact original id -> ObjectReference mapping; anything else — a declared reference with
 * no retained map, or a map that is missing, extra, duplicate, misordered, foreign-scoped or rehashed —
 * is refused rather than stripped, and never re-derived here. The parent's own declared image blocks are
 * then re-presented in the child document in declared order, so the canonical artifact owner writes the
 * child's own map beside its immutable spec instead of a revision silently dropping the retained assets.
 * Identification only, never a grant: this module reads no bytes, and the owner that actually reads asset
 * bytes verifies them itself. */
import {retainedAssetMap} from '../intents/document-revision.mjs';
/** The parent's admitted retained assets together with the exact declared image blocks they belong to. */
export function admitRetainedDocumentAssets(spec,assets,scopes){
  const map=retainedAssetMap(spec,assets,scopes);
  // The declared references are the document's own top-level image blocks in document order; if the
  // canonical walk and those blocks do not agree exactly, this is not the shape the join can preserve.
  const blocks=spec.content.blocks.filter(block=>block.kind==='image');
  if(blocks.length!==map.assetIds.length||blocks.some((block,index)=>block.assetId!==map.assetIds[index]))throw 0;
  // A declared reference whose map was never retained stays explicitly unavailable for revision.
  if(map.assetIds.length&&map.assets===null)throw 0;
  return {assets:map.assets,blocks};
}
/** The retained-asset section a revision appends, so the child document still references its assets. */
export function retainedAssetBlocks(retained,paragraph){
  if(!retained.blocks.length)return [];
  return [paragraph('Retained document assets (immutable parent)','Heading 2'),
    ...retained.blocks.flatMap((block,index)=>[paragraph(`Retained asset ${block.assetId}; object SHA256 ${retained.assets[index].object.sha256}; ${block.widthInches} x ${block.heightInches} inches.`),block])];
}
