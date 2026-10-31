/** Exact edited bytes: reuse the ZIP/OPC/XML readers; never re-render the source
 * recipe or rewrite formula caches. These facts do not assert native fidelity. */
import {createHash} from 'node:crypto';
import {readZip,ZIP_LIMITS} from '../structure/zip.mjs';
import {verifyOoxml,OOXML_FORMATS,readOoxmlRelationships,resolveOoxmlTarget} from '../structure/ooxml.mjs';
import {readXmlPart} from '../structure/xml.mjs';
import {OFFICE_FORMULA_CACHE} from '../../../packages/contracts/office-edit.mjs';
import {verifyChartWorkbooks} from './chart-workbooks.mjs';
const fail=()=>{throw Object.assign(Error('EDITOR_STRUCTURE_REFUSED'),{code:'EDITOR_STRUCTURE_REFUSED'});};
const namespaces={word:new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']),
 sheet:new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main']),
 slide:new Set(['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main'])};
export function inspectOfficeEdit(bytes,format){
 return inspect(bytes,format,{bytes:ZIP_LIMITS.maxTotalUncompressed,entries:5000});
}
function inspect(bytes,format,budget){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>20*1024*1024||!Object.hasOwn(OOXML_FORMATS,format))fail();
 try{
  const entries=readZip(bytes,{...ZIP_LIMITS,maxTotalUncompressed:budget.bytes,maxEntries:budget.entries}),main=verifyOoxml(entries,format);
  budget.entries-=entries.size;for(const content of entries.values())budget.bytes-=content.length;
  if([...entries.keys()].some(name=>name.length>500||/(?:^|\/)(?:activeX|externalLinks)\//iu.test(name)))fail();
  // Active payloads cannot evade the filename rules by moving to another part.
  // Apply these checks recursively to embedded XLSX as well as the outer file.
  const {children:types}=readXmlPart(entries.get('[Content_Types].xml'));
  if(types.some(({attributes:a})=>/(?:macroEnabled|vbaProject|activeX|oleObject|(?:intl)?macrosheet|externalLink)/iu.test(a.ContentType)))fail();
  const embedded=new Set(),referenced=new Set();
  for(const [name,content]of entries)if(/(?:^|\/)embeddings\//iu.test(name)){
   // Native PowerPoint charts use one data workbook. Arbitrary OLE objects,
   // nested embeddings and non-chart package relationships remain refused.
   if(format!=='pptx')fail();
   if(name==='ppt/embeddings/'&&content.length===0)continue;
   if(!/^ppt\/embeddings\/[^/]+\.xlsx$/u.test(name))fail();
   inspect(content,'xlsx',budget);embedded.add(name);
  }
  let paragraphs=0,tables=0,pictures=0,formulas=0,slides=0;const sheets=[];
  for(const [name,content]of entries){
   if(!/\.(?:xml|rels)$/iu.test(name))continue;
   if(/\.rels$/iu.test(name)){
    const match=/^(.*\/)?_rels\/([^/]+)\.rels$/iu.exec(name);
    const source=name.toLowerCase()==='_rels/.rels'?'':match?(match[1]??'')+match[2]:null;
    if(source===null||source!==''&&!entries.has(source))fail();
    for(const r of readOoxmlRelationships(content,'OPC_PART_RELATIONSHIPS')){
     if(/\/(?:oleObject|control|vbaProject|attachedTemplate|aFChunk|externalLink|externalLinkPath|xlMacrosheet|xlIntlMacrosheet)$/iu.test(r.type))fail();
     if(r.external){
      if(!/^http:\/\/(?:schemas.openxmlformats.org\/officeDocument\/2006|purl.oclc.org\/ooxml\/officeDocument)\/relationships\/hyperlink$/u.test(r.type)||
        !/^https?:\/\//iu.test(r.target))fail();
      const target=new URL(r.target);if(target.username||target.password)fail();
     }else{
      const target=resolveOoxmlTarget(source,r.target,'OPC_PART_RELATIONSHIPS');
      if(!entries.has(target))fail();
      if(embedded.has(target)){
       if(!/^ppt\/charts\/[^/]+\.xml$/u.test(source)||!/^http:\/\/(?:schemas.openxmlformats.org\/officeDocument\/2006|purl.oclc.org\/ooxml\/officeDocument)\/relationships\/package$/u.test(r.type))fail();
       const {root}=readXmlPart(entries.get(source));
       if(root.local!=='chartSpace'||!['http://schemas.openxmlformats.org/drawingml/2006/chart','http://purl.oclc.org/ooxml/drawingml/chart'].includes(root.uri))fail();
       referenced.add(target);
      }
     }
    }
    continue;
   }
   // Inspect every XML relationship part, including those outside the main part.
   readXmlPart(content,{visitElement:({uri,local,attributes:a})=>{
    if(name===main&&namespaces.word.has(uri)){if(local==='p')paragraphs++;if(local==='tbl')tables++;}
    if(name===main&&['http://schemas.openxmlformats.org/drawingml/2006/picture','http://purl.oclc.org/ooxml/drawingml/picture'].includes(uri)&&local==='pic')pictures++;
    if(name===main&&namespaces.sheet.has(uri)&&local==='sheet'){
     if(typeof a.name!=='string'||!a.name||sheets.some(s=>s.toLowerCase()===a.name.toLowerCase())||sheets.length>=30)fail();sheets.push(a.name);
    }
    if(namespaces.sheet.has(uri)&&local==='f')formulas++;
    if(name===main&&namespaces.slide.has(uri)&&local==='sldId')slides++;
   }});
  }
  if([...embedded].some(name=>!referenced.has(name)))fail();
  if(format==='pptx')verifyChartWorkbooks(entries,embedded);
  const details=format==='docx'?{paragraphs,tables,pictures}:format==='xlsx'?{sheets,formulas,formulaCache:OFFICE_FORMULA_CACHE}:
   {slides,editable:true,visualInspection:'pending'};
  return {sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format,nativeOpened:false,rendered:false,recalculated:false,
   members:[...entries.keys()],details};
 }catch{fail();}
}
