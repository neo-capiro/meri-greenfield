/** Native checks of generated artifacts against a real office suite, run through an admitted renderer port (LibreOffice).
 * They produce evidence records and never change an artifact's inspection flags: a generator's success, a structural check
 * or these records do not by themselves qualify native output; that remains the renderer qualification owner's decision.
 *
 *   openability(bytes, format): the suite opens the file and exports it as a PDF with at least one page.
 *   recalculation(bytes, expected): the suite recalculates a workbook on load and saves it; every formula is preserved and
 *     each expected cell (`'Sheet!B4'`) then stores the expected value.
 *   referenceTotals(bytes, totals): after that recalculation, each total cell equals the sum of its referenced range as
 *     stored by the suite, summed here independently of any formula evaluator.
 * LibreOffice recalculation is not universal Excel equivalence. */
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {admittedConverter} from '../renderer.mjs';
import {runArtifactProcess} from '../process.mjs';
import {pdfPageCount} from '../structure/file-structure.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const reader=fileURLToPath(new URL('./workbook_cells.py',import.meta.url));
const NATIVE_FORMATS=['docx','xlsx','pptx','pdf'],TOLERANCE=1e-9,MAX_BYTES=8388608;

/** `Sheet!A1` -> {sheet, address}. */
function cellRef(ref){const m=/^([^!]{1,31})!([A-Z]{1,3}[1-9][0-9]{0,6})$/u.exec(ref??'');if(!m)fail('NATIVE_CHECK_INPUT');return {sheet:m[1],address:m[2]};}
const column=letters=>[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),letters=n=>{let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
/** `Sheet!B2:C5` -> every address in the rectangle (bounded). */
function rangeCells(ref){
 const m=/^([^!]{1,31})!([A-Z]{1,3})([1-9][0-9]{0,6}):([A-Z]{1,3})([1-9][0-9]{0,6})$/u.exec(ref??'');if(!m)fail('NATIVE_CHECK_INPUT');
 const [c1,c2,r1,r2]=[column(m[2]),column(m[4]),Number(m[3]),Number(m[5])];if(c2<c1||r2<r1||(c2-c1+1)*(r2-r1+1)>10000)fail('NATIVE_CHECK_INPUT');
 const cells=[];for(let c=c1;c<=c2;c++)for(let r=r1;r<=r2;r++)cells.push(letters(c)+r);return {sheet:m[1],cells};
}
const equal=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=TOLERANCE*Math.max(1,Math.abs(b)):a===b;

export function createNativeChecks({renderer,pythonExecutable,tempRoot,timeoutMs=60000}){
 const office=admittedConverter(renderer);
 if(!office||typeof pythonExecutable!=='string'||!isAbsolute(pythonExecutable)||typeof tempRoot!=='string'||!isAbsolute(tempRoot)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)fail('NATIVE_CHECK_CONFIGURATION');
 const deadline=()=>Date.now()+timeoutMs;
 const provenance=receipt=>({qualificationId:receipt.qualificationId,imageDigest:receipt.imageDigest,processGroupAbsent:receipt.process?.groupAbsent??null,exitCode:receipt.process?.exitCode??null});
 async function cells(bytes){
  const dir=await mkdtemp(join(tempRoot,'meri-native-cells-'));
  try{return JSON.parse((await runArtifactProcess(pythonExecutable,['-I','-B',reader],{cwd:dir,input:bytes,deadlineMs:deadline()})).stdout.toString('utf8')).sheets;}
  finally{await rm(dir,{recursive:true,force:true});}
 }
 async function recalculated(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_BYTES)fail('NATIVE_CHECK_INPUT');
  const out=await office.transform({bytes,format:'xlsx',target:'xlsx',deadlineMs:deadline(),maxBytes:MAX_BYTES});
  return {before:await cells(bytes),after:await cells(out.bytes),output:out};
 }
 return Object.freeze({
  async openability({bytes,format}){
   if(!NATIVE_FORMATS.includes(format)||!Buffer.isBuffer(bytes)||bytes.length>MAX_BYTES)fail('NATIVE_CHECK_INPUT');
   const out=await office.transform({bytes,format,target:'pdf',deadlineMs:deadline(),maxBytes:MAX_BYTES}),pages=pdfPageCount(out.bytes);
   return {check:'openability',format,inputSha256:sha(bytes),outputSha256:sha(out.bytes),pages,passed:pages!==null&&pages>=1,...provenance(out.receipt)};
  },
  async recalculation({bytes,expected}){
   const {before,after,output}=await recalculated(bytes),results=[];
   for(const [ref,value] of Object.entries(expected??{})){const {sheet,address}=cellRef(ref),b=before[sheet]?.[address],a=after[sheet]?.[address];
    results.push({cell:ref,formula:a?.formula??null,storedBefore:b?.value??null,storedAfter:a?.value??null,expected:value,passed:Boolean(a?.formula)&&a.formula===b?.formula&&equal(a.value,value)});}
   const formulas=Object.entries(before).flatMap(([sheet,c])=>Object.entries(c).filter(([,x])=>x.formula).map(([address,x])=>({cell:`${sheet}!${address}`,formula:x.formula,preserved:after[sheet]?.[address]?.formula===x.formula})));
   return {check:'formula-recalculation',inputSha256:sha(bytes),outputSha256:sha(output.bytes),cells:results,formulas,formulasPreserved:formulas.every(f=>f.preserved),
    passed:results.length>0&&results.every(r=>r.passed)&&formulas.every(f=>f.preserved),...provenance(output.receipt)};
  },
  async referenceTotals({bytes,totals}){
   const {after,output}=await recalculated(bytes),results=[];
   for(const {total,range} of totals??[]){const t=cellRef(total),r=rangeCells(range),stored=after[t.sheet]?.[t.address];
    const values=r.cells.map(address=>after[r.sheet]?.[address]?.value).filter(x=>x!==undefined&&x!==null);
    const numeric=values.every(x=>typeof x==='number'),sum=numeric?values.reduce((s,x)=>s+x,0):null;
    results.push({total,range,formula:stored?.formula??null,stored:stored?.value??null,independentSum:sum,referencedCells:values.length,passed:numeric&&values.length>0&&Boolean(stored?.formula)&&equal(stored.value,sum)});}
   return {check:'reference-totals',inputSha256:sha(bytes),outputSha256:sha(output.bytes),totals:results,passed:results.length>0&&results.every(r=>r.passed),...provenance(output.receipt)};
  },
 });
}
