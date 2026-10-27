import test from 'node:test';import assert from 'node:assert/strict';
import {documentsFamily} from '../../product-ports/documents.mjs';
import {compileRuntimeArtifactsConfiguration} from '../configuration.mjs';
import {createS3ArtifactPublication} from '../../../artifacts/storage/s3-artifact-publication.mjs';
import {s3PreviewFixture} from '../../../artifacts/storage/test/s3-preview-fixture.mjs';
import {sqlFixture,commit} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {publicationAuthority} from '../../../artifacts/storage/test/publication-fixture.mjs';
function compose(f,sql,publicationPagedWrites){const {bucket,prefix,expectedBucketOwner,kmsKeyId}=f.config,configuration={artifacts:{enabled:true,region:'us-east-1',bucket,prefix,expectedBucketOwner,kmsKeyId,...(publicationPagedWrites===undefined?{}:{publicationPagedWrites})},retention:{},limits:{requestMs:30000}};
 return documentsFamily({createS3Client:()=>f.config.client})({configuration,pool:sql.pool,now:Date.now,artifactRecovery:{journal:sql.journal,retention:sql.retention}}).ports.artifactStore.versions;
}
test('production documents composition forwards only a closed trusted write switch and never automatically upgrades a legacy root',async()=>{
 const f=s3PreviewFixture(),sql=sqlFixture(),versions=compose(f,sql,true);await versions.commit(commit(f.source),undefined,publicationAuthority(f.source,Date.now()));const root=await createS3ArtifactPublication({...f.config,enabled:true}).snapshot();assert.equal(root.index.publicationVersion,'meri.artifact-publication-index.proposal-1');
 assert.throws(()=>compileRuntimeArtifactsConfiguration({artifacts:{enabled:false,publicationPagedWrites:'true'}}),/ARTIFACT_CONFIGURATION/);
});
test('production documents composition default refuses v2 writes; explicit switch permits the current canonical owner',async()=>{
 const f=s3PreviewFixture(),sql=sqlFixture(),owner=createS3ArtifactPublication({...f.config,maxRequestMs:30000,enabled:true,pagedWritesEnabled:true});await owner.upgrade((await owner.snapshot()).positionSha256);
 await assert.rejects(compose(f,sql).commit(commit(f.source),undefined,publicationAuthority(f.source,Date.now())),/UPGRADE_DISABLED/);assert.equal(sql.state.versions.size,0);
 await compose(f,sql,true).commit(commit(f.source),undefined,publicationAuthority(f.source,Date.now()));assert.deepEqual(await compose(f,sql,false).read(f.source.version.versionId),f.source);
});
