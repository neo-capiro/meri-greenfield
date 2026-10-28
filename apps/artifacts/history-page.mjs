/** Paged history is metadata-only; the same current authority/scope and retention owner gates every release. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {publicationCursor} from './publication-cursor.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export async function readPagedArtifactHistory({v,versions,scopeVersion,authority,servable},query,context,life,resource,requestSha256,publication){
 const cursor=publicationCursor(v.hash({intent:'artifact.history',query:{versionId:query.versionId,limit:query.limit},binding:context.binding,scopes:context.scopes,positionSha256:publication.positionSha256}),'ARTIFACT_HISTORY_CURSOR'),offset=cursor.decode(query.cursor);
 const anchor=scopeVersion(await life.run(signal=>versions.read(query.versionId,signal)),query.versionId,context);resource.object=anchor.version.object;
 await authority(life,'artifact.inspect',resource,requestSha256,context);await servable(life,context,anchor);
 const result=data(await life.run(signal=>versions.historyPage({tenantId:context.binding.tenantId,versionId:query.versionId,offset,limit:query.limit,positionSha256:publication.positionSha256},signal)));
 own(result,['artifactId','anchorVersionId','headVersionId','records','nextOffset','positionSha256']);if(result.artifactId!==anchor.version.artifactId||result.anchorVersionId!==query.versionId||result.positionSha256!==publication.positionSha256||!Array.isArray(result.records)||!result.records.length||result.records.length>query.limit)fail('ARTIFACT_HISTORY_RESULT');
 const records=result.records.map(r=>scopeVersion(r,r.version?.versionId,context)),ids=new Set();for(let i=0;i<records.length;i++){const r=records[i];if(r.version.artifactId!==result.artifactId||ids.has(r.version.versionId)||i+1<records.length&&r.version.parentVersionId!==records[i+1].version.versionId)fail('ARTIFACT_HISTORY_RESULT');ids.add(r.version.versionId);await servable(life,context,r);}
 if(offset===0&&records[0].version.versionId!==result.headVersionId||result.nextOffset===null&&records.at(-1).version.parentVersionId!==null||result.nextOffset!==null&&result.nextOffset!==offset+records.length)fail('ARTIFACT_HISTORY_RESULT');
 const after=await life.run(signal=>versions.publicationSnapshot(context.binding.tenantId,signal));if(after.positionSha256!==publication.positionSha256)fail('ARTIFACT_HISTORY_CURSOR');
 await authority(life,'artifact.inspect',resource,requestSha256,context);await servable(life,context,anchor);return {artifactId:result.artifactId,anchorVersionId:query.versionId,headVersionId:result.headVersionId,versions:records.map(r=>r.version),nextCursor:result.nextOffset===null?null:cursor.encode(result.nextOffset)};
}
