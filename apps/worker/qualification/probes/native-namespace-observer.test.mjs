import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinuxProcNamespaceInspector } from './native-namespace-observer.mjs';

const NOW = 10000;
const child = { instanceId: '12345678-1234-4234-8234-123456789012', pid: 12, startedAtMs: NOW };
const procMount = '25 20 0:3 / /proc rw,nosuid,nodev,noexec - proc proc rw\n';
// Fixed Linux stat fixture: state is field 3 and starttime is field 22.
const stat = ticks => `1 (supervisor (fixture)) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${ticks} 0\n`;

function fixture(options = {}) {
  const controller = new AbortController();
  const state = { names: ['1', 'self', 'sys'], namespace: 'pid:[42]', ticks: '100',
    mount: procMount, calls: [], sdkPresent: false, ...options };
  const io = {
    async read(path) {
      state.calls.push(path);
      if (state.error) throw state.error;
      if (state.hang) return new Promise(() => {});
      if (path === '/proc/self/mountinfo') return state.mount;
      if (path === '/proc/1/stat' || path === '/proc/self/stat') return state.stat ?? stat(state.ticks);
      if (path === '/proc/12/stat' && state.sdkPresent) return 'unexpected live child';
      const error = new Error('not found'); error.code = 'ENOENT'; throw error;
    },
    async readlink(path) { state.calls.push(path); return state.namespace; },
    async list(path) {
      state.calls.push(path);
      if (state.lists?.length) return state.lists.shift();
      return state.names;
    }
  };
  const inspector = createLinuxProcNamespaceInspector({ io, observerPid: 1, now: () => NOW,
    deadlineMs: NOW + 1000, signal: controller.signal, ...options.composition });
  return { inspector, state, controller, io };
}

test('construction has no I/O and requires bounded owner configuration', () => {
  const { state } = fixture(); assert.deepEqual(state.calls, []);
  assert.throws(() => createLinuxProcNamespaceInspector(), /NAMESPACE_COMPOSITION/);
  assert.throws(() => createLinuxProcNamespaceInspector({ deadlineMs: NOW + 1, signal: {} }), /NAMESPACE_COMPOSITION/);
});

test('baseline before spawn and unchanged exclusive namespace yield only measured facts', async () => {
  const { inspector, state } = fixture();
  await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /BASELINE_REQUIRED/);
  assert.equal(state.calls.length, 0);
  const baseline = await inspector.baseline();
  assert.deepEqual(baseline, { method: 'linux-proc', observedAtMs: NOW,
    pidNamespace: 'pid:[42]', observerPid: 1, otherPids: [] });
  const observed = await inspector.inspectNamespace({ process: child, exitedAtMs: NOW });
  assert.deepEqual(observed, baseline);
  assert.ok(state.calls.includes('/proc/12/stat'));
  await assert.rejects(inspector.baseline(), /BASELINE_ONCE/);
});

test('proc mount must be complete procfs without hidden PIDs or masked process directories', async t => {
  for (const [name, mount] of [
    ['absent', '25 20 0:3 / /sys rw - sysfs sysfs rw\n'],
    ['wrong filesystem', procMount.replace('- proc ', '- tmpfs ')],
    ['partial mount root', procMount.replace(' / /proc ', ' /1 /proc ')],
    ['hidepid', procMount.replace('- proc proc rw', '- proc proc rw,hidepid=2')],
    ['PID masking', `${procMount}26 25 0:4 / /proc/1 rw - tmpfs tmpfs rw\n`],
    ['malformed', 'unparseable\n']
  ]) await t.test(name, async () => {
    const { inspector } = fixture({ mount });
    await assert.rejects(inspector.baseline(), /NAMESPACE_(?:PROC|MOUNTINFO)/);
  });
});

test('PID 1, owner stat and namespace are mandatory, valid and stable', async t => {
  for (const [name, options, code] of [
    ['missing PID 1', { names: ['self'] }, 'PROC_COVERAGE'],
    ['malformed stat', { stat: '1 (owner) S 0' }, 'STAT'],
    ['wrong owner PID', { stat: stat('100').replace(/^1 /, '2 ') }, 'STAT'],
    ['invalid namespace', { namespace: 'pid:42' }, 'PID_NAMESPACE'],
    ['read denied', { error: Object.assign(new Error('denied'), { code: 'EACCES' }) }, 'denied'],
    ['read disappeared', { error: Object.assign(new Error('gone'), { code: 'ENOENT' }) }, 'gone']
  ]) await t.test(name, async () => {
    const { inspector } = fixture(options);
    await assert.rejects(inspector.baseline(), new RegExp(code));
  });
});

test('any surviving PID refuses, irrespective of its namespace or whether it is the SDK PID', async t => {
  for (const pid of ['12', '77']) await t.test(pid, async () => {
    const { inspector, state } = fixture(); await inspector.baseline();
    state.names = ['1', pid, 'self'];
    await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /SURVIVING_PROCESS/);
    await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /OWNER_UNAVAILABLE/);
  });
});

test('enumeration drift and incomplete listing are refused instead of ignoring disappearing PIDs', async t => {
  await t.test('drift', async () => {
    const { inspector, state } = fixture(); await inspector.baseline();
    state.lists = [['1', '12'], ['1']];
    await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /ENUMERATION_CHANGED/);
  });
  for (const names of [['1', '1'], ['1', '001'], ['1', '0'], ['1', '9007199254740993'], ['1', 'a/b']]) {
    await t.test(JSON.stringify(names), async () => {
      const { inspector } = fixture({ names });
      await assert.rejects(inspector.baseline(), /PROC_COVERAGE/);
    });
  }
});

