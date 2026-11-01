/** Word paragraphs as addressable units over the retained `word/document.xml`. A unit is one `w:p` in document
 * order (body, tables and nested containers alike), its text the runs' `w:t` characters with tabs and breaks
 * rendered as `\t` and `\n`. Only a paragraph made of plain runs is editable: anything that a rebuilt run
 * would silently drop (fields, drawings, content controls, hyperlinks, math, notes, nested paragraphs) keeps
 * the unit readable but refuses an operation. A replacement keeps the paragraph's own `w:pPr` and the first
 * run's `w:rPr`, so style, numbering and section breaks survive; everything outside the touched `w:p` spans
 * is copied character for character. */
import {readXmlSpans,rewriteXmlSpans,escapeXml,prefixFor} from './xml-edit.mjs';
import {unitFault} from './faults.mjs';
export const WORD_NAMESPACES=Object.freeze(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const PARAGRAPH_CHILDREN=new Set(['pPr','r','proofErr','bookmarkStart','bookmarkEnd']);
const RUN_CHILDREN=new Set(['rPr','t','tab','br','cr','lastRenderedPageBreak']);
const word=(e,local)=>WORD_NAMESPACES.includes(e.uri)&&(local===undefined||e.local===local);
function runText(run){
 let out='';
 for(const c of run.children){if(!word(c))continue;if(c.local==='t')out+=c.text;else if(c.local==='tab')out+='\t';else if(c.local==='br'||c.local==='cr')out+='\n';}
 return out;
}
/** Preorder walk of every `w:p`, with its text and whether a rebuilt paragraph could keep everything it holds. */
function paragraphs(root){
 const found=[];
 const walk=e=>{
  if(word(e,'p')){
   let text='',editable=e.children.every(c=>word(c)&&PARAGRAPH_CHILDREN.has(c.local));
   for(const c of e.children){
    if(!word(c,'r'))continue;
    if(!c.children.every(x=>word(x)&&RUN_CHILDREN.has(x.local)))editable=false;
    text+=runText(c);
   }
   // A paragraph a rebuilt run could not reproduce is still readable: its text is every descendant `w:t`.
   found.push({element:e,text:editable?text:e.text,editable});
  }
  for(const c of e.children)walk(c);
 };
 walk(root);return found;
}
export function docxUnits(part){
 const spans=readXmlSpans(part,{textElements:WORD_NAMESPACES.map(ns=>[ns,'t'])});
 return {spans,units:paragraphs(spans.root).map((p,i)=>({unit:`p:${i+1}`,kind:'paragraph',...p}))};
}
function serializeRuns(text,prefix,rPr){
 const w=prefix?prefix+':':'';let out='';
 for(const [i,line] of text.split('\n').entries()){
  if(i>0)out+=`<${w}r>${rPr}<${w}br/></${w}r>`;
  for(const [j,piece] of line.split('\t').entries()){
   if(j>0)out+=`<${w}r>${rPr}<${w}tab/></${w}r>`;
   if(piece)out+=`<${w}r>${rPr}<${w}t xml:space="preserve">${escapeXml(piece)}</${w}t></${w}r>`;
  }
 }
 return out;
}
/** Applies replace_text / insert_after / delete to Word paragraphs; returns the rewritten part bytes. */
export function applyDocx(part,operations){
 const {spans,units}=docxUnits(part),{text}=spans,byUnit=new Map(units.map(u=>[u.unit,u])),replacements=[],touched=new Set();
 for(const op of operations){
  const u=byUnit.get(op.unit);if(!u)unitFault('OFFICE_EDIT_UNIT_UNKNOWN',op.unit);
  const e=u.element,prefix=prefixFor(text,e,e.uri);if(prefix===null)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
  const w=prefix?prefix+':':'',pPr=e.children.find(c=>word(c,'pPr')),firstRun=e.children.find(c=>word(c,'r')),rPrElement=firstRun?.children.find(c=>word(c,'rPr'));
  const pPrXml=pPr?text.slice(pPr.start,pPr.end):'',rPrXml=rPrElement?text.slice(rPrElement.start,rPrElement.end):'';
  if(op.kind==='insert_after'){
   if(!u.editable)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
   replacements.push({start:e.end,end:e.end,value:`<${w}p>${pPrXml}${serializeRuns(op.after,prefix,rPrXml)}</${w}p>`});continue;
  }
  if(touched.has(op.unit))unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);touched.add(op.unit);
  if(!u.editable)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
  if(u.text!==op.before)unitFault('OFFICE_EDIT_UNIT_CHANGED',op.unit);
  if(op.kind==='delete'){
   // A section break lives in the paragraph's own properties, and a table cell needs at least one paragraph.
   const sectionBreak=pPr?.children.some(c=>word(c,'sectPr')),lastInCell=word(e.parent??{},'tc')&&e.parent.children.filter(c=>word(c,'p')).length===1;
   if(sectionBreak||lastInCell)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
   replacements.push({start:e.start,end:e.end,value:''});continue;
  }
  const kept=e.children.filter(c=>word(c,'bookmarkStart')||word(c,'bookmarkEnd')).map(c=>text.slice(c.start,c.end)).join('');
  replacements.push({start:e.start,end:e.end,value:`<${w}p>${pPrXml}${kept}${serializeRuns(op.after,prefix,rPrXml)}</${w}p>`});
 }
 return rewriteXmlSpans(spans,replacements);
}
