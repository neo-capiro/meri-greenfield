import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {main} from './run.mjs';
test('research brief CLI help/import/invalid paths allocate no fixture or change source-root environment',async()=>{
  const previous=process.env.MERI_REVIEW_SOURCE_ROOT;
  for(const [args,code]of [[['--help'],0],[[],2],[['--run','--python','relative','--soffice','/absolute','--output','/new'],2]]){
    let out='';assert.equal(await main(args,x=>out+=x),code);assert.match(out,/Usage:/);assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,previous);
  }
});
test('research brief CLI preserves existing output and refuses before resource allocation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'brief-negative-'));
  try{await writeFile(join(directory,'sentinel'),'retain');let out='';assert.equal(await main(['--run','--python',process.execPath,'--soffice',process.execPath,'--output',directory],x=>out+=x),1);
    const receipt=JSON.parse(out);assert.equal(receipt.status,'FAIL');assert.deepEqual(receipt.cleanup.fixtures,[]);assert.equal(receipt.cleanup.http,null);assert.equal(await readFile(join(directory,'sentinel'),'utf8'),'retain');
  }finally{await rm(directory,{recursive:true,force:true});}
});
