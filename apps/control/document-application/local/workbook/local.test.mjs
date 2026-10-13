import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {main} from '../../../../../scripts/local-workbook/run.mjs';

test('workbook CLI import/help/invalid arguments allocate no fixture or change source-root environment',async () => {
  const before = process.env.MERI_REVIEW_SOURCE_ROOT;
  for (const [args,status] of [[['--help'],0],[[],2],[['--run'],2],
    [['--run','--python','relative','--soffice','/absolute','--output','/new'],2]]) {
    let output = '';assert.equal(await main(args,text => {output += text;}),status);assert.match(output,/Usage:/);
    assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
  }
});
test('workbook CLI refuses an existing evidence directory without touching its bytes',async () => {
  const directory = await mkdtemp(join(tmpdir(),'workbook-cli-negative-'));
  try {
    await writeFile(join(directory,'sentinel'),'preserve');let output = '';
    const result = await main(['--run','--python',process.execPath,'--soffice',process.execPath,'--output',directory],text => {output += text;});
    const receipt = JSON.parse(output);assert.equal(result,1);assert.equal(receipt.status,'FAIL');
    assert.deepEqual(receipt.cleanup.fixtures,[]);assert.equal(receipt.cleanup.http,null);
    assert.equal(await readFile(join(directory,'sentinel'),'utf8'),'preserve');
  } finally {await rm(directory,{recursive: true,force: true});}
});
