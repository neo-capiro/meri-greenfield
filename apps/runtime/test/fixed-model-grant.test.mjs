import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {assertFirstRunGrantBindings} from '../prepared-candidate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';

test('fixed first run binds its proxy bearer to a distinct model grant',()=>{
 const {configuration,secret}=candidateFixture(),c=configuration.nativeCandidate;
 assert.deepEqual(assertFirstRunGrantBindings(c.grantIntents,c.grantId,secret),{
  controlDigest:capabilityDigest(secret.control),taskDigest:capabilityDigest(secret.task),
 });
});

test('fixed first run refuses an absent, duplicate, or mismatched model grant',()=>{
 for(const change of [
  ({c})=>{c.grantIntents.pop();},
  ({c})=>{c.grantIntents[1].grantId=c.grantId;},
  ({c})=>{c.grantIntents.push({...c.grantIntents[1]});},
  ({secret})=>{secret.proxy='unregistered-synthetic-proxy-capability-0001';},
  ({secret})=>{secret.proxy='short';},
 ]){
  const {configuration,secret}=candidateFixture(),c=configuration.nativeCandidate;
  change({c,secret});
  assert.throws(()=>assertFirstRunGrantBindings(c.grantIntents,c.grantId,secret),/PREPARED_CANDIDATE_REFUSED/);
 }
});
