/** Native checks. Default suite: check logic against SYNTHETIC converters (a fixed XlsxWriter workbook stands in for the
 * suite's recalculated output), including failing controls. Opt-in (MERI_ARTIFACT_SOFFICE): the canonical generators' DOCX,
 * XLSX, PPTX and PDF through real LibreOffice; with MERI_NATIVE_EVIDENCE_DIR the records are written there. Real runs are
 * local evidence behind a synthetic admission record, not renderer or native qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRendererPort,createLibreOfficeRendererPort,describeRenderer} from '../renderer.mjs';
import {createNativeChecks} from '../native/checks.mjs';
import {runArtifactProcess} from '../process.mjs';
import {artifactHarness,specs,context,python} from './artifact-harness.mjs';
import {realPdf,sha,syntheticConverter,syntheticOfficeConverter,syntheticAdmission} from './pdf-fixtures.mjs';
const soffice=process.env.MERI_ARTIFACT_SOFFICE;

/** XLSX with formulas whose stored values are chosen by the test (XlsxWriter writes the given cached result). */
async function workbook(root,{total=5,double=10,dropFormula=false,dropDouble=false}={}){
 const script=`import io,sys,xlsxwriter
b=io.BytesIO();w=xlsxwriter.Workbook(b,{'in_memory':True});s=w.add_worksheet('Data')
s.write_string('A1','Item');s.write_string('B1','Amount');s.write_string('A2','A');s.write_number('B2',2);s.write_string('A3','B');s.write_number('B3',3);s.write_string('A4','Total')
${dropFormula?`s.write_number('B4',${total})`:`s.write_formula('B4','=SUM(B2:B3)',None,${total})`}
${dropDouble?`s.write_number('C4',${double})`:`s.write_formula('C4','=B4*2',None,${double})`};w.close();sys.stdout.buffer.write(b.getvalue())`;
 return (await runArtifactProcess(python,['-I','-B','-c',script],{cwd:root,input:Buffer.alloc(0),deadlineMs:Date.now()+20000})).stdout;
}
const recalculatingConverter=output=>({async transform({bytes,format,target}){if(format==='xlsx'&&target==='xlsx')return {bytes:output,receipt:{inputSha256:sha(bytes),outputSha256:sha(output),nativeQualification:false}};
 return syntheticOfficeConverter().transform({bytes,format,target});}});
