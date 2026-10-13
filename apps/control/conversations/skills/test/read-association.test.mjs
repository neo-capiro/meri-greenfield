import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {bridgeFixture,pythonExecutable,sofficeExecutable} from '../../../document-application/selected-output/test/fixture.mjs';
import {renderCopy,sha} from '../../../document-application/selected-output/test/render.mjs';
test('actual source preparation cannot inspect or download a different original under the same output allocation',{timeout:120000},async()=>{
 const f=await bridgeFixture(),directory=process.env.MERI_ASSOCIATION_ARTIFACT_ROOT;
 try{await mkdir(directory,{recursive:false});const a=await f.prepare(),first=await f.deliver(a),input=structuredClone(f.input);input.title='Distinct second original';const b=await f.prepare(input),second=await f.deliver(b);
  assert.notEqual(first.preparationSha256,second.preparationSha256);assert.notEqual(first.artifact.version.artifactId,second.artifact.version.artifactId);assert.equal(first.artifact.version.parentVersionId,null);assert.equal(second.artifact.version.parentVersionId,null);
  assert.deepEqual(first.artifact.version.evidence,second.artifact.version.evidence);assert.deepEqual(first.outputBinding,second.outputBinding);
  const outcomes={};for(const intent of ['inspect','download']){try{const r=await f.bridge.read({sourcePrepared:a,versionId:second.artifact.version.versionId,intent});outcomes[intent]={released:true,versionId:r.version.versionId,...(r.bytes?{sha256:sha(r.bytes)}:{})};}catch(e){outcomes[intent]={released:false,code:e.code??e.message};}}
  const copies=[];for(const [label,p,result]of [['first',a,first],['second',b,second]]){const r=await f.bridge.read({sourcePrepared:p,versionId:result.artifact.version.versionId,intent:'download'});await writeFile(join(directory,label+'.docx'),r.bytes,{flag:'wx'});copies.push({label,bytes:r.bytes});}
  await writeFile(join(directory,'provenance.json'),JSON.stringify({first,second,a,b,outcomes,scope:'Existing real artifact owner with scripted approval/source callbacks; two distinct originals, not a revision'},null,2)+'\n',{flag:'wx'});
  for(const copy of copies)await renderCopy({bytes:copy.bytes,label:copy.label,outputDirectory:directory,tempRoot:f.output.directory,pythonExecutable,sofficeExecutable});
  await f.close();await writeFile(join(directory,'receipt.json'),JSON.stringify({outcomes,stats:f.output.stats(),nativeQualified:false},null,2)+'\n',{flag:'wx'});
  assert.equal(outcomes.inspect.released,false,'Different source preparation released inspection for another original');assert.equal(outcomes.download.released,false,'Different source preparation released another original DOCX');
 }finally{await f.close();}
});
