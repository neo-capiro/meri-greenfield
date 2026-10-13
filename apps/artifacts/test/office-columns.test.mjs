import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createLocalArtifactExecutor} from '../local-executor.mjs';
import {createLibreOfficeTransformer} from '../office-transform.mjs';
import {runArtifactProcess} from '../process.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const soffice='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
const value=value=>({value}),money={numberFormat:'$#,##0.00'};
function draft(){return {operation:'create_excel',format:'xlsx',title:'Synthetic plan',content:{sheets:[{name:'Plan',rows:[['Workstream','Hours','Rate','Cost'].map(value),[value('Research'),value(10),{value:125,...money},{formula:'=B2*C2',...money}],[value('Documentation'),value(8),{value:100,...money},{formula:'=B3*C3',...money}],[value('Total'),value(null),value(null),{formula:'=SUM(D2:D3)',...money}]]},{name:'Notes',rows:[[value('=1+1')],[value('Synthetic local planning only')]]}]}};}
const inspect=`import io,json,sys,openpyxl
raw=sys.stdin.buffer.read();w=openpyxl.load_workbook(io.BytesIO(raw),data_only=False);v=openpyxl.load_workbook(io.BytesIO(raw),data_only=True)
print(json.dumps({s.title:{'widths':{k:{'width':d.width,'min':d.min,'max':d.max} for k,d in s.column_dimensions.items()},'cells':{c.coordinate:{'value':c.value,'type':c.data_type,'format':c.number_format,'cached':v[s.title][c.coordinate].value} for row in s for c in row}} for s in w},allow_nan=False))`;
const pdfInspect=`import sys,json,fitz
with fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf') as d:
 assert 1<=len(d)<=8
 pages=[]
 for i,p in enumerate(d):
  image=p.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False);name='page-'+str(i+1)+'.png';image.save(name);pages.append({'text':p.get_text(),'png':name})
 print(json.dumps({'pages':pages,'nativeQualified':False}))`;
async function fixture(t,name){const root=await mkdtemp(join(tmpdir(),'meri-office-columns-')),receipts=[];const dir=process.env.OFFICE_COLUMNS_EVIDENCE_DIR?resolve(process.env.OFFICE_COLUMNS_EVIDENCE_DIR):null;
 async function retain(file,bytes){if(dir){await mkdir(dir,{recursive:true});await writeFile(join(dir,name+'-'+file),bytes);}}
 t.after(async()=>{await rm(root,{recursive:true,force:true});await retain('processes.json',JSON.stringify({rootRemoved:true,receipts},null,2)+'\n');});
 const executor=createLocalArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:join(root,'unused-presentation-module'),tempRoot:root});
 async function generate(request,base=null){const result=await executor.execute({request,assets:[],base,deadlineMs:Date.now()+30000,maxBytes:8388608});receipts.push(result.processReceipt);return result;}
 async function py(script,bytes,cwd=root){const r=await runArtifactProcess(python,['-I','-B','-c',script],{cwd,input:bytes,deadlineMs:Date.now()+20000,maxOutput:1048576});receipts.push(r.receipt);return JSON.parse(r.stdout);}
 return {root,receipts,retain,generate,py};}
