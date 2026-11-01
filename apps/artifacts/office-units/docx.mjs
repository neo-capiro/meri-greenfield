/** Word paragraphs as addressable units over the retained `word/document.xml`. A unit is one `w:p` in document
 * order (body, tables and nested containers alike), its text the runs' `w:t` characters with tabs rendered as
 * `\t` and every break (line, column or page) as `\n`. Only a paragraph made of plain runs is editable: anything
 * a rebuilt run would silently drop (fields, drawings, content controls, hyperlinks, math, notes, nested
 * paragraphs) keeps the unit readable but refuses an operation.
 *
 * A replacement keeps the paragraph's own `w:pPr` and bookmarks, and keeps every run character outside the
 * changed span with its own run properties and its own break element (a page break stays a page break): only
 * the longest common prefix and suffix of the old and new text are reused, the characters in between are
 * written with the run properties at the change point. Everything outside the touched `w:p` spans is copied
 * character for character. */
import {readXmlSpans,rewriteXmlSpans,escapeXml,prefixFor} from './xml-edit.mjs';
import {unitFault} from './faults.mjs';
export const WORD_NAMESPACES=Object.freeze(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const PARAGRAPH_CHILDREN=new Set(['pPr','r','proofErr','bookmarkStart','bookmarkEnd']);
const RUN_CHILDREN=new Set(['rPr','t','tab','br','cr','lastRenderedPageBreak']);
const word=(e,local)=>WORD_NAMESPACES.includes(e.uri)&&(local===undefined||e.local===local);
/** One character of paragraph text with its run properties and, for a break or tab, the exact element it came from. */
function tokens(text,paragraph){
 const out=[];
 for(const run of paragraph.children){
  if(!word(run,'r'))continue;
  const rPr=run.children.find(c=>word(c,'rPr')),props=rPr?text.slice(rPr.start,rPr.end):'';
  for(const c of run.children){
   if(!word(c))continue;
   if(c.local==='t')for(const ch of c.text)out.push({ch,props,element:null});
   else if(c.local==='tab')out.push({ch:'\t',props,element:text.slice(c.start,c.end)});
   else if(c.local==='br'||c.local==='cr')out.push({ch:'\n',props,element:text.slice(c.start,c.end)});
  }
 }
 return out;
}
/** Preorder walk of every `w:p`, with its text and whether a rebuilt paragraph could keep everything it holds. */
function paragraphs(text,root){
 const found=[];
 const walk=e=>{
  if(word(e,'p')){
   const editable=e.children.every(c=>word(c)&&PARAGRAPH_CHILDREN.has(c.local))&&
    e.children.filter(c=>word(c,'r')).every(r=>r.children.every(x=>word(x)&&RUN_CHILDREN.has(x.local)));
   // A paragraph a rebuilt run could not reproduce is still readable: its text is every descendant `w:t`.
   found.push({element:e,text:editable?tokens(text,e).map(t=>t.ch).join(''):e.text,editable});
  }
  for(const c of e.children)walk(c);
 };
 walk(root);return found;
}
export function docxUnits(part){
 const spans=readXmlSpans(part,{textElements:WORD_NAMESPACES.map(ns=>[ns,'t'])});
 return {spans,units:paragraphs(spans.text,spans.root).map((p,i)=>({unit:`p:${i+1}`,kind:'paragraph',...p}))};
}
/** Serializes a token sequence as runs: consecutive tokens with the same run properties share one run. */
function serializeTokens(sequence,w){
 let out='',run=null,segment='';
 const flushText=()=>{if(segment){run.body+=`<${w}t xml:space="preserve">${escapeXml(segment)}</${w}t>`;segment='';}};
 const flushRun=()=>{if(run){flushText();out+=`<${w}r>${run.props}${run.body}</${w}r>`;run=null;}};
 for(const t of sequence){
  if(!run||run.props!==t.props){flushRun();run={props:t.props,body:''};}
  if(t.element!==null){flushText();run.body+=t.element;}
  else if(t.ch==='\t'){flushText();run.body+=`<${w}tab/>`;}
  else if(t.ch==='\n'){flushText();run.body+=`<${w}br/>`;}
  else segment+=t.ch;
 }
 flushRun();return out;
}
/** The old tokens outside the change plus the new characters inside it, in order. */
function replaced(old,after,fallbackProps){
 const before=old.map(t=>t.ch).join('');
 let prefix=0;while(prefix<before.length&&prefix<after.length&&before[prefix]===after[prefix])prefix++;
 let suffix=0;while(suffix<before.length-prefix&&suffix<after.length-prefix&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
 const props=(old[prefix]??old[prefix-1])?.props??fallbackProps;
 const middle=[...after.slice(prefix,after.length-suffix)].map(ch=>({ch,props,element:null}));
 return [...old.slice(0,prefix),...middle,...old.slice(old.length-suffix)];
}
/** The paragraph properties without a section break: a paragraph inserted after a section-ending one joins its section. */
function inheritedProperties(text,pPr){
 if(!pPr)return '';
 const sectPr=pPr.children.find(c=>word(c,'sectPr'));
 if(!sectPr)return text.slice(pPr.start,pPr.end);
 const kept=text.slice(pPr.start,sectPr.start)+text.slice(sectPr.end,pPr.end);
 return /^<[^>]*><\/[^>]*>$/u.test(kept)?'':kept;
}
/** Applies replace_text / insert_after / delete to Word paragraphs; returns the rewritten part bytes. */
export function applyDocx(part,operations){
 const {spans,units}=docxUnits(part),{text}=spans,byUnit=new Map(units.map(u=>[u.unit,u])),replacements=[],touched=new Set();
 for(const op of operations){
  const u=byUnit.get(op.unit);if(!u)unitFault('OFFICE_EDIT_UNIT_UNKNOWN',op.unit);
  const e=u.element,prefix=prefixFor(text,e,e.uri);if(prefix===null)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
  const w=prefix?prefix+':':'',pPr=e.children.find(c=>word(c,'pPr')),old=u.editable?tokens(text,e):[];
  const firstRPr=e.children.find(c=>word(c,'r'))?.children.find(c=>word(c,'rPr')),firstProps=old[0]?.props??(firstRPr?text.slice(firstRPr.start,firstRPr.end):'');
  if(op.kind==='insert_after'){
   if(!u.editable)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
   const inserted=[...op.after].map(ch=>({ch,props:firstProps,element:null}));
   replacements.push({start:e.end,end:e.end,value:`<${w}p>${inheritedProperties(text,pPr)}${serializeTokens(inserted,w)}</${w}p>`});continue;
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
  const kept=e.children.filter(c=>word(c,'pPr')||word(c,'bookmarkStart')||word(c,'bookmarkEnd')).map(c=>text.slice(c.start,c.end)).join('');
  replacements.push({start:e.start,end:e.end,value:`<${w}p>${kept}${serializeTokens(replaced(old,op.after,firstProps),w)}</${w}p>`});
 }
 return rewriteXmlSpans(spans,replacements);
}
