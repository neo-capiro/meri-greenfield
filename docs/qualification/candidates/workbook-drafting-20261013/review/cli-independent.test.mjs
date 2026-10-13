import test from 'node:test';
import assert from 'node:assert/strict';
// Added after the separate, frozen root CLI became reviewable; no workbook regeneration.
test('workbook CLI help imports no fixture graph and leaves environment unchanged',async()=>{
 const {main}=await import('../../../../../scripts/local-workbook/run.mjs');
 const before=process.env.MERI_REVIEW_SOURCE_ROOT;let output='';
 assert.equal(await main(['--help'],text=>{output+=text;}),0);
 assert.match(output,/Usage:/);assert.match(output,/No model, native qualification or production activation/);
 assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
});
test('workbook CLI malformed arguments refuse before graph and output allocation',async()=>{
 const {main}=await import('../../../../../scripts/local-workbook/run.mjs');
 const before=process.env.MERI_REVIEW_SOURCE_ROOT;
 for(const args of[[],['--run'],['--help','--run'],['--run','--python','relative','--soffice','/abs','--output','/tmp/unused'],['--run','--python','/abs','--soffice','/abs','--output','relative'],['--run','--output','/tmp/unused','--python','/abs','--soffice','/abs']]){
  let output='';assert.equal(await main(args,text=>{output+=text;}),2);assert.match(output,/Usage:/);
 }
 assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
});
