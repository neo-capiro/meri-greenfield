/** Workbook cells as addressable units: every `c` element of every sheet, addressed `<sheet name>!<A1>`, with
 * its current value resolved through the shared-string table or inline string. A formula cell is readable
 * (its cached value) but never editable: the editor owns formulas and their caches. A replacement rewrites
 * only that `c` element, keeping its reference and style index: a canonical decimal becomes a number (a leading
 * zero, as in an account number or a code, stays text), anything else an inline string, and an empty text clears
 * the value. The shared-string table, every other cell and every other part are copied unchanged, except that
 * the workbook part is marked `fullCalcOnLoad`: a formula depending on an edited cell keeps a stale cached value
 * until an application opens the workbook, and this flag makes that application recompute every formula
 * instead of showing the stale cache. */
import {readXmlSpans,rewriteXmlSpans,escapeXml,prefixFor} from './xml-edit.mjs';
import {readXmlPart} from '../structure/xml.mjs';
import {resolveOoxmlTarget} from '../structure/ooxml.mjs';
import {unitFault} from './faults.mjs';
export const SHEET_NAMESPACES=Object.freeze(['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main']);
const RELATIONSHIP_NAMESPACES=['http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships'];
const WORKSHEET_TYPES=RELATIONSHIP_NAMESPACES.map(ns=>ns+'/worksheet'),SHARED_STRINGS_TYPES=RELATIONSHIP_NAMESPACES.map(ns=>ns+'/sharedStrings');
const sheet=(e,local)=>SHEET_NAMESPACES.includes(e.uri)&&(local===undefined||e.local===local);
const relsOf=part=>part.replace(/([^/]+)$/u,'_rels/$1.rels');
const NUMBER=/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const CALC_ATTRIBUTE=/\sfullCalcOnLoad\s*=\s*(?:"[^"]*"|'[^']*')/u;
/** Workbook children that follow `calcPr` in the schema order; a new `calcPr` goes before the first of them. */
const AFTER_CALC=new Set(['oleSize','customWorkbookViews','pivotCaches','smartTagPr','smartTagTypes','webPublishing','fileRecoveryPr','webPublishObjects','extLst']);
/** The workbook's sheets in `sheets` order with their part names, plus the shared strings part when present. */
export function workbookParts(entries,main){
 const rels=entries.get(relsOf(main));if(!rels)return {sheets:[],sharedStrings:null};
 // The shared reader exposes unqualified attributes only; the sheet's r:id rides the raw tag, so read it here.
 const {text,root}=readXmlSpans(entries.get(main));
 const sheets=[];
 const walk=e=>{if(sheet(e,'sheet')){const open=text.slice(e.start,text.indexOf('>',e.start)+1),m=/\sr:id\s*=\s*"([^"]+)"/u.exec(open)??/\s[\w.-]+:id\s*=\s*"([^"]+)"/u.exec(open);sheets.push({name:e.attributes.name,rId:m?.[1]??null});}for(const c of e.children)walk(c);};
 walk(root);
 const relsById=new Map(),rawRels=readXmlPart(rels,{elementOnlyRoot:true}).children;
 for(const r of rawRels)relsById.set(r.attributes.Id,{type:r.attributes.Type,target:r.attributes.Target,external:r.attributes.TargetMode==='External'});
 const resolved=sheets.map(s=>{const r=s.rId===null?null:relsById.get(s.rId);if(!r||r.external||!WORKSHEET_TYPES.includes(r.type))return null;const part=resolveOoxmlTarget(main,r.target,'OPC_PART_RELATIONSHIPS');return entries.has(part)?{name:s.name,part}:null;}).filter(Boolean);
 const shared=[...relsById.values()].find(r=>!r.external&&SHARED_STRINGS_TYPES.includes(r.type));
 const sharedPart=shared?resolveOoxmlTarget(main,shared.target,'OPC_PART_RELATIONSHIPS'):null;
 return {sheets:resolved,sharedStrings:sharedPart!==null&&entries.has(sharedPart)?sharedPart:null};
}
function sharedStringTable(bytes){
 if(!bytes)return [];
 const {root}=readXmlSpans(bytes,{textElements:SHEET_NAMESPACES.map(ns=>[ns,'t'])});
 return root.children.filter(c=>sheet(c,'si')).map(si=>si.text);
}
function cellValue(c,strings){
 const type=c.attributes.t??'n',v=c.children.find(x=>sheet(x,'v')),f=c.children.find(x=>sheet(x,'f')),is=c.children.find(x=>sheet(x,'is'));
 let text='';
 if(type==='s'){const index=Number(v?.text??'');text=Number.isInteger(index)&&index>=0&&index<strings.length?strings[index]:'';}
 else if(type==='inlineStr')text=is?.text??'';
 else text=v?.text??'';
 return {text,formula:f!==undefined};
}
export function xlsxUnits(entries,main){
 const {sheets,sharedStrings}=workbookParts(entries,main),strings=sharedStringTable(sharedStrings?entries.get(sharedStrings):null),units=[],parts=new Map();
 for(const s of sheets){
  const spans=readXmlSpans(entries.get(s.part),{textElements:SHEET_NAMESPACES.flatMap(ns=>[[ns,'v'],[ns,'t']])});parts.set(s.part,spans);
  const walk=e=>{
   if(sheet(e,'c')&&typeof e.attributes.r==='string'&&e.attributes.r){const {text,formula}=cellValue(e,strings);units.push({unit:`${s.name}!${e.attributes.r}`,kind:'cell',text,editable:!formula,element:e,part:s.part});}
   for(const c of e.children)walk(c);
  };
  walk(spans.root);
 }
 return {units,parts};
}
/** The workbook part with `calcPr fullCalcOnLoad="1"`: set on the existing element, or added in schema order. */
function recalculateOnLoad(entries,main){
 const spans=readXmlSpans(entries.get(main)),{text,root}=spans,prefix=prefixFor(text,root,root.uri);
 if(prefix===null||!sheet(root,'workbook'))unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',main);
 const calc=root.children.find(c=>sheet(c,'calcPr'));
 if(calc){
  const close=text.indexOf('>',calc.start),head=text.slice(calc.start,close),selfClose=head.endsWith('/'),open=selfClose?head.slice(0,-1):head;
  const tag=(CALC_ATTRIBUTE.test(open)?open.replace(CALC_ATTRIBUTE,' fullCalcOnLoad="1"'):open+' fullCalcOnLoad="1"')+(selfClose?'/':'');
  return rewriteXmlSpans(spans,[{start:calc.start,end:close,value:tag}]);
 }
 const next=root.children.find(c=>sheet(c)&&AFTER_CALC.has(c.local)),at=next?next.start:text.lastIndexOf('</',root.end);
 return rewriteXmlSpans(spans,[{start:at,end:at,value:`<${prefix?prefix+':':''}calcPr fullCalcOnLoad="1"/>`}]);
}
/** Applies replace_text to cells; returns Map(part -> rewritten bytes) for every touched sheet and the workbook part. */
export function applyXlsx(entries,main,operations){
 const {units,parts}=xlsxUnits(entries,main),byUnit=new Map(units.map(u=>[u.unit,u])),perPart=new Map(),touched=new Set();
 for(const op of operations){
  const u=byUnit.get(op.unit);if(!u)unitFault('OFFICE_EDIT_UNIT_UNKNOWN',op.unit);
  if(op.kind!=='replace_text'||!u.editable||touched.has(op.unit))unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);touched.add(op.unit);
  if(u.text!==op.before)unitFault('OFFICE_EDIT_UNIT_CHANGED',op.unit);
  const spans=parts.get(u.part),{text}=spans,e=u.element,prefix=prefixFor(text,e,e.uri);if(prefix===null)unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',op.unit);
  const x=prefix?prefix+':':'',style=typeof e.attributes.s==='string'?` s="${escapeXml(e.attributes.s)}"`:'',ref=escapeXml(e.attributes.r);
  const value=op.after===''?`<${x}c r="${ref}"${style}/>`:NUMBER.test(op.after)?`<${x}c r="${ref}"${style}><${x}v>${op.after}</${x}v></${x}c>`:
   `<${x}c r="${ref}"${style} t="inlineStr"><${x}is><${x}t xml:space="preserve">${escapeXml(op.after)}</${x}t></${x}is></${x}c>`;
  if(!perPart.has(u.part))perPart.set(u.part,[]);perPart.get(u.part).push({start:e.start,end:e.end,value});
 }
 const rewritten=new Map([...perPart].map(([part,replacements])=>[part,rewriteXmlSpans(parts.get(part),replacements)]));
 rewritten.set(main,recalculateOnLoad(entries,main));
 return rewritten;
}
