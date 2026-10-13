import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createLibreOfficeTransformer,officeTransformArguments} from '../office-transform.mjs';
import {runArtifactProcess} from '../process.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const soffice='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
const hash=b=>createHash('sha256').update(b).digest('hex');
const inspect=`import io,json,sys,openpyxl
b=sys.stdin.buffer.read();f=openpyxl.load_workbook(io.BytesIO(b),data_only=False);v=openpyxl.load_workbook(io.BytesIO(b),data_only=True)
print(json.dumps({s.title:[{'cell':c.coordinate,'value':c.value,'type':c.data_type,'cached':v[s.title][c.coordinate].value,'numberFormat':c.number_format,'bold':bool(c.font.bold)} for row in s.iter_rows() for c in row] for s in f.worksheets},allow_nan=False))`;
const generate=`import io,sys,xlsxwriter
b=io.BytesIO();w=xlsxwriter.Workbook(b,{'in_memory':True});s=w.add_worksheet('Budget');bold=w.add_format({'bold':True});money=w.add_format({'num_format':'0.00'});s.write_string('A1','=1+1',bold);s.write_string('A2','Literal formula text');s.write_number('D2',1000,money);s.write_number('D3',1050,money);s.write_formula('D4','=SUM(D2:D3)',money);s.write_formula('E4','=D4*2',money);w.close();sys.stdout.buffer.write(b.getvalue())`;
async function fixture(t,name){const root=await mkdtemp(join(tmpdir(),'meri-office-recalc-')),receipts=[];t.after(async()=>{await rm(root,{recursive:true,force:true});if(process.env.OFFICE_EVIDENCE_DIR){const evidence=resolve(process.env.OFFICE_EVIDENCE_DIR);await mkdir(evidence,{recursive:true});await writeFile(join(evidence,name+'-processes.json'),JSON.stringify(receipts,null,2)+'\n');}});return {root,receipts};}
async function py(f,script,input=Buffer.alloc(0)){const result=await runArtifactProcess(python,['-c',script],{cwd:f.root,input,deadlineMs:Date.now()+20000});f.receipts.push(result.receipt);return result.stdout;}
async function retain(name,bytes){if(process.env.OFFICE_EVIDENCE_DIR){await mkdir(resolve(process.env.OFFICE_EVIDENCE_DIR),{recursive:true});await writeFile(join(resolve(process.env.OFFICE_EVIDENCE_DIR),name),bytes);}}
for(const variant of ['original','independent'])test(`actual LibreOffice recalculates ${variant} XLSX while preserving formulas and literal cells`,async t=>{
 const f=await fixture(t,variant),input=variant==='original'?await readFile(new URL('../../../docs/qualification/candidates/workbook-drafting-20261013/office-author/original.xlsx',import.meta.url)):await py(f,generate),originalHash=hash(input);
 const before=JSON.parse(await py(f,inspect,input));await retain(variant+'-input.xlsx',input);
 const converted=await createLibreOfficeTransformer({executable:soffice,tempRoot:f.root}).transform({bytes:input,format:'xlsx',target:'xlsx',deadlineMs:Date.now()+30000,maxBytes:1048576});f.receipts.push(converted.receipt.process);
 await retain(variant+'-output.xlsx',converted.bytes);const after=JSON.parse(await py(f,inspect,converted.bytes));await retain(variant+'-inspection.json',Buffer.from(JSON.stringify({before,after,inputSha256:originalHash,outputSha256:hash(converted.bytes),receipt:converted.receipt},null,2)+'\n'));
 assert.equal(hash(input),originalHash);assert.equal(converted.receipt.inputSha256,originalHash);assert.equal(converted.receipt.nativeQualification,false);assert.equal(converted.receipt.formulaEquivalence,'unqualified');assert.equal(converted.receipt.process.groupAbsent,true);
 assert.deepEqual(Object.keys(after),Object.keys(before));
 for(const sheet of Object.keys(before)){assert.deepEqual(after[sheet].map(c=>[c.cell,c.value,c.type]),before[sheet].map(c=>[c.cell,c.value,c.type]));}
 const sheet=Object.keys(before)[0],byCell=(view,c)=>view[sheet].find(row=>row.cell===c);
 assert.equal(byCell(before,'D4').cached,0);assert.equal(byCell(after,'D4').cached,2050);
 if(variant==='independent'){assert.equal(byCell(after,'A1').value,'=1+1');assert.equal(byCell(after,'A1').type,'s');assert.equal(byCell(after,'A1').cached,'=1+1');assert.equal(byCell(after,'A1').bold,true);assert.equal(byCell(after,'D4').value,'=SUM(D2:D3)');assert.equal(byCell(after,'D4').numberFormat,'0.00');assert.equal(byCell(after,'E4').cached,4100);}
 assert.deepEqual(await readdir(f.root),[]);
});
test('Word argument contract remains exact and unsupported transform is rejected',()=>{
 assert.deepEqual(officeTransformArguments({workspace:'/tmp/owned',format:'docx',target:'pdf'}),['-env:UserInstallation=file:///tmp/owned/profile','--headless','--nologo','--nodefault','--norestore','--convert-to','pdf','--outdir','/tmp/owned/out','/tmp/owned/input.docx']);
 assert.throws(()=>officeTransformArguments({workspace:'/tmp/owned',format:'txt',target:'xlsx'}));
});
