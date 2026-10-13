import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {main} from '../../../../../scripts/local-workbook/run.mjs';
import {inspectWorkbook,inspectWorkbookCopies,workbookCell} from '../../../../../apps/control/document-application/local/workbook/inspection.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
async function owned(fn){const dir=await mkdtemp(join(tmpdir(),'workbook-flow-independent-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});await assert.rejects(access(dir));}}
async function invoke(args){let text='';const status=await main(args,x=>{text+=x;});return {status,body:JSON.parse(text)};}
test('foreign source-root configuration refuses before output creation and preserves environment',()=>owned(async dir=>{
 const prior=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=dir;
 try{const output=join(dir,'unused'),v=await invoke(['--run','--python',process.execPath,'--soffice',process.execPath,'--output',output]);assert.equal(v.status,1);assert.equal(v.body.failure.message,'LOCAL_WORKBOOK_CONFIGURATION');assert.deepEqual(v.body.cleanup.fixtures,[]);assert.equal(v.body.cleanup.http,null);await assert.rejects(access(output));assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,dir);}
 finally{if(prior===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=prior;}
}));
test('missing executable refuses before output or borrowed resource mutation',()=>owned(async dir=>{
 const before=process.env.MERI_REVIEW_SOURCE_ROOT,output=join(dir,'unused');const v=await invoke(['--run','--python',join(dir,'missing'),'--soffice',process.execPath,'--output',output]);assert.equal(v.status,1);assert.equal(v.body.failure.code,'ENOENT');assert.deepEqual(v.body.cleanup.fixtures,[]);assert.equal(v.body.cleanup.http,null);assert.equal(v.body.nativeQualified,false);assert.equal(v.body.nativeDatabase,false);await assert.rejects(access(output));assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
}));
test('existing output file is retained and never removed as borrowed state',()=>owned(async dir=>{
 const output=join(dir,'file');await writeFile(output,'original');const v=await invoke(['--run','--python',process.execPath,'--soffice',process.execPath,'--output',output]);assert.equal(v.status,1);assert.equal(v.body.failure.code,'EEXIST');assert.deepEqual(v.body.cleanup.fixtures,[]);assert.equal(await readFile(output,'utf8'),'original');
}));
test('fixed inspectors support help and reject extra arguments without loading Office',()=>{
 for(const name of ['inspect_xlsx.py','inspect_pdf.py']){const path=join(root,'apps/control/document-application/local/workbook',name);const output=execFileSync(python,['-I','-B',path,'--help'],{timeout:2000,maxBuffer:4096,encoding:'utf8'});assert.match(output,/Exit0 success\/help;2 failure/);assert.throws(()=>execFileSync(python,['-I','-B',path,'--bogus'],{timeout:2000,maxBuffer:4096,stdio:['ignore','pipe','pipe']}),e=>e.status===2);}
});
test('actual XLSX inspection input limit fails with settled canonical child receipt',()=>owned(async dir=>{
 for(const bytes of [Buffer.alloc(0),Buffer.alloc(1048577)])await assert.rejects(inspectWorkbook({bytes,pythonExecutable:python,directory:dir,deadlineMs:Date.now()+2000}),e=>{assert.equal(e.code,'ARTIFACT_PROCESS_FAILED');assert.equal(e.receipt.exitCode,2);assert.equal(e.receipt.groupAbsent,true);assert.equal(e.receipt.stdoutEnded,true);assert.equal(e.receipt.stderrEnded,true);assert.equal(e.receipt.sandboxQualified,false);assert.match(e.stderr.toString(),/XLSX_FIXTURE_INSPECTION_FAILED/);return true;});
}));
test('copy inspection rejects arbitrary evidence labels before allocation',()=>owned(async dir=>{
 await assert.rejects(inspectWorkbookCopies({bytes:Buffer.from('x'),label:'../bad',expectedTotal:0,pythonExecutable:python,sofficeExecutable:'/not-invoked',tempRoot:dir,outputDirectory:dir,deadlineMs:Date.now()+2000}));await assert.rejects(access(join(dir,'bad.xlsx')));
}));
test('cell lookup preserves literal data and missing cells without fabricated values',()=>{const x={sheets:[{name:'Notes',cells:[{address:'A1',value:'=1+1',kind:'s'}]}]};assert.equal(workbookCell(x,'Notes','A1').value,'=1+1');assert.equal(workbookCell(x,'Notes','A2'),undefined);assert.equal(workbookCell(x,'Other','A1'),undefined);});