for(const phase of ['create','revise'])test(`${phase}: actual canonical XLSX and PDF retain full labels, currency, formulas and literals`,async t=>{
 const f=await fixture(t,phase),request=draft(),first=await f.generate(request);let result=first,expected=2050,label='Documentation';
 if(phase==='revise'){const changed=structuredClone(request);changed.content.sheets[0].rows[1][1].value=12;label='Documentation review';changed.content.sheets[0].rows[2][0].value=label;result=await f.generate(changed,{request,bytes:first.bytes});expected=2300;assert.equal(result.inspection.details.revisionMethod,'openpyxl typed-cell replacement');}
 await f.retain('generated.xlsx',result.bytes);const before=await f.py(inspect,result.bytes);await f.retain('generated.json',JSON.stringify(before,null,2)+'\n');
 const converted=await createLibreOfficeTransformer({executable:soffice,tempRoot:f.root}).transform({bytes:result.bytes,format:'xlsx',target:'xlsx',deadlineMs:Date.now()+30000,maxBytes:8388608});f.receipts.push(converted.receipt.process);await f.retain('recalculated.xlsx',converted.bytes);const after=await f.py(inspect,converted.bytes);
 const pdfRoot=join(f.root,'pdf');await mkdir(join(pdfRoot,'out'),{recursive:true});await writeFile(join(pdfRoot,'input.xlsx'),converted.bytes);
 const conversion=await runArtifactProcess(soffice,['-env:UserInstallation='+pathToFileURL(join(pdfRoot,'profile')).href,'--headless','--nologo','--nodefault','--norestore','--convert-to','pdf:calc_pdf_Export','--outdir',join(pdfRoot,'out'),join(pdfRoot,'input.xlsx')],{cwd:pdfRoot,input:Buffer.alloc(0),deadlineMs:Date.now()+30000});f.receipts.push(conversion.receipt);
 const pdf=await readFile(join(pdfRoot,'out','input.pdf'));await f.retain('output.pdf',pdf);const visual=await f.py(pdfInspect,pdf,pdfRoot);await f.retain('visual.json',JSON.stringify({after,visual},null,2)+'\n');for(const p of visual.pages)await f.retain(p.png,await readFile(join(pdfRoot,p.png)));
 const text=visual.pages.map(p=>p.text).join('\n');assert.match(text,/Workstream/);assert.match(text,/\bHours\b/);assert.ok(text.includes(label),text);assert.ok(text.includes(expected===2050?'2,050.00':'2,300.00'),text);
 assert.equal(after.Plan.cells.D4.cached,expected);assert.equal(before.Plan.cells.D4.value,'=SUM(D2:D3)');assert.equal(before.Plan.cells.D4.type,'f');assert.equal(before.Plan.cells.D4.format,'$#,##0.00');assert.equal(before.Notes.cells.A1.value,'=1+1');assert.equal(before.Notes.cells.A1.type,'s');assert.equal(after.Notes.cells.A1.cached,'=1+1');
 assert.ok(before.Plan.widths.A.width>=16);assert.ok(Object.values(before.Plan.widths).every(d=>d.width>=12&&d.width<=49));assert.ok(f.receipts.every(r=>r.groupAbsent===true));
});
test('bounded widths survive changed long literals and formula source is not treated as its display value',async t=>{
 const f=await fixture(t,'bounds'),request=draft();request.content.sheets=[{name:'Bounds',rows:[[value('A'),value('x'.repeat(600)),{formula:'='+Array(100).fill('1').join('+')}],[value('line one\nline two'),value('=1+1'),{value:1234567.89,...money}]]}];
 const first=await f.generate(request),before=await f.py(inspect,first.bytes);await f.retain('creation.json',JSON.stringify(before,null,2)+'\n');
 const changed=structuredClone(request);changed.content.sheets[0].rows[0][0].value='w'.repeat(600);changed.content.sheets[0].rows[0][1].value='short';const revised=await f.generate(changed,{request,bytes:first.bytes}),after=await f.py(inspect,revised.bytes);await f.retain('revision.json',JSON.stringify(after,null,2)+'\n');
 assert.ok(before.Bounds.widths.B.width>=48&&before.Bounds.widths.B.width<49);assert.ok(before.Bounds.widths.C.width<32);assert.equal(after.Bounds.widths.A.width,48);assert.ok(after.Bounds.widths.B.width<20);assert.ok(Object.values(after.Bounds.widths).every(d=>d.width>=12&&d.width<=48));assert.equal(after.Bounds.cells.B2.value,'=1+1');assert.equal(after.Bounds.cells.B2.type,'s');assert.equal(after.Bounds.cells.C1.value,request.content.sheets[0].rows[0][2].formula);assert.equal(after.Bounds.cells.C2.format,'$#,##0.00');assert.deepEqual(await readdir(f.root),[]);
});
