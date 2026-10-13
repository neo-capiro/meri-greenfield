import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {fixture} from '../../../../../apps/runtime/artifacts/test/fixture.mjs';
import {createRuntimeArtifactApplication} from '../../../../../apps/runtime/artifacts/index.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const here=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../../../../../',import.meta.url));
async function seed(x){const path=root+'apps/runtime/artifacts/test/evidence/retained-docx-final/',receipt=JSON.parse(await readFile(path+'receipt.json'));let prior=null;
 for(const [index,label]of ['original','revision'].entries()){
  const bytes=await readFile(path+label+'.docx'),saved=receipt.versions[index],spec=index?receipt.sourcePreparations[1].request:receipt.sourcePreparations[0];
  const context={...x.f.artifactOptions.context,evidence:saved.evidence},requestSha256=v.hash({request:spec,context,baseVersionId:saved.parentVersionId});
  const object=await x.storage.objects.put({objectId:saved.object.objectId,bytes,scopes:saved.scopes,requestSha256});assert.equal(object.sha256,saved.object.sha256);assert.equal(object.versionId,saved.object.versionId);
  // Independent imported structural metadata; not the missing original create-time receipt or native inspection.
  const inspection=JSON.parse(await readFile(here+'imported-inspections.json'))[label];
  const record={version:saved,spec,specSha256:v.hash(spec),requestSha256,inspection,expectedParentVersionId:prior};await x.storage.versions.commit(record);prior=saved.versionId;
 }
 return receipt;
}
test('retained actual DOCX inspect/download through current HTTP mount, reconstructed owner, exact immutable parent and byte tamper refusal',{timeout:30000},async()=>{const x=await fixture();let cleanup;try{
 const receipt=await seed(x);x.reconstruct();for(const version of receipt.versions){
  const inspected=await x.send('inspect',{versionId:version.versionId});assert.equal(inspected.status,200);const value=await inspected.json();assert.deepEqual(value.version,version);assert.equal(value.inspection.currentBytesVerified,true);
  const downloaded=await x.send('download',{versionId:version.versionId});assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),await readFile(root+'apps/runtime/artifacts/test/evidence/retained-docx-final/'+(version.parentVersionId?'revision':'original')+'.docx'));
 }
 assert.equal(x.f.stats().generations,0);assert.equal(x.f.stats().versionCharges,0);assert.equal(x.db.state.versions.size,2);assert.equal(x.stored.size,2);
 const selected=receipt.versions[0],key=[...x.stored.keys()].find(k=>k.includes(selected.object.objectId)),entry=x.stored.get(key),before=entry.bytes;entry.bytes=Buffer.from(before);entry.bytes[100]^=1;
 assert.notEqual((await x.send('download',{versionId:selected.versionId})).status,200);entry.bytes=before;assert.equal((await x.send('download',{versionId:selected.versionId})).status,200);
 const row=x.db.state.versions.get(selected.versionId),retained=structuredClone(row);row.record.spec.title='Wrong immutable spec';row.record_sha256=v.hash(row.record);assert.notEqual((await x.send('inspect',{versionId:selected.versionId})).status,200);x.db.state.versions.set(selected.versionId,retained);
 assert.equal((await x.send('inspect',{versionId:selected.versionId})).status,200);
 await writeFile(here+'http-read-results.json',JSON.stringify({source:'b7b47c2b73dab98c2ec7074b2153a14d6a1e618e',mode:'INDEPENDENT_RETAINED_IMPORT_SYNTHETIC_SQL_S3',versions:receipt.versions.map(r=>({versionId:r.versionId,parent:r.parentVersionId,sha256:r.object.sha256})),generations:x.f.stats().generations,charges:x.f.stats().versionCharges,immutableSpecTamperRefused:true,byteTamperRefused:true,nativeQualified:false},null,2)+'\n',{flag:'wx'});
 }finally{cleanup=await x.close();await writeFile(here+'http-read-cleanup-final.json',JSON.stringify(cleanup,null,2)+'\n',{flag:'wx'});}});
test('foreign opaque session and current source/resource revocation refuse retained read with zero generation or charge',{timeout:30000},async()=>{const x=await fixture(),foreign=await fixture();try{const receipt=await seed(x),app=createRuntimeArtifactApplication({sessions:x.f.sessions,optionsOwner:x.owner,now:x.f.now,limits:x.f.limits});
 const request=()=>new Request('https://synthetic.invalid/api/documents/download',{method:'POST',headers:{authorization:'Bearer '+foreign.session.credential,'content-type':'application/json'},body:JSON.stringify({versionId:receipt.versions[0].versionId})});assert.notEqual((await app.handle(request())).status,200);
 x.f.revoke();for(const intent of ['inspect','download'])assert.notEqual((await x.send(intent,{versionId:receipt.versions[0].versionId})).status,200);assert.equal(x.f.stats().generations,0);assert.equal(x.f.stats().versionCharges,0);assert.equal(x.stored.size,2);
 }finally{const a=await x.close(),b=await foreign.close();await writeFile(here+'isolation-revocation-cleanup-final.json',JSON.stringify({a,b,nativeQualified:false},null,2)+'\n',{flag:'wx'});}});
