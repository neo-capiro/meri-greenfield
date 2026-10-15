/** Strict PDF structure check, bounded and dependency-free. No upstream JavaScript PDF library is usable as a validator:
 * pdf-lib and pdf.js deliberately recover broken files (rebuilding missing cross-reference tables), so their success
 * says nothing about structure.
 *
 * Required: a `%PDF-1.0`…`%PDF-1.7` or `%PDF-2.0` header; a final `startxref` offset followed by `%%EOF`; at that
 * offset either a classic `xref` table or a cross-reference stream (`/Type /XRef`, FlateDecode with optional PNG
 * predictor, or unfiltered); every section reached through `/Prev` (and a hybrid table's `/XRefStm`) parses, with
 * classic subsections of exact 20-byte entries and object 0 free; every in-use entry points exactly at an `N G obj`
 * header of that number and generation, and every compressed entry names an in-use `/Type /ObjStm` object with
 * enough objects; every object number is below its section's `/Size`; the newest trailer has `/Size` and an indirect
 * `/Root` that resolves (directly or inside an object stream) to a dictionary with `/Type /Catalog` and an indirect
 * `/Pages` whose page tree is coherent (verifyPageTree). Bounds: PDF_LIMITS. Rendering is not qualified here. */
import {refuse} from './refusal.mjs';
import {decodeStream,isCount,isName,isRef,objectHeaderAt,parseValue,readIndirectObject,skipSpace} from './pdf-objects.mjs';
export const PDF_LIMITS=Object.freeze({maxSections:64,maxObjects:1000000,maxStreamBytes:16*1024*1024,maxPageTreeDepth:256});
const HEADER=/^%PDF-(?:1\.[0-7]|2\.0)(?![0-9.])/u;
const TAIL=/startxref[\0\t\n\f\r ]+(\d{1,10})[\0\t\n\f\r ]+%%EOF[\0\t\n\f\r ]*$/u;
const SUBSECTION=/[\0\t\n\f\r ]*(\d{1,10}) (\d{1,10})[\0\t\f ]*(?:\r\n|\r|\n)/y;
const ENTRY=/(\d{10}) (\d{5}) ([nf])(?: \r| \n|\r\n)/y;
/** In-use entry check: the offset holds exactly the header of object `num` generation `gen`. */
function pointsAtHeader(src,num,offset,gen){
 const h=offset<src.length?objectHeaderAt(src,offset):null;
 if(!h||h.num!==num||h.gen!==gen)refuse('PDF_XREF');
}
/** Size of a trailer or cross-reference stream dictionary; every entry number of the section must be below it. */
function sectionSize(dict,entries){
 const size=dict.get('Size');
 if(!Number.isSafeInteger(size)||size<1||size>PDF_LIMITS.maxObjects)refuse('PDF_TRAILER');
 for(const num of entries.keys())if(num>=size)refuse('PDF_XREF');
 return size;
}
/** Classic table at `at` (which starts with `xref`) and its trailer dictionary. */
function xrefTable(src,at){
 const entries=new Map();let i=at+4,subsections=0;
 if(!/^[\0\t\f ]*(?:\r\n|\r|\n)/u.test(src.slice(i,i+16)))refuse('PDF_XREF');
 for(;;){
  SUBSECTION.lastIndex=i;const s=SUBSECTION.exec(src);if(!s)break;
  const start=Number(s[1]),count=Number(s[2]);i=SUBSECTION.lastIndex;subsections++;
  if(start+count>PDF_LIMITS.maxObjects)refuse('PDF_LIMIT');
  for(let k=0;k<count;k++){
   ENTRY.lastIndex=i;const e=ENTRY.exec(src);if(!e)refuse('PDF_XREF');i+=20;
   const num=start+k,offset=Number(e[1]),gen=Number(e[2]);
   if(entries.has(num)||num===0&&e[3]!=='f')refuse('PDF_XREF');
   if(e[3]==='n'){pointsAtHeader(src,num,offset,gen);entries.set(num,{type:1,offset,gen});}else entries.set(num,{type:0});
  }
 }
 if(!subsections)refuse('PDF_XREF');
 i=skipSpace(src,i);if(!src.startsWith('trailer',i))refuse('PDF_TRAILER');
 const [trailer]=parseValue(src,i+7);if(!(trailer instanceof Map))refuse('PDF_TRAILER');
 sectionSize(trailer,entries);
 return {entries,trailer};
}
/** Big-endian unsigned field of `width` bytes at `offset`. */
function field(data,offset,width){let v=0;for(let k=0;k<width;k++)v=v*256+data[offset+k];if(!Number.isSafeInteger(v))refuse('PDF_XREF_STREAM');return v;}
/** Cross-reference stream object at `at`; its dictionary is also the section's trailer. */
function xrefStream(src,at){
 let object;try{object=readIndirectObject(src,at);}catch{refuse('PDF_XREF');}
 const dict=object.value;
 if(!(dict instanceof Map)||!isName(dict.get('Type'),'XRef')||!object.stream)refuse('PDF_XREF');
 const w=dict.get('W'),size=dict.get('Size'),index=dict.get('Index')??[0,size];
 if(!Array.isArray(w)||w.length!==3||!w.every(n=>isCount(n)&&n<=8)||!w[1]||!Array.isArray(index)||!index.length||index.length%2||!index.every(isCount))refuse('PDF_XREF_STREAM');
 const data=decodeStream(src,dict,object.stream,PDF_LIMITS.maxStreamBytes,'PDF_XREF_STREAM'),width=w[0]+w[1]+w[2];
 let count=0;for(let k=1;k<index.length;k+=2)count+=index[k];
 if(count>PDF_LIMITS.maxObjects||data.length!==count*width)refuse('PDF_XREF_STREAM');
 const entries=new Map();let o=0;
 for(let k=0;k<index.length;k+=2)for(let n=0;n<index[k+1];n++,o+=width){
  const num=index[k]+n,type=w[0]?field(data,o,w[0]):1,a=field(data,o+w[0],w[1]),b=field(data,o+w[0]+w[1],w[2]);
  if(entries.has(num)||num===0&&type!==0)refuse('PDF_XREF_STREAM');
  if(type===0)entries.set(num,{type:0});
  else if(type===1){pointsAtHeader(src,num,a,b);entries.set(num,{type:1,offset:a,gen:b});}
  else if(type===2)entries.set(num,{type:2,stream:a,index:b});
  else refuse('PDF_XREF_STREAM');
 }
 sectionSize(dict,entries);
 return {entries,trailer:dict};
}
/** Merged cross-reference (newest section wins) and the newest trailer, following `/XRefStm` and `/Prev`. */
function crossReference(src,startxref){
 const xref=new Map(),visited=new Set();let trailer=null,at=startxref;
 const merge=entries=>{for(const [num,e] of entries)if(!xref.has(num))xref.set(num,e);};
 const section=offset=>{
  if(!isCount(offset)||offset<9||offset>=src.length)refuse('PDF_XREF');
  if(visited.has(offset)||visited.size>=PDF_LIMITS.maxSections)refuse('PDF_LIMIT');visited.add(offset);
  return src.startsWith('xref',offset)?xrefTable(src,offset):xrefStream(src,offset);
 };
 while(at!==undefined){
  const s=section(at);merge(s.entries);trailer??=s.trailer;
  const hybrid=s.trailer.get('XRefStm');if(hybrid!==undefined&&src.startsWith('xref',at))merge(section(hybrid).entries);
  at=s.trailer.get('Prev');
 }
 if(xref.size>PDF_LIMITS.maxObjects)refuse('PDF_LIMIT');
 return {xref,trailer};
}
/** Resolver for one file: indirect objects through the merged cross-reference, with object streams cached. */
function objects(src,xref){
 const streams=new Map();
 const lengthOf=ref=>{const e=xref.get(ref.num);if(e?.type!==1||e.gen!==ref.gen)refuse('PDF_OBJECT');const v=readIndirectObject(src,e.offset,ref).value;return isCount(v)?v:refuse('PDF_OBJECT');};
 const objectStream=num=>{
  if(streams.has(num))return streams.get(num);
  const e=xref.get(num);if(e?.type!==1)refuse('PDF_XREF');
  const o=readIndirectObject(src,e.offset,{num,gen:e.gen},lengthOf),n=o.value instanceof Map?o.value.get('N'):undefined,first=o.value instanceof Map?o.value.get('First'):undefined;
  if(!o.stream||!isName(o.value.get('Type'),'ObjStm')||!isCount(n)||!n||n>PDF_LIMITS.maxObjects||!isCount(first))refuse('PDF_XREF');
  const s={...o,n,first};streams.set(num,s);return s;
 };
 /** Value of indirect object `ref`, or a StructureInvalid with `reason`. */
 const resolve=(ref,reason)=>{
  const e=xref.get(ref.num);
  if(e?.type===1&&e.gen===ref.gen)return readIndirectObject(src,e.offset,ref,lengthOf).value;
  if(e?.type!==2||ref.gen!==0)refuse(reason);
  const s=objectStream(e.stream),text=decodeStream(src,s.value,s.stream,PDF_LIMITS.maxStreamBytes,'PDF_OBJECT').toString('latin1');
  let i=0,num,offset;
  for(let k=0;k<=e.index;k++){[num,i]=parseValue(text,i);[offset,i]=parseValue(text,i);if(!isCount(num)||!isCount(offset))refuse('PDF_OBJECT');}
  if(num!==ref.num||s.first+offset>=text.length)refuse('PDF_OBJECT');
  return parseValue(text,s.first+offset)[0];
 };
 return {objectStream,resolve};
}
/** Walks the page tree from the catalog's `/Pages`: every node must resolve through the cross-reference (number and
 * generation) to a `/Type /Pages` node with an array `/Kids` of indirect references and a `/Count` equal to its leaf
 * total, or a `/Type /Page` leaf; every child's `/Parent` must name the node that lists it; no node may be reached twice.
 * Bounded by PDF_LIMITS.maxObjects nodes and PDF_LIMITS.maxPageTreeDepth levels. */
