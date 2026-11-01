/** The bounded Office unit editor: an addressable outline of retained DOCX/XLSX/PPTX bytes, and the deterministic
 * application of a reviewed list of operations to those exact bytes. The package is read with the same strict
 * ZIP/OPC/XML readers the edit-session inspector uses; only the parts that hold a touched unit are rewritten,
 * and inside such a part only the touched element spans change. The result is re-inspected by the caller
 * (`inspectOfficeEdit`) before it can become a version. Nothing here renders, recalculates or regenerates. */
import {readZip,ZIP_LIMITS} from '../structure/zip.mjs';
import {verifyOoxml} from '../structure/ooxml.mjs';
import {writeZip} from './zip-write.mjs';
import {docxUnits,applyDocx} from './docx.mjs';
import {xlsxUnits,applyXlsx} from './xlsx.mjs';
import {pptxUnits,applyPptx} from './pptx.mjs';
import {unitFault} from './faults.mjs';
export {OFFICE_EDIT_UNIT_CODES} from './faults.mjs';
export const OFFICE_OUTLINE_LIMITS=Object.freeze({maxUnits:2000,maxUnitText:20000,maxBytes:20*1024*1024});
const fail=code=>{throw Object.assign(Error(code),{code});};
function open(bytes,format){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>OFFICE_OUTLINE_LIMITS.maxBytes||!['docx','xlsx','pptx'].includes(format))fail('OFFICE_EDIT_SOURCE');
 let entries,main;
 try{entries=readZip(bytes,{...ZIP_LIMITS,maxEntries:5000});main=verifyOoxml(entries,format);}catch{fail('OFFICE_EDIT_SOURCE');}
 return {entries,main};
}
function units(entries,main,format){
 if(format==='docx')return docxUnits(entries.get(main)).units;
 if(format==='xlsx')return xlsxUnits(entries,main).units;
 return pptxUnits(entries,main).units;
}
/** The addressable outline the model reads: unit ids, kinds, current text and whether an operation may target each. */
export function officeOutline(bytes,format){
 const {entries,main}=open(bytes,format);
 let all;try{all=units(entries,main,format);}catch{fail('OFFICE_EDIT_SOURCE');}
 const truncated=all.length>OFFICE_OUTLINE_LIMITS.maxUnits;
 return Object.freeze({format,truncated,units:Object.freeze(all.slice(0,OFFICE_OUTLINE_LIMITS.maxUnits).map(u=>{
  const long=u.text.length>OFFICE_OUTLINE_LIMITS.maxUnitText;
  return Object.freeze({unit:u.unit,kind:u.kind,text:long?u.text.slice(0,OFFICE_OUTLINE_LIMITS.maxUnitText):u.text,editable:u.editable&&!long});
 }))});
}
/** Applies the operations to the exact bytes and returns the rewritten package. Deterministic: the same bytes and
 * the same operations always produce the same output, which is what lets a proposal pin its result digest. */
export function applyOfficeOperations(bytes,format,operations){
 const {entries,main}=open(bytes,format);
 if(!Array.isArray(operations)||!operations.length||operations.length>50)fail('OFFICE_EDIT_OPERATIONS');
 let rewritten;
 try{
  if(format==='docx')rewritten=new Map([[main,applyDocx(entries.get(main),operations)]]);
  else if(format==='xlsx')rewritten=applyXlsx(entries,main,operations);
  else rewritten=applyPptx(entries,main,operations);
 }catch(error){if(typeof error?.unit==='string')throw error;unitFault('OFFICE_EDIT_UNIT_UNSUPPORTED',operations[0]?.unit??'');}
 const out=new Map();for(const [name,content] of entries)out.set(name,rewritten.get(name)??content);
 return writeZip(out);
}