const checks=(root,transformer)=>createNativeChecks({renderer:createRendererPort({admission:syntheticAdmission(),transformer}),pythonExecutable:python,tempRoot:root});
async function scratch(t){const root=await mkdtemp(join(tmpdir(),'meri-native-checks-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('native checks require an admitted renderer port',async t=>{
 const root=await scratch(t);
 for(const renderer of [undefined,syntheticOfficeConverter(),createRendererPort({admission:undefined,transformer:syntheticOfficeConverter()})])
  assert.throws(()=>createNativeChecks({renderer,pythonExecutable:python,tempRoot:root}),{code:'NATIVE_CHECK_CONFIGURATION'});
});
test('openability passes only for an exported PDF with pages',async t=>{
 const root=await scratch(t),h=await artifactHarness(t,{converter:syntheticConverter()}),ctx=context();
 const docx=await h.service.download((await h.service.create(specs.docx,ctx)).version.versionId,ctx);
 const ok=await checks(root,syntheticOfficeConverter()).openability({bytes:docx.bytes,format:'docx'});assert.equal(ok.passed,true);assert.equal(ok.pages,1);assert.equal(ok.qualificationId,'synthetic-test-admission');
 const broken={async transform({bytes}){const out=Buffer.from('%PDF-1.4\n%%EOF\n');return {bytes:out,receipt:{inputSha256:sha(bytes),outputSha256:sha(out),nativeQualification:false}};}};
 const bad=await checks(root,broken).openability({bytes:docx.bytes,format:'docx'});assert.equal(bad.passed,false);assert.equal(bad.pages,null);
 await assert.rejects(checks(root,syntheticOfficeConverter()).openability({bytes:docx.bytes,format:'txt'}),{code:'NATIVE_CHECK_INPUT'});
 assert.deepEqual((await readdir(root)),[]);
});
test('recalculation and reference totals pass only when the suite stored the right values and kept every formula',async t=>{
 const root=await scratch(t),input=await workbook(root,{total:0,double:0});
 const good=checks(root,recalculatingConverter(await workbook(root)));
 const r=await good.recalculation({bytes:input,expected:{'Data!B4':5,'Data!C4':10}});
 assert.equal(r.passed,true);assert.equal(r.formulasPreserved,true);assert.deepEqual(r.cells.map(c=>[c.cell,c.formula,c.storedBefore,c.storedAfter]),[['Data!B4','=SUM(B2:B3)',0,5],['Data!C4','=B4*2',0,10]]);
 const totals=await good.referenceTotals({bytes:input,totals:[{total:'Data!B4',range:'Data!B2:B3'}]});
 assert.equal(totals.passed,true);assert.deepEqual(totals.totals[0],{total:'Data!B4',range:'Data!B2:B3',formula:'=SUM(B2:B3)',stored:5,independentSum:5,referencedCells:2,passed:true});
 // Failing controls: a wrong stored value, a dropped formula, a wrong total, an empty range.
 const stale=checks(root,recalculatingConverter(await workbook(root,{total:4})));
 assert.equal((await stale.recalculation({bytes:input,expected:{'Data!B4':5}})).passed,false);
 assert.equal((await stale.referenceTotals({bytes:input,totals:[{total:'Data!B4',range:'Data!B2:B3'}]})).passed,false);
 const dropped=await checks(root,recalculatingConverter(await workbook(root,{dropFormula:true}))).recalculation({bytes:input,expected:{'Data!B4':5}});
 assert.equal(dropped.passed,false);assert.equal(dropped.formulasPreserved,false);
 // A formula the expectations do not name must still survive recalculation.
 const unnamed=await checks(root,recalculatingConverter(await workbook(root,{dropDouble:true}))).recalculation({bytes:input,expected:{'Data!B4':5}});
 assert.equal(unnamed.cells[0].passed,true);assert.equal(unnamed.formulasPreserved,false);assert.equal(unnamed.passed,false);
 assert.equal((await good.referenceTotals({bytes:input,totals:[{total:'Data!B4',range:'Data!D2:D3'}]})).passed,false);
 assert.equal((await good.recalculation({bytes:input,expected:{}})).passed,false);
 for(const bad of [{total:'B4',range:'Data!B2:B3'},{total:'Data!B4',range:'Data!B3:B2'}])await assert.rejects(good.referenceTotals({bytes:input,totals:[bad]}),{code:'NATIVE_CHECK_INPUT'});
});
test('real LibreOffice native openability, recalculation and reference totals for generated artifacts (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!soffice&&'MERI_ARTIFACT_SOFFICE not set'},async t=>{
 const root=await scratch(t),h=await artifactHarness(t,{converter:syntheticConverter()}),ctx=context();
 const renderer=createLibreOfficeRendererPort({admission:syntheticAdmission({executable:soffice}),executable:soffice,tempRoot:root}),native=createNativeChecks({renderer,pythonExecutable:python,tempRoot:root});
 const records=[];const bytesOf=async format=>(await h.service.download((await h.service.create(specs[format],ctx)).version.versionId,ctx)).bytes;
 for(const format of ['docx','xlsx','pptx'])records.push(await native.openability({bytes:await bytesOf(format),format}));
 records.push(await native.openability({bytes:realPdf(['Native PDF openability']),format:'pdf'}));
 const xlsx=await bytesOf('xlsx');
 records.push(await native.recalculation({bytes:xlsx,expected:{'Data!B4':5}}));records.push(await native.referenceTotals({bytes:xlsx,totals:[{total:'Data!B4',range:'Data!B2:B3'}]}));
 for(const record of records)assert.equal(record.passed,true,JSON.stringify(record));
 assert.equal(records[4].cells[0].storedBefore,0,'the generator stores a placeholder formula cache');assert.equal(records[4].cells[0].storedAfter,5);
 if(process.env.MERI_NATIVE_EVIDENCE_DIR){const dir=resolve(process.env.MERI_NATIVE_EVIDENCE_DIR);await mkdir(dir,{recursive:true});
  const version=execFileSync(soffice,['--version'],{env:{PATH:'/usr/bin:/bin',HOME:root}}).toString('utf8').trim();
  await writeFile(join(dir,'native-checks.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'local evidence; synthetic admission record; not renderer or native qualification',
   renderer:{...describeRenderer(renderer),observedVersion:version},host:{uid:process.getuid(),sandboxAttested:false},node:process.version,records},null,1)+'\n');}
});