function verifyPageTree(rootRef,resolve){
 const seen=new Set(),key=ref=>`${ref.num} ${ref.gen}`;
 const walk=(ref,parent,depth)=>{
  if(depth>PDF_LIMITS.maxPageTreeDepth||seen.has(key(ref))||seen.size>=PDF_LIMITS.maxObjects)refuse('PDF_PAGE_TREE');seen.add(key(ref));
  const node=resolve(ref,'PDF_PAGE_TREE');if(!(node instanceof Map))refuse('PDF_PAGE_TREE');
  const up=node.get('Parent');
  if(parent?!(isRef(up)&&up.num===parent.num&&up.gen===parent.gen):up!==undefined)refuse('PDF_PAGE_TREE');
  if(isName(node.get('Type'),'Page'))return parent?1:refuse('PDF_PAGE_TREE');
  const kids=node.get('Kids'),count=node.get('Count');
  if(!isName(node.get('Type'),'Pages')||!Array.isArray(kids)||!isCount(count)||!kids.every(isRef))refuse('PDF_PAGE_TREE');
  let leaves=0;for(const kid of kids)leaves+=walk(kid,ref,depth+1);
  return leaves===count?leaves:refuse('PDF_PAGE_TREE');
 };
 walk(rootRef,null,0);
}
/** Throws a StructureInvalid unless `bytes` is a structurally coherent PDF. */
export function verifyPdf(bytes){
 const src=bytes.toString('latin1');
 if(!HEADER.test(src.slice(0,16)))refuse('PDF_HEADER');
 const tail=TAIL.exec(src.slice(-1024));if(!tail)refuse('PDF_STARTXREF');
 const startxref=Number(tail[1]);if(startxref<9||startxref>=src.length)refuse('PDF_STARTXREF');
 const {xref,trailer}=crossReference(src,startxref),{objectStream,resolve}=objects(src,xref);
 for(const e of xref.values())if(e.type===2&&e.index>=objectStream(e.stream).n)refuse('PDF_XREF');
 const root=trailer.get('Root');if(!isRef(root))refuse('PDF_TRAILER');
 const catalog=resolve(root,'PDF_CATALOG'),pages=catalog instanceof Map?catalog.get('Pages'):undefined;
 if(!(catalog instanceof Map)||!isName(catalog.get('Type'),'Catalog')||!isRef(pages))refuse('PDF_CATALOG');
 verifyPageTree(pages,resolve);
}
