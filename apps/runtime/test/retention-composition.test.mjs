import test from 'node:test';
import assert from 'node:assert/strict';
import {documentsFamily} from '../product-ports/documents.mjs';
import {captureRuntimePorts} from '../product-applications.mjs';
import {retentionGate} from '../control.mjs';
import {createArtifactRecoveryBinding} from '../artifacts/recovery-binding.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';

test('expired Trash composes actual storage and Core ownership while startup remains closed without IO',()=>{
 const unused=()=>assert.fail('composition must not read SQL, secrets or storage'),pool={connect:unused},now=()=>1800000000000;
 const configuration={limits:{requestMs:1000},retention:{enabled:true,purge:{enabled:true}},
  artifacts:{enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',
   kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001'},
  reads:{serviceSecretFile:'/synthetic/service-secret'},agentcore:{identity:{origin:'https://core.synthetic.invalid'}}};
 const journal=createPostgresRetentionJournal({pool,now}),binding=createArtifactRecoveryBinding({journal});
 const family=documentsFamily({createS3Client(){return {send:unused};}});
 const {ports}=family({configuration,pool,now,artifactRecovery:binding.context});
 assert.equal(typeof captureRuntimePorts(ports).retentionStorage.holdsFor,'function');
 const retention=retentionGate(configuration,pool,ports,binding,now);
 assert.equal(retention.startup.state().purgeEnabled,true);
 assert.equal(retention.serving.isEnabled(),false);
 assert.equal(typeof retention.sweep,'function');
 assert.throws(()=>retentionGate({...configuration,reads:undefined},pool,{retentionStorage:captureRuntimePorts(ports).retentionStorage},null,now),/RETENTION_CONFIGURATION/);
 const disabled=retentionGate({...configuration,retention:{enabled:true}},pool,{},null,now);
 assert.equal(disabled.startup.state().purgeEnabled,false);assert.equal('sweep' in disabled,false);
});

test('the existing public listener never forwards the private retention sweep',async()=>{
 let calls=0;const routes=createControlRouteApplications({assembly:{handle(){throw Error('not public');}},
  candidate:{handle(){calls++;return new Response('private');}}});
 const request=new Request('https://control.invalid/v1/retention/sweep',{method:'POST',body:'{"after":null}'});
 assert.equal((await routes.public.handle(request.clone())).status,404);assert.equal(calls,0);
 assert.equal((await routes.private.handle(request)).status,200);assert.equal(calls,1);
});
