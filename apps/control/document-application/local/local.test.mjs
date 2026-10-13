import test from 'node:test';
import assert from 'node:assert/strict';
import {main} from '../../../../scripts/local-document/run.mjs';

test('document fixture CLI help and malformed arguments allocate no fixture or listener',async () => {
  const original = process.env.MERI_REVIEW_SOURCE_ROOT;
  for (const [args,expected] of [[['--help'],0],[[],2],[['--run'],2],[['--run','--python','relative'],2]]) {
    let output = '';assert.equal(await main(args,text => {output += text;}),expected);
    assert.match(output,/Usage:/);assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,original);
  }
});

test('actual HTTP Word draft and revision preserve originals, budgets and revoked download denial', {timeout: 30000},async () => {
  let output = '';
  const status = await main(['--run','--python','/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python'],text => {output += text;});
  const receipt = JSON.parse(output);assert.equal(status,0,output);assert.equal(receipt.status,'PASS');
  assert.deepEqual(receipt.result.invariants,{originalPreserved: true,revisionParentExact: true,downloadsVerified: true,
    sharedAllocationChargedOncePerVersion: true,reconstructedGraphReadRetainedVersions: true,revokedVersionsDenied: true,callerAuthorityRefused: true});
  assert.equal(receipt.result.stats.generations,2);assert.equal(receipt.result.stats.allocations,1);assert.equal(receipt.result.stats.grants,1);
  assert.equal(receipt.result.stats.consumedMicroUsd,'20');assert.equal(receipt.result.stats.settled,2);assert.equal(receipt.result.stats.unknown,0);
  for (const process of [...receipt.result.stats.processReceipts,...receipt.result.inspectionProcessReceipts]) {
    assert.equal(process.exitCode,0);assert.equal(process.leaderClosed,true);assert.equal(process.groupAbsent,true);assert.equal(process.sandboxQualified,false);
  }
  assert.equal(receipt.nativeDatabase,false);assert.equal(receipt.nativeQualified,false);assert.equal(receipt.productionActivated,false);
  assert.equal(receipt.cleanup.failed,false);assert.deepEqual(receipt.cleanup.http,{closed: true,listening: false,activeSockets: 0});
  assert.deepEqual(receipt.cleanup.fixture.cleanup,{executorDirectoriesAbsent: true,storeRemoved: true});
});
