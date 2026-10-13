import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createLocalArtifactExecutor} from '../local-executor.mjs';
import {createLibreOfficeTransformer} from '../office-transform.mjs';
import {runArtifactProcess} from '../process.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const soffice='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
const pptx='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs';
const evidence=fileURLToPath(new URL('../../../docs/qualification/candidates/workbook-drafting-20261013/columns-review/',import.meta.url));
const label=process.env.MERI_COLUMNS_REVIEW_LABEL??'unretained';
const sha=b=>createHash('sha256').update(b).digest('hex');
const currency='$#,##0.00';
const request=()=>({operation:'create_excel',format:'xlsx',title:'Synthetic planning',content:{sheets:[{name:'Plan',rows:[[{value:'Workstream'},{value:'Hours'},{value:'Rate'},{value:'Cost'}],[{value:'Research'},{value:10},{value:125,numberFormat:currency},{formula:'=B2*C2',numberFormat:currency}],[{value:'Documentation'},{value:8},{value:100,numberFormat:currency},{formula:'=B3*C3',numberFormat:currency}],[{value:'Total'},{value:null},{value:null},{formula:'=SUM(D2:D3)',numberFormat:currency}]]},{name:'Notes',rows:[[{value:'Synthetic local planning only'}],[{value:'=1+1'}],[{value:'Revise assumptions before approval'}]]}]}});
const py=(script,...args)=>JSON.parse(execFileSync(python,['-I','-B','-c',script,...args],{timeout:15000,maxBuffer:1024*1024,encoding:'utf8'}));
const inspect=path=>py(`import json,sys
from openpyxl import load_workbook
w=load_workbook(sys.argv[1],data_only=False);out={}
for s in w:
 out[s.title]={'widths':{k:v.width for k,v in s.column_dimensions.items()},'cells':{c.coordinate:{'value':c.value,'type':c.data_type,'format':c.number_format} for row in s for c in row if c.value is not None},'charts':len(s._charts),'images':len(s._images)}
w.close();print(json.dumps(out))`,path);
async function owned(body){const root=await mkdtemp(join(tmpdir(),'meri-columns-review-')),receipts=[];try{return await body(root,receipts);}finally{
 for(const r of receipts){assert.equal(r.groupAbsent,true);assert.throws(()=>process.kill(-r.pid,0),e=>e.code==='ESRCH');}
 if(label!=='unretained')await writeFile(join(evidence,label+'-processes-'+root.split('-').at(-1)+'.json'),JSON.stringify(receipts,null,2)+'\n');
 await rm(root,{recursive:true,force:true});await assert.rejects(stat(root),{code:'ENOENT'});
}}
async function retain(name,bytes){if(label!=='unretained')await writeFile(join(evidence,label+'-'+name),bytes);}
const execute=async(root,receipts,req,base=null)=>{const result=await createLocalArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath:pptx,tempRoot:root}).execute({request:req,assets:[],base,deadlineMs:Date.now()+30000,maxBytes:8388608});receipts.push(result.processReceipt);return result;};
async function render(root,receipts,bytes,name){
 const input=join(root,name+'.xlsx'),out=join(root,'pdf-'+name);await mkdir(out);await writeFile(input,bytes);
 const run=await runArtifactProcess(soffice,['-env:UserInstallation='+pathToFileURL(join(root,'profile-'+name)).href,'--headless','--nologo','--nodefault','--norestore','--convert-to','pdf','--outdir',out,input],{cwd:root,input:Buffer.alloc(0),deadlineMs:Date.now()+30000});receipts.push(run.receipt);
 const pdf=join(out,name+'.pdf'),raw=await readFile(pdf);await retain(name+'.pdf',raw);
 const details=py(`import fitz,json,sys
p=fitz.open(sys.argv[1]);result={'pages':len(p),'text':[page.get_text() for page in p],'words':[page.get_text('words') for page in p]}
p[0].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).save(sys.argv[2]);p.close();print(json.dumps(result))`,pdf,join(out,name+'.png'));
 await retain(name+'.png',await readFile(join(out,name+'.png')));await retain(name+'-pdf.json',Buffer.from(JSON.stringify(details,null,2)+'\n'));return details;
}
function readable(pdf,expected){const text=pdf.text.join('\n');for(const value of expected)assert(text.includes(value),'PDF does not contain complete '+value);}
function sameCells(a,b){for(const [name,sheet] of Object.entries(a))assert.deepEqual(b[name].cells,sheet.cells,name+' cell meaning/type/format');}

