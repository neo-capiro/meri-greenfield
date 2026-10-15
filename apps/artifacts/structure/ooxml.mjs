/** OPC/OOXML package checks over a verified ZIP (`zip.mjs`), with every examined part parsed by the strict XML reader
 * (`xml.mjs`):
 *
 * - `[Content_Types].xml`: root `Types` in the content-types namespace whose children are only `Default`/`Override`
 *   elements of that namespace, without duplicates; every part has a content type; macro-enabled types refuse.
 * - `_rels/.rels`: root `Relationships` in the relationships namespace with only `Relationship` children (unique `Id`,
 *   `Type`, `Target`, `TargetMode` Internal or External) and exactly one internal officeDocument relationship.
 * - The main part it targets: present, of the claimed format's content type, well-formed, with the expected root
 *   element and namespace.
 * - The main part's relationship part, when present: the same relationships rules, and every internal target exists.
 * `vbaProject.bin` refuses. */
import {readXmlPart} from './xml.mjs';
import {refuse} from './refusal.mjs';
export const OPC_NAMESPACES=Object.freeze({contentTypes:'http://schemas.openxmlformats.org/package/2006/content-types',relationships:'http://schemas.openxmlformats.org/package/2006/relationships'});
const OFFICE_DOCUMENT_TYPES=Object.freeze(['http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument','http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument']);
export const OOXML_FORMATS=Object.freeze({
 docx:Object.freeze({contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',root:'document',ns:Object.freeze(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'])}),
 xlsx:Object.freeze({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',root:'workbook',ns:Object.freeze(['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main'])}),
 pptx:Object.freeze({contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',root:'presentation',ns:Object.freeze(['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main'])})});
const CONTENT_TYPES='[Content_Types].xml';
/** Content-type map: lower-cased extension and part name lookups. */
function contentTypes(bytes){
 const {root,children}=readXmlPart(bytes,{elementOnlyRoot:true});
 if(root.uri!==OPC_NAMESPACES.contentTypes||root.local!=='Types')refuse('OPC_CONTENT_TYPES');
 const defaults=new Map(),overrides=new Map();
 for(const {uri,local,attributes:a} of children){
  if(uri!==OPC_NAMESPACES.contentTypes||typeof a.ContentType!=='string'||!a.ContentType)refuse('OPC_CONTENT_TYPES');
  if(/macroEnabled/iu.test(a.ContentType))refuse('OPC_MACRO');
  const [map,key]=local==='Default'?[defaults,a.Extension]:local==='Override'?[overrides,a.PartName]:[];
  if(!map||typeof key!=='string'||!key||local==='Override'&&!key.startsWith('/')||map.has(key.toLowerCase()))refuse('OPC_CONTENT_TYPES');
  map.set(key.toLowerCase(),a.ContentType);
 }
 return part=>overrides.get(`/${part}`.toLowerCase())??defaults.get(/\.([^./]+)$/u.exec(part)?.[1].toLowerCase());
}
/** Relationship elements of a relationship part, refusing with `reason`. */
function relationships(bytes,reason){
 const {root,children}=readXmlPart(bytes,{elementOnlyRoot:true});
 if(root.uri!==OPC_NAMESPACES.relationships||root.local!=='Relationships')refuse(reason);
 const ids=new Set();
 return children.map(({uri,local,attributes:a})=>{
  if(uri!==OPC_NAMESPACES.relationships||local!=='Relationship'||typeof a.Id!=='string'||!a.Id||ids.has(a.Id)||typeof a.Type!=='string'||!a.Type||typeof a.Target!=='string'||!a.Target||![undefined,'Internal','External'].includes(a.TargetMode))refuse(reason);
  ids.add(a.Id);return {type:a.Type,target:a.Target,external:a.TargetMode==='External'};
 });
}
/** Package part name (no leading slash) of an internal relationship target, resolved against `source` (a part name,
 * or '' for the package root). */
function targetPart(source,target,reason){
 if(target.includes('\\')||/^[a-z][a-z0-9+.-]*:/iu.test(target)||target.startsWith('//'))refuse(reason);
 let url;try{url=new URL(target,`http://package/${source}`);}catch{refuse(reason);}
 if(url.host!=='package'||url.search||url.hash)refuse(reason);
 let part;try{part=decodeURIComponent(url.pathname).slice(1);}catch{refuse(reason);}
 if(!part||part.endsWith('/'))refuse(reason);
 return part;
}
const relationshipPartOf=part=>{const slash=part.lastIndexOf('/');return `${part.slice(0,slash+1)}_rels/${part.slice(slash+1)}.rels`;};
/** Throws a StructureInvalid unless `entries` (from `readZip`) is an OPC package of the claimed OOXML `format`. */
export function verifyOoxml(entries,format){
 const spec=OOXML_FORMATS[format];
 if(!spec)refuse('FORMAT_UNSUPPORTED');
 if([...entries.keys()].some(n=>/(?:^|\/)vbaProject\.bin$/iu.test(n)))refuse('OPC_MACRO');
 if(!entries.has(CONTENT_TYPES))refuse('OPC_CONTENT_TYPES');
 if(!entries.has('_rels/.rels'))refuse('OPC_RELATIONSHIPS');
 const typeOf=contentTypes(entries.get(CONTENT_TYPES));
 for(const name of entries.keys())if(name!==CONTENT_TYPES&&!name.endsWith('/')&&!typeOf(name))refuse('OPC_CONTENT_TYPES');
 const office=relationships(entries.get('_rels/.rels'),'OPC_RELATIONSHIPS').filter(r=>OFFICE_DOCUMENT_TYPES.includes(r.type));
 if(office.length!==1||office[0].external)refuse('OPC_RELATIONSHIPS');
 const main=targetPart('',office[0].target,'OPC_RELATIONSHIPS');
 if(!entries.has(main)||typeOf(main)!==spec.contentType)refuse('OPC_MAIN_PART');
 const {root}=readXmlPart(entries.get(main));
 if(root.local!==spec.root||!spec.ns.includes(root.uri))refuse('OPC_MAIN_PART');
 const partRels=relationshipPartOf(main);
 if(entries.has(partRels))for(const r of relationships(entries.get(partRels),'OPC_PART_RELATIONSHIPS'))if(!r.external&&!entries.has(targetPart(main,r.target,'OPC_PART_RELATIONSHIPS')))refuse('OPC_PART_RELATIONSHIPS');
}
