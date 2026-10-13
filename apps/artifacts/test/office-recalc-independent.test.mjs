import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createLibreOfficeTransformer,officeTransformArguments} from '../office-transform.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const soffice=process.env.MERI_SOFFICE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
const evidence=fileURLToPath(new URL('../../../docs/qualification/candidates/workbook-drafting-20261013/office-review/',import.meta.url));
const source=join(evidence,'original.xlsx');
const sha=b=>createHash('sha256').update(b).digest('hex');
const py=(script,...args)=>JSON.parse(execFileSync(python,['-I','-B','-c',script,...args],{timeout:15000,maxBuffer:1024*1024,encoding:'utf8'}));
const inspectScript=`import json,sys
from openpyxl import load_workbook
w=load_workbook(sys.argv[1],data_only=False); c=load_workbook(sys.argv[1],data_only=True)
out={}
for s in w:
 cells={}
 for row in s:
  for v in row:
   if v.value is not None:
    cells[v.coordinate]={'value':v.value,'type':v.data_type,'cached':c[s.title][v.coordinate].value,'format':v.number_format,'font':[v.font.name,v.font.sz,v.font.bold,v.font.italic],'fill':[v.fill.patternType,v.fill.fgColor.type,v.fill.fgColor.rgb if v.fill.fgColor.type=='rgb' else v.fill.fgColor.indexed],'alignment':[v.alignment.horizontal,v.alignment.vertical,v.alignment.wrap_text]}
 out[s.title]=cells
w.close();c.close();print(json.dumps(out))`;
const inspect=p=>py(inspectScript,p);
async function owned(body){const root=await mkdtemp(join(tmpdir(),'meri-office-review-'));try{return await body(root);}finally{await rm(root,{recursive:true,force:true});await assert.rejects(stat(root),{code:'ENOENT'});}}
const options=bytes=>({bytes,format:'xlsx',target:'xlsx',deadlineMs:Date.now()+30000,maxBytes:8388608});
async function retain(label,bytes,receipt){if(!process.env.MERI_OFFICE_REVIEW_LABEL)return;const stem=process.env.MERI_OFFICE_REVIEW_LABEL+'-'+label;await writeFile(join(evidence,stem+'.xlsx'),bytes);await writeFile(join(evidence,stem+'.json'),JSON.stringify(receipt,null,2)+'\n');}
function assertCellsUnchanged(before,after){
 assert.deepEqual(Object.keys(after),Object.keys(before));
 for(const [sheet,cells]of Object.entries(before)){
  assert.deepEqual(Object.keys(after[sheet]),Object.keys(cells));
  for(const [address,value]of Object.entries(cells)){
   const current=after[sheet][address];assert.equal(current.value,value.value,sheet+address+' value');assert.equal(current.type,value.type,sheet+address+' type');
   assert.deepEqual(current.font,value.font,sheet+address+' font');
   // OOXML quoting and omitted default alignment may differ without changing display.
   assert.equal(current.format.replaceAll('"','').replaceAll('\\',''),value.format.replaceAll('"','').replaceAll('\\',''),sheet+address+' format');
   if(value.fill[0])assert.deepEqual(current.fill,value.fill,sheet+address+' fill');
   value.alignment.forEach((v,i)=>{if(v!==null&&v!==false)assert.equal(current.alignment[i],v,sheet+address+' alignment');});
  }
 }
}
test('exact original workbook recalculates stale cached2050 total with unchanged formula and literal cells',()=>owned(async root=>{
 const bytes=await readFile(source);assert.equal(bytes.length,6002);assert.equal(sha(bytes),'138e70757ad42e160a24d1203fb59712a903f5a36c922fb7bb78b48e2d0a4869');
 const before=inspect(source);assert.equal(before.Plan.D4.cached,0);assert.equal(before.Notes.A2.type,'s');assert.equal(before.Notes.A2.value,'=1+1');
 const transformer=createLibreOfficeTransformer({executable:soffice,tempRoot:root}),result=await transformer.transform(options(bytes));
 await retain('original',result.bytes,result.receipt);const output=join(root,'recalculated.xlsx');await writeFile(output,result.bytes);const after=inspect(output);
 assert.equal(after.Plan.D4.cached,2050);assert.equal(after.Plan.D2.cached,1250);assert.equal(after.Plan.D3.cached,800);assertCellsUnchanged(before,after);
 assert.equal(sha(await readFile(source)),sha(bytes));assert.equal(result.receipt.inputSha256,sha(bytes));assert.equal(result.receipt.outputSha256,sha(result.bytes));assert.equal(result.receipt.nativeQualification,false);assert.equal(result.receipt.formulaEquivalence,'unqualified');assert.equal(result.receipt.process.groupAbsent,true);
 assert.deepEqual(await readdir(root),['recalculated.xlsx']);
}));
test('independent workbook preserves styled literals and formulas while computing arithmetic',()=>owned(async root=>{
 const input=join(root,'styled.xlsx');py(`import json,sys
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment
w=Workbook();s=w.active;s.title='Budget';s['A1']=12;s['B1']=7.5;s['C1']='=A1*B1';s['C2']='=SUM(C1,10)';s['D1']='=SUM(9,9)';s['D1'].data_type='s'
for p in ['A1','B1','C1','C2','D1']:
 c=s[p];c.font=Font(name='Arial',size=12,bold=True,italic=True);c.fill=PatternFill('solid',fgColor='FFFFCC00');c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
s['C1'].number_format='0.00';s['C2'].number_format='0.00';w.save(sys.argv[1]);w.close();print('{}')`,input);
 const before=inspect(input),bytes=await readFile(input),result=await createLibreOfficeTransformer({executable:soffice,tempRoot:root}).transform(options(bytes));
 await retain('styled',result.bytes,result.receipt);const output=join(root,'styled-result.xlsx');await writeFile(output,result.bytes);const after=inspect(output);
 assert.equal(after.Budget.C1.cached,90);assert.equal(after.Budget.C2.cached,100);assert.equal(after.Budget.D1.cached,'=SUM(9,9)');assertCellsUnchanged(before,after);assert.equal(result.receipt.process.groupAbsent,true);
 assert.deepEqual((await readdir(root)).sort(),['styled-result.xlsx','styled.xlsx']);
}));
async function spy(root,{fail=false,park=false}={}){
 const path=join(root,'spy.mjs'),log=join(root,'spy.json');await writeFile(path,`#!${process.execPath}\nimport fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';\nconst args=process.argv.slice(2),profile=fileURLToPath(args[0].slice('-env:UserInstallation='.length)),p=path.join(profile,'user','registrymodifications.xcu');\nfs.writeFileSync(${JSON.stringify(log)},JSON.stringify({args,profile,xml:fs.existsSync(p)?fs.readFileSync(p,'utf8'):null,mode:fs.existsSync(p)?fs.statSync(p).mode&511:null}));\n${park?'setInterval(()=>{},1000);':fail?'process.exit(7);':`const target=args[args.indexOf('--convert-to')+1],out=args[args.indexOf('--outdir')+1];fs.writeFileSync(path.join(out,'input.'+target),target==='pdf'?Buffer.from('%PDF-synthetic'):fs.readFileSync(args.at(-1)));`}\n`,{mode:0o700});return {path,log};
}
test('fixed XLSX profile is private and cannot be supplied by document arguments',()=>owned(async root=>{
 const fixture=await spy(root),bytes=await readFile(source);await createLibreOfficeTransformer({executable:fixture.path,tempRoot:root}).transform({...options(bytes),config:'arbitrary'});
 const observed=JSON.parse(await readFile(fixture.log));assert.match(observed.xml,/oor:path="\/org\.openoffice\.Office\.Calc\/Formula\/Load"/);assert.match(observed.xml,/oor:name="OOXMLRecalcMode"[\s\S]*?<value>0<\/value>/);assert.equal(observed.mode,0o600);
 assert(!observed.args.some(x=>x.includes('arbitrary')));assert.deepEqual(observed.args,officeTransformArguments({workspace:join(observed.profile,'..'),format:'xlsx',target:'xlsx'}));await assert.rejects(stat(observed.profile),{code:'ENOENT'});
}));
test('DOCX conversion keeps exact arguments and does not install XLSX configuration',()=>owned(async root=>{
 const fixture=await spy(root);await createLibreOfficeTransformer({executable:fixture.path,tempRoot:root}).transform({...options(Buffer.from('synthetic-docx')),format:'docx',target:'pdf'});
 const o=JSON.parse(await readFile(fixture.log)),workspace=join(o.profile,'..');assert.equal(o.xml,null);
 assert.deepEqual(o.args,['-env:UserInstallation='+pathToFileURL(join(workspace,'profile')).href,'--headless','--nologo','--nodefault','--norestore','--convert-to','pdf','--outdir',join(workspace,'out'),join(workspace,'input.docx')]);
 await assert.rejects(stat(o.profile),{code:'ENOENT'});
}));
test('failed owned process removes recalculation profile/workspace',()=>owned(async root=>{
 const s=await spy(root,{fail:true});await assert.rejects(createLibreOfficeTransformer({executable:s.path,tempRoot:root}).transform(options(await readFile(source))),e=>e.code==='ARTIFACT_PROCESS_FAILED'&&e.receipt.groupAbsent===true);
 const o=JSON.parse(await readFile(s.log));await assert.rejects(stat(o.profile),{code:'ENOENT'});assert.deepEqual((await readdir(root)).sort(),['spy.json','spy.mjs']);
}));
test('cancelled parked process closes its group and removes XLSX profile',()=>owned(async root=>{
 const s=await spy(root,{park:true}),ac=new AbortController(),pending=createLibreOfficeTransformer({executable:s.path,tempRoot:root}).transform({...options(await readFile(source)),signal:ac.signal});
 const deadline=Date.now()+3000;while(true){try{await stat(s.log);break;}catch(e){if(e.code!=='ENOENT'||Date.now()>deadline)throw e;await new Promise(r=>setTimeout(r,10));}}
 ac.abort();await assert.rejects(pending,e=>e.code==='ARTIFACT_CANCELLED'&&e.receipt.groupAbsent===true);const o=JSON.parse(await readFile(s.log));await assert.rejects(stat(o.profile),{code:'ENOENT'});
}));
test('unsupported conversion refuses without leaving an owned workspace',()=>owned(async root=>{
 await assert.rejects(createLibreOfficeTransformer({executable:soffice,tempRoot:root}).transform({...options(Buffer.from('x')),target:'csv'}),{code:'ARTIFACT_TRANSFORM_UNSUPPORTED'});assert.deepEqual(await readdir(root),[]);
}));
