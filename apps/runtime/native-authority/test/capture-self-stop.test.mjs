// The end-of-turn capture across the real composed exchange (capture-composition-fixture.mjs).
// Live 2026-10-20 22:59:31Z (chat 2 on candidate 6): the stop the capture's own query close sends cancelled the capture that caused it
// (router: capture refused at `send`, CANCELLED, 11.6 s of its own budget left), checkpoint/complete answered 503 and the turn ended
// ATTEMPT_LOST.
import test from 'node:test';
import assert from 'node:assert/strict';
import {continuationFixture, id} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {composeCapture} from './capture-composition-fixture.mjs';

const compose = (t, {selfStop}) => { const {binding, target} = continuationFixture(); return composeCapture(t, {binding, versions: target.versions, sessionId: id(862), selfStop}); };

test('the capture survives the stop its own query close causes; that stop still ends every other exchange and refuses a later capture', async t => {
  const x = await compose(t, {selfStop: true});
  const captured = x.capture(); await x.inFlight(1);
  x.holdNextObserve(); const inspected = x.inspect(); await x.inFlight(2);
  x.release();
  assert.equal(await captured, 'answered', JSON.stringify(x.routerLog));
  assert.equal(await inspected, 'REMOTE_TASK_REFUSED', 'the stop cancels the other in-flight exchange');
  assert.equal(await x.capture(), 'REMOTE_TASK_REFUSED', 'a capture that arrives after the stop is refused');
  assert.deepEqual(x.router.status(), {closed: false, activeRequests: 0, trackedOriginals: 1});
});

test('a genuine Stop (control credential) during a capture still ends it and every other in-flight exchange', async t => {
  const x = await compose(t, {selfStop: false});
  const captured = x.capture(); await x.inFlight(1);
  x.holdNextObserve(); const inspected = x.inspect(); await x.inFlight(2);
  assert.equal(await x.stop(), 'answered');
  assert.equal(await inspected, 'REMOTE_TASK_REFUSED');
  // The stop reached the runner first: the capture finds its process stopped before it closes the query, and refuses.
  x.release();
  assert.equal(await captured, 'REMOTE_TASK_REFUSED');
  assert.equal(await x.capture(), 'REMOTE_TASK_REFUSED');
});

test('revocation while the self-stopped capture is in flight withholds its result', async t => {
  const x = await compose(t, {selfStop: true});
  const captured = x.capture(); await x.inFlight(1);
  x.stopped.then(() => x.revoke());
  x.release();
  // The stop spares the capture, but the router's recheck after the runner answers refuses a revoked task.
  assert.equal(await captured, 'REMOTE_TASK_REFUSED');
  assert.ok(x.routerLog.some(line => line.operation === 'capture' && line.outcome === 'refused' && line.phase === 'authority-after'), JSON.stringify(x.routerLog));
});