test('supervisor PID reuse, namespace replacement and mount replacement invalidate baseline', async t => {
  for (const [name, change] of [
    ['PID reuse', state => { state.ticks = '101'; }],
    ['namespace replacement', state => { state.namespace = 'pid:[43]'; }],
    ['procfs replacement', state => { state.mount = procMount.replace(/^25 /, '26 '); }]
  ]) await t.test(name, async () => {
    const { inspector, state } = fixture(); await inspector.baseline(); change(state);
    await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /OWNER_CHANGED/);
  });
});

test('SDK stat must be absent even when two directory listings omit the child', async () => {
  const { inspector, state } = fixture(); await inspector.baseline(); state.sdkPresent = true;
  await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW }), /SDK_PROCESS_SURVIVES/);
});

test('invalid child binding performs no inspection and a future exit cannot be certified', async () => {
  const { inspector, state } = fixture(); await inspector.baseline(); const count = state.calls.length;
  await assert.rejects(inspector.inspectNamespace({ process: { ...child, pid: 1 }, exitedAtMs: NOW }), /PROCESS_BINDING/);
  await assert.rejects(inspector.inspectNamespace({ process: child, exitedAtMs: NOW + 1 }), /PROCESS_BINDING/);
  await assert.rejects(inspector.inspectNamespace({ process: { ...child, startedAtMs: NOW - 1 }, exitedAtMs: NOW }), /PROCESS_BINDING/);
  await assert.rejects(inspector.inspectNamespace({ process: { ...child, unchecked: true }, exitedAtMs: NOW }), /PROCESS_BINDING/);
  assert.equal(state.calls.length, count);
});

test('child getters cannot supply trusted identity or run during validation', async () => {
  const { inspector, state } = fixture(); await inspector.baseline();
  const count = state.calls.length; let getterCalls = 0;
  const untrusted = { ...child };
  Object.defineProperty(untrusted, 'pid', { enumerable: true, get() { getterCalls++; return 12; } });
  await assert.rejects(inspector.inspectNamespace({ process: untrusted, exitedAtMs: NOW }), /PROCESS_BINDING/);
  assert.equal(getterCalls, 0); assert.equal(state.calls.length, count);
});

test('concurrent baseline requests invalidate the owner rather than granting two baselines', async () => {
  const { inspector } = fixture({ hang: true, composition: { deadlineMs: NOW + 15 } });
  const pending = inspector.baseline();
  await assert.rejects(inspector.baseline(), /OWNER_UNAVAILABLE/);
  await assert.rejects(pending, /DEADLINE|ABORTED/);
  await assert.rejects(inspector.baseline(), /OWNER_UNAVAILABLE/);
});

test('namespace movement within a scan and backwards owner clocks are refused', async t => {
  await t.test('inconsistent namespace', async () => {
    const { inspector, io } = fixture(); let calls = 0;
    io.readlink = async () => ++calls === 1 ? 'pid:[42]' : 'pid:[43]';
    await assert.rejects(inspector.baseline(), /PID_NAMESPACE/);
  });
  await t.test('clock rollback', async () => {
    let clock = NOW;
    const { inspector } = fixture({ composition: { now: () => clock } });
    clock--;
    await assert.rejects(inspector.baseline(), /CLOCK/);
  });
});

test('read and listing size bounds reject untrusted adapter responses', async t => {
  await t.test('read', async () => {
    const { inspector } = fixture({ mount: 'x'.repeat(65537) });
    await assert.rejects(inspector.baseline(), /READ_BOUND/);
  });
  await t.test('listing', async () => {
    const { inspector } = fixture({ names: Array.from({ length: 4097 }, (_, i) => String(i + 1)) });
    await assert.rejects(inspector.baseline(), /PROC_COVERAGE/);
  });
});

test('abort, deadline and uncertain I/O seal the owner', async t => {
  await t.test('pre-aborted', async () => {
    const { inspector, controller, state } = fixture(); controller.abort();
    await assert.rejects(inspector.baseline(), /ABORTED/); assert.deepEqual(state.calls, []);
  });
  await t.test('mid-operation abort', async () => {
    const { inspector, controller } = fixture({ hang: true });
    const pending = inspector.baseline(); controller.abort();
    await assert.rejects(pending, /ABORTED/);
    await assert.rejects(inspector.baseline(), /OWNER_UNAVAILABLE/);
  });
  await t.test('bounded hanging adapter', async () => {
    const { inspector } = fixture({ hang: true, composition: { deadlineMs: NOW + 15 } });
    await assert.rejects(inspector.baseline(), /DEADLINE/);
    await assert.rejects(inspector.baseline(), /OWNER_UNAVAILABLE/);
  });
  await t.test('expired clock', async () => {
    const { inspector, state } = fixture({ composition: { deadlineMs: NOW } });
    await assert.rejects(inspector.baseline(), /DEADLINE/); assert.deepEqual(state.calls, []);
  });
});

test('actual procfs diagnostic refuses this shared environment rather than claiming native proof', async () => {
  // This source test intentionally has a test runner and other supervisor PIDs.
  // It is an adapter diagnostic, not admission of any deployed fixture runtime.
  const inspector = createLinuxProcNamespaceInspector({ deadlineMs: Date.now() + 3000,
    signal: new AbortController().signal });
  await assert.rejects(inspector.baseline(), error =>
    ['ENOENT', 'EACCES'].includes(error.code) ||
    /NAMESPACE_(?:SURVIVING_PROCESS|PROC_COVERAGE|PROC_MOUNT)/.test(error.message));
});
