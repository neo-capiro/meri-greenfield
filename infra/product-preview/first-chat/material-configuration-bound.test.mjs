import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configurationMaxBytes,loadConfiguration} from '../../../apps/runtime/config.mjs';
import {compileProductMaterialPlan} from '../../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createRenderFixture} from './render-material.fixture.mjs';
import {withPosixPaths} from './render-material.mjs';

const fixture=createRenderFixture();test.after(()=>fixture.cleanup());
let rendered;
async function delivery(role='control'){
 rendered??=await fixture.render();
 return structuredClone({expected:rendered.roles[role].expected,bundle:rendered.roles[role].bundle});
}
function updateFile(value,path,bytes){
 value.bundle.files.find(file=>file.path===path).base64=Buffer.from(bytes).toString('base64');
 value.expected.sha256ByPath[path]=createHash('sha256').update(bytes).digest('hex');
 const {materialContractSha256,...contract}=value.expected;
 value.expected={...contract,materialContractSha256:canonicalSha256(contract)};
}

test('control configuration delivery, plan and loader agree at 40 KiB and reject one-byte overflow',async()=>{
 const f=await delivery(),path='/run/meri/control.json',limit=40*1024;
 const configuration=JSON.parse(rendered.roles.control.configBytes.toString());
 const plan=withPosixPaths(()=>compileProductMaterialPlan({role:'control',configuration,runtimeUser:'1000:1000'}));
 assert.equal(configurationMaxBytes('control'),limit);
 assert.equal(plan.requiredFiles.find(file=>file.path===path).maxBytes,limit);
 assert.ok(plan.requiredFiles.filter(file=>file.path!==path).every(file=>file.maxBytes===32768));
 const text=JSON.stringify(configuration);
 // Padding exists only to exercise the byte boundary; production rendering stays compact.
 const bytes=Buffer.from(text+' '.repeat(limit-Buffer.byteLength(text)));
 updateFile(f,path,bytes);assert.equal(validateStaticProductDelivery(f).ready,true);
 const directory=await mkdtemp(join(tmpdir(),'meri-control-config-bound-')),localPath=join(directory,'control.json');
 try{
  await writeFile(localPath,bytes);assert.deepEqual(await loadConfiguration(localPath,'control'),configuration);
  const overflow=Buffer.concat([bytes,Buffer.from(' ')]);updateFile(f,path,overflow);
  assert.throws(()=>validateStaticProductDelivery(f),{code:'STATIC_INIT_CONTENT_REFUSED'});
  await writeFile(localPath,overflow);await assert.rejects(loadConfiguration(localPath,'control'),{code:'RUNTIME_CONFIGURATION'});
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('control growth retains 32 KiB worker and secret limits and the 64 KiB bundle ceiling',async()=>{
 const worker=await delivery('temporal-worker');
 assert.equal(configurationMaxBytes('temporal-worker'),32768);
 assert.equal(configurationMaxBytes('schedule-worker'),32768);
 const text=rendered.roles['temporal-worker'].configBytes.toString();
 updateFile(worker,'/run/meri/worker.json',text+' '.repeat(32769-Buffer.byteLength(text)));
 assert.throws(()=>validateStaticProductDelivery(worker),{code:'STATIC_INIT_CONTENT_REFUSED'});
 const control=await delivery(),secrets=control.bundle.files.filter(file=>file.path!=='/run/meri/control.json');
 updateFile(control,secrets[0].path,Buffer.alloc(32769));
 assert.throws(()=>validateStaticProductDelivery(control),{code:'STATIC_INIT_CONTENT_REFUSED'});
 updateFile(control,secrets[0].path,Buffer.alloc(32768));updateFile(control,secrets[1].path,Buffer.alloc(32768));
 assert.ok(Buffer.byteLength(JSON.stringify(control.bundle))>65536);
 assert.throws(()=>validateStaticProductDelivery(control),{code:'STATIC_INIT_BUNDLE_REFUSED'});
});
