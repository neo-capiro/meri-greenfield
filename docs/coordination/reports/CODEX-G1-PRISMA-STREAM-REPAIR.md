# Prisma subprocess stream contract repair

This source candidate fixes a deterministic incompatibility between the peer's
suppressed Python streams and pinned Prisma's engine launcher. It does not pass
the failed Linux PostgreSQL/TLS experiment or admit native auth, proxy runtime or
G1. Root independently reviews this candidate and owns any new experiment.

Dedicated worktree: `C:/dev/main/meri-greenfield-worktrees/g1-proxy-prisma-stream-repair`.
Base: `f205c510518837a29ad8eb3da19e9af18ea56076`. Exactly three tracked paths
are owned: `prisma-peer.py`, `test_fixture.py` in the existing postgres-fixture
directory and this report. The proportionate outline and retained evidence are
under `.task-inputs/prisma-stream-repair-1`.

## Established defect and retained actual failure

The prior real build `9c08cd70-01ac-4f4d-bc38-8fecda952dcd` remains failed.
Its public `pg-tls--35-peer-positive.stdout.bin` contains a failed positive
control with `errorType: AttributeError`, providerCalls zero and runtimeAdmitted
false. The attached peer process exited 1, captured stdout 143 bytes and stderr
zero bytes, and completed its bounded capture. `pg-tls--result.json` retains
tlsControlsPassed false, nativeSchemaInitialized false, inputStable true,
ownedCleanup true, privateFilesRemoved true, four exact removed container IDs
and the removed network. This repair does not change those files or reinterpret
them as a pass. Only selected public result/receipt files were independently
read and hash-bound here; the entire cloud result bundle was not re-audited.

The actual peer intentionally retained only the exception class. There is no
native traceback identifying its exact frame. The concrete stream incompatibility
is independently established by the pinned launcher source and current sink:

- Prisma `0.11.0` wheel: 109302 bytes, SHA256
  `22bb869e59a2968b99f3483bb417717273ffbc569fd1e9ceed95e5614cbaf53a`.
- Its `prisma/generator/templates/engine/query.py.jinja` is 8180 bytes, SHA256
  `d9ad24e65377b2b38f5bd876684f7247db07093814b366d4c6df7da16df8116b`.
  Lines 152-168 pass `sys.stdout` and `sys.stderr` to `subprocess.Popen`, with
  `text: False`, when `QueryEngine.spawn` launches the genuine engine.
- Both redirected old `Discard` instances implement write/flush and lack
  fileno. CPython Popen's non-integer stream contract requires fileno. The
  retained local CPython3.12.14 subprocess source corroborates both Windows
  handling (lines1384/1406) and POSIX handling (lines1725/1745). This local
  source is not a captured native Python3.13.5 stack or binary proof.

Consequently the old sink cannot satisfy that launcher interface; a fileno
lookup on it raises AttributeError before that Popen can launch. This explains
a verified defect compatible with the actual classification. It does not prove
there are no further native failures. Wheel template, engine utils, package
metadata and Apache2.0 license bytes were verified against the wheel RECORD and
retained as DATA without importing Prisma or executing any engine.

## Minimal repair and preserved ownership

`Discard(fd)` now accepts only exact integer1 or2 and returns that descriptor
from fileno. The surrounding canonical context still duplicates and saves the
borrowed standard descriptors, redirects1/2 to devnull with dup2, restores them
in finally and closes only its duplicate/null descriptors. Python stdout uses
Discard(1); stderr uses a distinct Discard(2). No saved original descriptor is
exposed. There is no general-purpose stream wrapper, isatty/encoding expansion,
new resource owner or changed subprocess/Prisma implementation.

The same original per-stream Python write counter still raises after two MiB.
Native FD output remains suppressed into devnull rather than retained or counted
by that Python counter. The write counter was and remains a text-length bound;
it is not a native byte-stream limit. Original signal32s/async25s/disconnect3s
bounds, strict URL/CA handling, TLS predicates, content-free error classification
and final structured result output are unchanged. DATA reconciliation proves
the read, probe and main function ASTs unchanged, and all11 existing test
method bodies (plus the existing helper method) raw-exact.

The unowned canonical `native-runtime/native_auth_probe.py` remains unchanged
at13053 bytes/SHA256
`a5efa7a09624ebfa01d5e28e4ad9aea72c7f5f8e909642ff1438bb0b201affa1`.
Its `_DiscardUpstreamOutput` class at line48 lacks the same method. Both outer
`_discard_native_output` (lines78-79) and inner `_genuine_native_probe`
(lines196-199) redirect to that sink. Root must repair these separately before
claiming the later genuine native-auth launcher is compatible. The existing
native_bootstrap's FD-only discard does not replace Python stream objects and
has no instance of this particular missing-fileno defect.

## Checks actually run

One focused run on2026-10-11, 05:45:56.440763-05:45:56.618510 UTC:

`python.exe -I -B apps/proxy/qualification/linux/postgres-fixture/test_fixture.py -v`

Pinned bundled Python3.12.14; fixed replacement environment; shell false;
60-second direct-child timeout. **14/14 tests passed**: all11 prior groups and
three new groups covering fixed current descriptors and actual devnull writes,
restoration of Python/native descriptors after a body exception, and exact
two-MiB write-bound/invalid-descriptor refusal. The test audit hook denies socket
and process dispatch before candidate modules load. The suite uses synthetic
Prisma classes and immediate coroutines; actual Prisma is never imported.

`process.json` retains the machine envelope. stdout is empty; stderr is1764
bytes, SHA256
`954a5461ff59e5316a00ad0c8c42c312dab424ae24e319eb073b10667c2fcc6a`.
Synthetic suppression markers appear in neither stream. Complete bounded-source
before/after records are equal. The supervisor collects PIPE output before its
size check; it is not a live memory cap or a Windows Job/process-tree proof.
These are small fixed audit-denied local tests, not an operational supervisor.

The source-only reconciliation helper verified old test bodies and unchanged
peer domain functions, wheel RECORD members and the retained stream contract.
Git diff/check was inspected. No local check failed or was retried in this
repair. The actual failed native experiment remains explicit above. Git and
Python DATA/test children ran; no SDK/Prisma/native engine, Docker, database,
server, AWS, network, provider or image-build action ran.

## Handoff limits

The peer source is6970 bytes/SHA256
`68bc8f8311d30541b17da5c180e2983c6867708d5aabb48ed62ef4968fec1d41`;
test source is9654 bytes/SHA256
`56cd5760f63cc37043aa8c20b9fa4c306041c7f26efc979e95bfcf4b039fc7aa`.
The final finite manifest is separate from this report to avoid a self-hash
claim. Independent source review, canonical native-auth sink repair, refreshed
complete context/source admission and a newly authorized actual experiment are
still required. The original build/output/admission/clock/consumed slots remain
immutable. Real Linux TLS positives/negatives, schema/auth/lifespan and physical
cleanup acceptance remain unresolved by these local checks. Provider0; G1 OPEN.