test('retained fixed input documents the original clipped PDF without modifying input bytes',()=>owned(async(root,receipts)=>{
 const bytes=await readFile(join(evidence,'original-recalculated.xlsx')),digest=sha(bytes);const pdf=await render(root,receipts,bytes,'retained-original');
 assert(pdf.text.join('\n').includes('Research'));assert.equal(sha(await readFile(join(evidence,'original-recalculated.xlsx'))),digest);
 // This immutable old version is intentionally not repaired in place.
 assert(!pdf.text.join('\n').includes('Documentation'),'baseline is no longer the clipped retained input');
}));
test('canonical creation and typed revision render complete labels while retaining formulas and literal text',()=>owned(async(root,receipts)=>{
 const req=request(),made=await execute(root,receipts,req);await retain('created.xlsx',made.bytes);const created=join(root,'created-inspect.xlsx');await writeFile(created,made.bytes);const info=inspect(created);
 const pdf=await render(root,receipts,made.bytes,'created');readable(pdf,['Workstream','Hours','Rate','Cost','Documentation']);
 assert(info.Plan.widths.A>=12&&info.Plan.widths.A<=48.7109375);assert.equal(info.Plan.cells.D4.value,'=SUM(D2:D3)');assert.equal(info.Notes.cells.A2.value,'=1+1');assert.equal(info.Notes.cells.A2.type,'s');
 const revised=structuredClone(req);revised.content.sheets[0].rows[2][0].value='Implementation and documentation';revised.content.sheets[0].rows[2][1].value=12;
 const edit=await execute(root,receipts,revised,{request:req,bytes:made.bytes});assert.equal(edit.inspection.details.revisionMethod,'openpyxl typed-cell replacement');await retain('revised.xlsx',edit.bytes);const rp=join(root,'revised-inspect.xlsx');await writeFile(rp,edit.bytes);const next=inspect(rp);
 assert(next.Plan.widths.A>info.Plan.widths.A);assert(next.Plan.widths.A<=48);assert.equal(next.Plan.cells.D4.value,'=SUM(D2:D3)');assert.equal(next.Plan.cells.D4.format,currency);assert.equal(next.Notes.cells.A2.type,'s');
 readable(await render(root,receipts,edit.bytes,'revised'),['Workstream','Hours','Implementation and documentation']);
 const recalculated=await createLibreOfficeTransformer({executable:soffice,tempRoot:root}).transform({bytes:edit.bytes,format:'xlsx',target:'xlsx',deadlineMs:Date.now()+30000,maxBytes:8388608});receipts.push(recalculated.receipt.process);await retain('revised-recalculated.xlsx',recalculated.bytes);
 const result=join(root,'revised-calculated.xlsx');await writeFile(result,recalculated.bytes);const total=py(`import json,sys
from openpyxl import load_workbook
w=load_workbook(sys.argv[1],data_only=True);print(json.dumps({'total':w['Plan']['D4'].value,'literal':w['Notes']['A2'].value}));w.close()`,result);assert.equal(total.total,2450);assert.equal(total.literal,'=1+1');
}));
test('column bounds do not truncate long literals or turn formula-like strings into formulas',()=>owned(async(root,receipts)=>{
 const req=request(),long='W'.repeat(2000);req.content.sheets[0].rows[1][0].value=long;req.content.sheets[1].rows[0][0].value='=SUM(1,2)';const r=await execute(root,receipts,req);const p=join(root,'long.xlsx');await writeFile(p,r.bytes);const info=inspect(p);
 assert(info.Plan.widths.A>=12&&info.Plan.widths.A<=48.7109375);assert.equal(info.Plan.cells.A2.value,long);assert.equal(info.Notes.cells.A1.type,'s');assert.equal(info.Notes.cells.A1.value,'=SUM(1,2)');
 const shorter=request(),revised=await execute(root,receipts,shorter,{request:req,bytes:r.bytes});const p2=join(root,'short.xlsx');await writeFile(p2,revised.bytes);const next=inspect(p2);assert(next.Plan.widths.A<info.Plan.widths.A);assert.equal(next.Plan.cells.A2.value,'Research');
}));
test('chart rebuild keeps chart and formulas while applying bounded table widths',()=>owned(async(root,receipts)=>{
 const req=request();req.content.sheets[0].charts=[{kind:'bar',title:'Costs',categories:['Research','Documentation'],series:[{name:'Hours',values:[10,8]}]}];
 const r=await execute(root,receipts,req),p=join(root,'chart.xlsx');await writeFile(p,r.bytes);const info=inspect(p);assert.equal(info.Plan.charts,1);assert.equal(info.Plan.cells.D4.value,'=SUM(D2:D3)');assert(info.Plan.widths.A>=12&&info.Plan.widths.A<=48.7109375);
 const edited=structuredClone(req);edited.content.sheets[0].rows[2][0].value='Implementation and documentation';const out=await execute(root,receipts,edited,{request:req,bytes:r.bytes}),p2=join(root,'chart2.xlsx');await writeFile(p2,out.bytes);const next=inspect(p2);assert.equal(next.Plan.charts,1);assert(next.Plan.widths.A>info.Plan.widths.A);assert.equal(next.Plan.cells.D4.value,'=SUM(D2:D3)');
}));
