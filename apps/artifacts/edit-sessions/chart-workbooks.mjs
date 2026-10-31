/** Bind chart data to its actual package relationship, after bounded ZIP/OPC/XML
 * and nested workbook inspection. This proves structure, never engine fidelity. */
import {SaxesParser} from 'saxes';
import {readXmlPart} from '../structure/xml.mjs';
import {resolveOoxmlTarget} from '../structure/ooxml.mjs';
const chartNamespaces=new Set(['http://schemas.openxmlformats.org/drawingml/2006/chart','http://purl.oclc.org/ooxml/drawingml/chart']);
const relationshipNamespaces=new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships']);
const fail=()=>{throw Error('EDITOR_CHART_WORKBOOK');};

// The shared XML reader deliberately exposes only unqualified OPC attributes.
// Read the chart's namespaced r:id here without changing that shared contract.
function dataRelationship(bytes){
 let depth=0,id=null;const parser=new SaxesParser({xmlns:true,position:false});
 parser.on('doctype',fail);
 parser.on('opentag',tag=>{
  depth++;
  if(!chartNamespaces.has(tag.uri)||tag.local!=='externalData')return;
  const ids=Object.values(tag.attributes).filter(a=>a.local==='id'&&relationshipNamespaces.has(a.uri));
  if(depth!==2||id!==null||ids.length!==1||!ids[0].value)fail();
  id=ids[0].value;
 });
 parser.on('closetag',()=>depth--);
 parser.write(new TextDecoder('utf-8',{fatal:true}).decode(bytes)).close();
 return id;
}

export function verifyChartWorkbooks(entries,embedded){
 const {children:types}=readXmlPart(entries.get('[Content_Types].xml')),defaults=new Map(),overrides=new Map();
 for(const {local,attributes:a} of types){
  if(local==='Default')defaults.set(a.Extension.toLowerCase(),a.ContentType);
  else if(local==='Override')overrides.set(a.PartName.toLowerCase(),a.ContentType);
 }
 const typeOf=name=>overrides.get('/'+name.toLowerCase())??defaults.get(name.split('.').at(-1).toLowerCase());
 const referenced=new Set();
 for(const [name,bytes] of entries){
  if(!/^ppt\/charts\/[^/]+\.xml$/u.test(name))continue;
  const {root}=readXmlPart(bytes);
  if(root.local!=='chartSpace'||!chartNamespaces.has(root.uri))continue;
  const id=dataRelationship(bytes),rels=entries.get(name.replace(/([^/]+)$/u,'_rels/$1.rels'));
  const relationships=rels?readXmlPart(rels).children.map(r=>r.attributes):[];
  const packages=relationships.filter(r=>[...relationshipNamespaces].some(ns=>r.Type===ns+'/package'));
  if(id===null){if(packages.length)fail();continue;}
  const relation=packages.find(r=>r.Id===id);
  if(!relation||packages.length!==1||relation.TargetMode==='External')fail();
  const workbook=resolveOoxmlTarget(name,relation.Target,'EDITOR_CHART_WORKBOOK');
  if(!embedded.has(workbook)||typeOf(workbook)!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'||
    typeOf(name)!=='application/vnd.openxmlformats-officedocument.drawingml.chart+xml')fail();
  referenced.add(workbook);
 }
 if([...embedded].some(name=>!referenced.has(name)))fail();
}

/** Conservative loss guard over freshly inspected packages. Engine saves may
 * rename parts, so paths are not identities. This catches the known complete
 * workbook-drop regression; it does not certify cells, formulas or chart slots.
 * Intentional workbook removal needs an explicit intent path before admission. */
export function assertOfficeWorkbooksPreserved(previous,next){
 if(previous.format!=='pptx')return;
 const count=document=>document.members.filter(name=>/^ppt\/embeddings\/[^/]+\.xlsx$/u.test(name)).length;
 if(next.format!=='pptx'||count(next)<count(previous))throw Object.assign(Error('EDITOR_STRUCTURE_REFUSED'),{code:'EDITOR_STRUCTURE_REFUSED'});
}
