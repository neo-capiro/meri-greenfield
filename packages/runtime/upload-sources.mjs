/** Private, bounded native-source pages. These checks correlate current CONTROL output; they grant no access. */
import {data,own} from '../contracts/commands-0.2/execution-boundary.mjs';
import {assertUploadSelections} from '../contracts/upload-selection.mjs';
import {canonicalSha256 as hash,validateShape} from '../contracts/validate.mjs';
export const UPLOAD_SOURCE_PAGE_FRAGMENTS=64,UPLOAD_SOURCE_FRAGMENT_CHARACTERS=256;
const keys=['selection','versionId','filename','mimeType','bytes','extractionStatus','limitations','sourceSha256','pageCount','scopes'];
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value),integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const fail=()=>{throw Object.assign(Error('UPLOAD_SOURCE_REFUSED'),{code:'UPLOAD_SOURCE_REFUSED'});};
export function uploadSourceManifest(raw,selection){
 const v=data(own(raw,keys));assertUploadSelections([v.selection]);
 if(hash(v.selection)!==hash(selection)||typeof v.versionId!=='string'||!v.versionId||v.versionId.length>1024||typeof v.filename!=='string'||!v.filename||v.filename.length>255||typeof v.mimeType!=='string'||v.mimeType.length>128||!integer(v.bytes,1,10485760)||!['available','partial'].includes(v.extractionStatus)||!Array.isArray(v.limitations)||v.limitations.length>16||v.limitations.some(x=>typeof x!=='string'||!/^[A-Z][A-Z0-9_]{0,79}$/u.test(x))||!digest(v.sourceSha256)||!integer(v.pageCount,1,256)||!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100)fail();
 for(const scope of v.scopes)validateShape('Scope',scope);return v;
}
export function uploadSourcePage(raw,expected,page){
 const v=data(own(raw,[...keys,'page','fragments','pageSha256','nextPage'])),manifest=Object.fromEntries(keys.map(key=>[key,v[key]]));
 uploadSourceManifest(manifest,expected.selection);
 if(hash(manifest)!==hash(expected)||v.page!==page||!integer(page,0,expected.pageCount-1)||v.nextPage!==(page+1<expected.pageCount?page+1:null)||!Array.isArray(v.fragments)||v.fragments.length>UPLOAD_SOURCE_PAGE_FRAGMENTS||!digest(v.pageSha256)||hash(v.fragments)!==v.pageSha256)fail();
 for(const rawFragment of v.fragments){const f=own(rawFragment,['ordinal','text','method','confidence','location','sourceSha256','trust','startCharacter','endCharacter']);
  if(!integer(f.ordinal,0,Number.MAX_SAFE_INTEGER)||typeof f.text!=='string'||!f.text.isWellFormed()||f.text.length>UPLOAD_SOURCE_FRAGMENT_CHARACTERS+1||!integer(f.startCharacter,0,2000000)||!integer(f.endCharacter,f.startCharacter,2000000)||f.endCharacter-f.startCharacter!==f.text.length||f.sourceSha256!==expected.selection.sha256||f.trust!=='external_untrusted'||!['native','ocr'].includes(f.method)||f.confidence!==null&&(!Number.isFinite(f.confidence)||f.confidence<0||f.confidence>1))fail();
  const location=own(f.location,['page','slide','sheet','rowStart','rowEnd']);for(const [key,max] of [['page',200],['slide',200],['sheet',50],['rowStart',100000],['rowEnd',100000]])if(location[key]!==null&&!integer(location[key],1,max))fail();
 }
 return v;
}
