/** Slide text shapes as addressable units: every `p:sp` with a `p:txBody`, in presentation slide order, addressed
 * `slide:<n>/shape:<cNvPr id>`; its text is the body's paragraphs joined by `\n` (a line break inside a paragraph
 * also reads as `\n`). A shape whose text comes from a field (slide number, date) or whose body carries anything
 * other than plain runs is readable but not editable. A replacement rewrites only that `p:txBody`, keeping its
 * `a:bodyPr` and `a:lstStyle`, the first paragraph's `a:pPr` and the first run's `a:rPr`; every other shape,
 * slide and part is copied unchanged. Charts, tables, pictures and notes are never touched.
 *
 * A shape kept in both branches of `mc:AlternateContent` (`mc:Choice` and `mc:Fallback`) is one unit: the outline
 * reads the Choice copy and a replacement rewrites both copies, so no application ever shows the old text. A
 * shape that exists only in a Fallback mirrors something that is not text in the Choice, and two unrelated shapes
 * with one id are ambiguous: both are readable but refuse an operation. */
import {readXmlSpans,rewriteXmlSpans,escapeXml,prefixFor} from './xml-edit.mjs';
import {readXmlPart} from '../structure/xml.mjs';
import {resolveOoxmlTarget} from '../structure/ooxml.mjs';
import {unitFault} from './faults.mjs';
export const PRESENTATION_NAMESPACES=Object.freeze(['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main']);
export const DRAWING_NAMESPACES=Object.freeze(['http://schemas.openxmlformats.org/drawingml/2006/main','http://purl.oclc.org/ooxml/drawingml/main']);
const COMPATIBILITY_NAMESPACE='http://schemas.openxmlformats.org/markup-compatibility/2006';
const RELATIONSHIP_NAMESPACES=['http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships'];
const SLIDE_TYPES=RELATIONSHIP_NAMESPACES.map(ns=>ns+'/slide');
const pml=(e,local)=>PRESENTATION_NAMESPACES.includes(e.uri)&&(local===undefined||e.local===local);
const dml=(e,local)=>DRAWING_NAMESPACES.includes(e.uri)&&(local===undefined||e.local===local);
const relsOf=part=>part.replace(/([^/]+)$/u,'_rels/$1.rels');
const PARAGRAPH_CHILDREN=new Set(['pPr','r','br','endParaRPr']);
const RUN_CHILDREN=new Set(['rPr','t']);
/** Slide parts in `p:sldIdLst` order. */
export function slideParts(entries,main){
 const rels=entries.get(relsOf(main));if(!rels)return [];
 const relsById=new Map(readXmlPart(rels,{elementOnlyRoot:true}).children.map(r=>[r.attributes.Id,{type:r.attributes.Type,target:r.attributes.Target,external:r.attributes.TargetMode==='External'}]));
 const {text,root}=readXmlSpans(entries.get(main)),ids=[];
 const walk=e=>{if(pml(e,'sldId')){const open=text.slice(e.start,text.indexOf('>',e.start)+1),m=/\s[\w.-]+:id\s*=\s*"([^"]+)"/u.exec(open);ids.push(m?.[1]??null);}for(const c of e.children)walk(c);};
 walk(root);
 return ids.map(id=>{const r=id===null?null:relsById.get(id);if(!r||r.external||!SLIDE_TYPES.includes(r.type))return null;const part=resolveOoxmlTarget(main,r.target,'OPC_PART_RELATIONSHIPS');return entries.has(part)?part:null;}).filter(Boolean);
}
function paragraphText(p){
 let text='';
 for(const c of p.children){if(dml(c,'r')||dml(c,'fld'))text+=c.text;else if(dml(c,'br'))text+='\n';}
 return text;
}
export function pptxUnits(entries,main){
 const units=[],parts=new Map();
 for(const [index,part] of slideParts(entries,main).entries()){
  const spans=readXmlSpans(entries.get(part),{textElements:DRAWING_NAMESPACES.map(ns=>[ns,'t'])});parts.set(part,spans);
  const byUnit=new Map();
  const walk=(e,fallback)=>{
   if(pml(e,'sp')){
    const body=e.children.find(c=>pml(c,'txBody')),id=e.children.find(c=>pml(c,'nvSpPr'))?.children.find(c=>pml(c,'cNvPr'))?.attributes.id;
    if(body&&typeof id==='string'&&id){
     const paragraphs=body.children.filter(c=>dml(c,'p'));
     const editable=body.children.every(c=>dml(c)&&['bodyPr','lstStyle','p'].includes(c.local))&&paragraphs.every(p=>p.children.every(c=>dml(c)&&PARAGRAPH_CHILDREN.has(c.local))&&p.children.filter(c=>dml(c,'r')).every(r=>r.children.every(c=>dml(c)&&RUN_CHILDREN.has(c.local))));
     const unit=`slide:${index+1}/shape:${id}`,existing=byUnit.get(unit);
     if(existing===undefined){const u={unit,kind:'shape',text:paragraphs.map(paragraphText).join('\n'),editable:editable&&!fallback,bodies:[body],part,fallback};byUnit.set(unit,u);units.push(u);}
     else if(fallback&&!existing.fallback){existing.bodies.push(body);existing.editable=existing.editable&&editable;}
     else existing.editable=false;
    }
   }
   for(const c of e.children)walk(c,fallback||c.uri===COMPATIBILITY_NAMESPACE&&c.local==='Fallback');
  };
  walk(spans.root,false);
 }
 return {units,parts};
}
/** Applies replace_text to slide shapes; returns Map(part -> rewritten bytes) for every touched slide. */
export function applyPptx(entries,main,operations){
 const {units,parts}=pptxUnits(entries,main),byUnit=new Map(units.map(u=>[u.unit,u])),perPart=new Map(),touched=new Set();
 for(const op of operations){
  const u=byUnit.get(op.unit);if(!u)unitFault('OFFICE_EDIT_UNIT_UNKNOWN',op.unit);
  if(op.kind!=='replace_text'||!u.editable||touched.has(op.unit))unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);touched.add(op.unit);
  if(u.text!==op.before)unitFault('OFFICE_EDIT_UNIT_CHANGED',op.unit);
  const spans=parts.get(u.part),{text}=spans;
  for(const body of u.bodies){
   const aPrefix=prefixFor(text,body,DRAWING_NAMESPACES.find(ns=>body.children.some(c=>c.uri===ns))??DRAWING_NAMESPACES[0]);
   const pPrefix=prefixFor(text,body,body.uri);if(aPrefix===null||pPrefix===null)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
   const a=aPrefix?aPrefix+':':'',p=pPrefix?pPrefix+':':'';
   const keep=body.children.filter(c=>dml(c,'bodyPr')||dml(c,'lstStyle')).map(c=>text.slice(c.start,c.end)).join('');
   const first=body.children.find(c=>dml(c,'p')),pPr=first?.children.find(c=>dml(c,'pPr')),rPr=first?.children.find(c=>dml(c,'r'))?.children.find(c=>dml(c,'rPr'))??first?.children.find(c=>dml(c,'endParaRPr'));
   const pPrXml=pPr?text.slice(pPr.start,pPr.end):'',rPrXml=rPr?text.slice(rPr.start,rPr.end).replace(/^<([\w.-]+:)?endParaRPr/u,`<${a}rPr`).replace(/endParaRPr>$/u,'rPr>'):'';
   const lines=op.after.split('\n').map(line=>line?`<${a}p>${pPrXml}<${a}r>${rPrXml}<${a}t>${escapeXml(line)}</${a}t></${a}r></${a}p>`:`<${a}p>${pPrXml}</${a}p>`).join('');
   if(!perPart.has(u.part))perPart.set(u.part,[]);perPart.get(u.part).push({start:body.start,end:body.end,value:`<${p}txBody>${keep}${lines}</${p}txBody>`});
  }
 }
 return new Map([...perPart].map(([part,replacements])=>[part,rewriteXmlSpans(parts.get(part),replacements)]));
}
