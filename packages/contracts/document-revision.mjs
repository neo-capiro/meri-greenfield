/** An immutable user selection, never permission or model-authored authority. */
import {data,own} from './commands-0.2/execution-boundary.mjs';
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const digest={type:'string',pattern:'^[0-9a-f]{64}$'};
export const DOCUMENT_REVISION_SELECTION_SCHEMA=Object.freeze({type:'object',properties:{artifactId:uuid,versionId:uuid,objectSha256:digest},required:['artifactId','versionId','objectSha256'],additionalProperties:false});
/** Recipe compatibility only. Installed manifest pins and current source access remain separate checks. */
export const supportsSelectedDocumentRevision=skill=>skill?.skillId==='quick_skill.bill_watch'&&skill.skillVersion==='2.0.0'||skill?.skillId==='quick_skill.cited_report'&&skill.skillVersion==='1.0.0';
export function assertDocumentRevisionSelection(value){
 try{const s=data(own(value,['artifactId','versionId','objectSha256']));
  if(typeof s.artifactId!=='string'||typeof s.versionId!=='string'||typeof s.objectSha256!=='string'||!new RegExp(uuid.pattern,'u').test(s.artifactId)||!new RegExp(uuid.pattern,'u').test(s.versionId)||!new RegExp(digest.pattern,'u').test(s.objectSha256))throw 0;
  return Object.freeze(s);
 }catch{throw Object.assign(Error('DOCUMENT_REVISION_SELECTION'),{code:'DOCUMENT_REVISION_SELECTION'});}
}
