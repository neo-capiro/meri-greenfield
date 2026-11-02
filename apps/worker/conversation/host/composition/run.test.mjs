/** Browser-only host helpers only (apps/runtime/browser-host-service composes them). Synthetic ports; no namespace,
 * browser, model call or cloud action. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,enabledPolicy} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {armBrowserAfterWorkspaceReadback,prepareAdmittedBrowserWorkspace} from './run.mjs';
import {BROWSER_WORKSPACE_READBACK_SCHEMA} from '../browser-workspace/readback.mjs';
import {browserPaths} from '../../browser/workspace.mjs';

const fault=code=>error=>error?.code===code;
const allocation=()=>({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:Date.now()+60000});
const hostIdentity=a=>({schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:a.hostId});
function fixture(){const a=allocation();return {allocation:a,hostIdentity:hostIdentity(a),cwd:`/tmp/${binding.conversationId}`};}

test('paused browser child needs measured workspace readback before observer arm',async()=>{
 const f=fixture(),events=[],paths=browserPaths(f.cwd),scope={allocation:f.allocation,
  binding,hostIdentity:f.hostIdentity,cwd:f.cwd,paths,
  browserUid:24002,browserGid:24002,sdkUid:24001,sdkGid:24001,leaderPid:5678,
  browserObserver:{async arm(){events.push('armed');return {armed:true};}}};
 const measured={schema:BROWSER_WORKSPACE_READBACK_SCHEMA,
  allocationSha256:canonicalSha256(scope.allocation),bindingSha256:canonicalSha256(binding),
  hostIdentitySha256:canonicalSha256(scope.hostIdentity),cwd:scope.cwd,profile:paths.profile,
  output:paths.output,home:paths.home,browserUid:24002,browserGid:24002,
  sdkUid:24001,sdkGid:24001,leaderPid:5678,browserMountNamespace:'mnt:[123]',
  browserStartTicks:'987654',overlayMountId:'10',stateMountId:'11',originalCwdInode:'42',
  stateInode:'43',observedAtMs:Date.now()};
 await assert.rejects(armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>{events.push('readback');throw Error('overlay absent');}}));
 assert.deepEqual(events,['readback']);
 await assert.rejects(armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>({...measured,sourceFilesInaccessible:true,schema:'old-boolean-claim'})}),
  fault('HOST_BROWSER_WORKSPACE_UNPROVEN'));
 assert.deepEqual(events,['readback']);
 await assert.rejects(armBrowserAfterWorkspaceReadback({...scope,
  preparedWorkspace:{cwd:scope.cwd,cwdInode:'42',stateInode:'999'},
  readWorkspace:async()=>{events.push('readback');return measured;}}),fault('HOST_BROWSER_WORKSPACE_UNPROVEN'));
 assert.deepEqual(events,['readback','readback']);
 assert.deepEqual(await armBrowserAfterWorkspaceReadback({...scope,
  readWorkspace:async()=>{events.push('readback');return measured;}}),{armed:true});
 assert.deepEqual(events,['readback','readback','readback','armed']);
});

test('browser workspace creation waits for matching browser-purpose currentness',async()=>{
 const f=fixture(),events=[],paths=browserPaths(f.cwd),digest=canonicalSha256(enabledPolicy());
 const scope={allocation:f.allocation,binding,cwd:f.cwd,paths,policySha256:digest,
  maxFreshMs:10000,now:Date.now,signal:new AbortController().signal,
  sdkUid:24001,sdkGid:24001,browserUid:24002,browserGid:24002,
  prepare(){events.push('prepared');return {cwd:f.cwd,paths,cwdInode:'42',stateInode:'43'};}};
 await assert.rejects(prepareAdmittedBrowserWorkspace({...scope,browserClient:{
  async readCurrent(){events.push('current-denied');throw Error('browser not admitted');}}}));
 assert.deepEqual(events,['current-denied']);
 const stale={allocation:scope.allocation,binding,policySha256:digest,phase:'active',
  checkedAtMs:Date.now()-20000,currentUntilMs:Date.now()+1000};
 await assert.rejects(prepareAdmittedBrowserWorkspace({...scope,browserClient:{
  async readCurrent(){events.push('current-stale');return stale;}}}),fault('HOST_CURRENTNESS_REFUSED'));
 assert.deepEqual(events,['current-denied','current-stale']);
 const admitted=await prepareAdmittedBrowserWorkspace({...scope,browserClient:{
  async readCurrent(request){events.push('current-admitted');assert.equal(request.policySha256,digest);
   const checkedAtMs=Date.now();return {allocation:scope.allocation,binding,policySha256:digest,
    phase:'active',checkedAtMs,currentUntilMs:checkedAtMs+5000};}}});
 assert.deepEqual(events,['current-denied','current-stale','current-admitted','prepared']);
 assert.equal(admitted.stateInode,'43');
});
