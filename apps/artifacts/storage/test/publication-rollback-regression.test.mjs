/** Same negative/fixed source regression. An explicit local old-module URL is used only by the recorded negative control. */
import test from 'node:test';import assert from 'node:assert/strict';
import {sqlFixture,record,commit,NOW} from './sql-fixture.mjs';
const old=process.env.MERI_ARTIFACT_PUBLICATION_OLD_MODULE;
const legacy=old?(await import(old)).createPostgresArtifactVersions:null;
test('critical rollback regression: reader that never observed later unpreviewed version refuses restored earlier SQL head',async()=>{
 const f=sqlFixture(),create=()=>legacy?legacy({pool:f.pool,now:()=>NOW}):f.create(),a=record(),b=record(11,a.version.versionId);
 await create().commit(commit(a));const snapshot=structuredClone(f.state),unseen=create();await create().commit(commit(b));f.state.versions=snapshot.versions;f.state.heads=snapshot.heads;
 await assert.rejects(unseen.read(a.version.versionId),/ARTIFACT_PUBLICATION_PROJECTION_STALE/);
});
