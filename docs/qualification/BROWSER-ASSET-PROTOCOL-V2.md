# Browser-host asset protocol v2

Codex internal implementation decision within the user's D005 authorization and D006 packaging scope, adopted10October2026 after accepted W20/W21 source composition. This is the owner-frozen protocol for separately allocated23A/B/C source tasks. It adds no human approval, product/shared contract change, placement change, cloud dispatch or deployment admission. The original preparation draft and proposal/source challenge stay immutable history. [W21 composition acceptance](../coordination/reports/W02-21-COMBINED-INTEGRATION.md) closes only its source-integration prerequisite.

Replace D006's flat-three payload for the future v2 path with exactly **14 raw source payloads**:
`bootstrap.sh`, `host-evidence.py`, `seccomp.json` and the eleven fixed `host_evidence/*.py` files
listed in INPUTS-DATA.json. The source checkout profile name maps to runtime `seccomp.json`.
No directory glob, basename collapse, arbitrary resolver or fifteenth source module is allowed.
Generated `source-manifest.v2.json` is separate DATA, never a support-image payload or self-hash row.

The fourteen runtime paths, in exact lexicographic record order, are `bootstrap.sh`, `host-evidence.py`, `host_evidence/__init__.py`, `host_evidence/admission.py`, `host_evidence/browser_capture.py`, `host_evidence/classification.py`, `host_evidence/cli.py`, `host_evidence/collection.py`, `host_evidence/config.py`, `host_evidence/evidence_io.py`, `host_evidence/export_protocol.py`, `host_evidence/poll.py`, `host_evidence/source_binding.py`, `seccomp.json`.

Final installation `/opt/meri-browser-host/` contains exactly the four files `bootstrap.sh`,
`host-evidence.py`, `seccomp.json`, `source-manifest.v2.json`, plus directory `host_evidence/`.
The package directory contains exactly the eleven literal `.py` files and no subdirectories.
Before manifest creation the loader permits the same tree minus that DATA file; after creation,
the entry and source API require the finalized tree. Reject v1, unknown/mixed versions, extra files,
`.pyc`/`__pycache__`, aliases, links, special files and missing members; no seccomp-name fallback.

Freeze the inner source object as exactly:
`{schema:"meri-browser-source/2",assets:[{path,bytes,sha256},...14]}`.
Records are in fixed lexicographic runtime-path order with exact keys. Paths equal the finite list;
sizes are positive exact integers (booleans rejected), at most 2097152 bytes; hashes are exactly
64 lowercase hex characters. Manifest is strict duplicate-free ASCII JSON, sorted object keys,
compact separators and one final LF. Maximum manifest bytes **32768**; aggregate payload bytes
at most **14 × 2097152 = 29360128**. Reads are additionally bounded by each expected record's
actual reviewed byte length and require exact length/hash, not allocation of every nominal maximum.
No lossy text decode/re-encode is permitted. The manifest contains no own hash, source commit,
support digest/config, template hash or run UUID; those identities remain externally bound.

Trust begins with ROOT's reviewed source closure, exact immutable support digest and run-bound
template/loader metadata. The loader exclusively creates the protected installation, checks the
fourteen files against its literal expectations, applies final modes and then checks type/identity/
bytes/modes, writes the exact owner-expected manifest exclusively and reopens/verifies it. The
installation/package directories are root-owned0700, files root-owned0600; fixed ancestors must
be non-link directories and not writable by other principals. Entry verification relies on that
reviewed loader and uncompromised privileged host. Root can still write0600 files: this is not an
immutable mount, hostile-root defense or cryptographic authentication of the entry's first instruction.
An entry self-check cannot independently recover a replaced owner's expectation. Export admission
must compare the exact externally retained expected five-key context, never guest self-consistency.

On the sole real `__main__` path, the existing entry runs a finite stdlib-only gate **before any
host_evidence import**, adds only the validated installation root to sys.path and then performs the
existing ordinary direct imports/aliases and guarded CLI call. Named fixture imports remain inert;
they do not pass runtime admission. Package CLI invoked by an arbitrary Python caller is outside
this reviewed executable path. No environment root selector, test mode, caller manifest/root/expected
map, v1 downgrade, arbitrary loader, production monkeypatch/proxy, exec/eval or dynamic resolver.
The gate remains a focused private responsibility in the existing entry, not a new payload member.

Every guest Python invocation uses **python3 -I -B**: 23A updates bootstrap observer/inline sites;
23B later updates loader parent/verifier sites. The first timer observer invocation must gate too.
Preserve bootstrap heredoc bodies, deadlines, traps, cleanup, worker tuple, container commands and
original timer. Python3.9 grammar/API compatibility is required; actual guest patch/version and
filesystem facts remain unrun gates. Windows fake metadata is not Linux/root installation evidence.

Permit only `source_manifest`, `_context_ok`, and the source-path/fallback portion of `_inspect_reasons`
to change among legacy production bodies. Remove the historical v1 fallback. Preserve signatures,
defaults and direct defining-module aliases; `_source_root()` remains byte-identical. Keep all39
earlier bodies and the other21 moved bodies frozen, all48 named bindings and their original38
assignment ASTs unchanged. Preserve the accepted defining-module order:36 config rows and two
collection state rows, plus full38 AST multiset; new finite protocol constants are separate additions,
not an excuse to claim38 total rows. Keep cancellation/cache identity and effective caller patching.
The outer context remains exactly `{run,supportImage,workerImage,profileSha,source}`. Assembly,
export encoding/reconstruction, admission predicates outside the selected block and CLI bodies stay
raw-identical. `_context_ok` is total/type-strict boolean validation; malformed source data must not
raise or become a partial success. `source_manifest()` either returns fully verified v2 data or raises
a bounded content-free OSError/ValueError refusal compatible with existing frozen callers.

Version the tests honestly: original39/24 raw maps, three original oracle files and raw captures remain
immutable. Adapt only the allocated fixture paths for v2 source/context and the new entry helper
inventory; distinguish named-import API/fake-filesystem tests from execution of the main-path gate.
Keep23 direct +23 embedded (repeated) +33 owner observations distinct. Historical v1 fallback positives
become explicitly labelled v2 refusal cases, without rewriting the originals. W21 focused10 describes
frozen W17 payloads; it is not a current-W20 or v2 suite. Preserve its raw history; allocate a separate
future test migration rather than repinning, skipping under the same PASS label or running it blindly.

Phases remain separate:23A Python protocol;23B JS finite loader/source metadata and new v2 proof;
23C versioned local support recipe/archive preparation. `sourceManifestCoverage=false`, **INCOMPLETE
RUNTIME ASSEMBLY / NO-BUILD / NO-HOST** remain until the complete23B+C closure is separately reviewed.
Source commit/image/config/template/run bindings remain external. No legacy build/helper execution.
Later packaging order is private auth→pinned ECR push/readback→owned auth/container cleanup proof→S3
result publication; failed post-push cleanup leaves an unadmitted image, not transactional rollback.
Whole-build success and independent owner readback remain external gates. No cloud dispatch is added
by these source phases. Existing loader success-path arithmetic is not a hard all-path cleanup proof;
its unbounded poweroff remains a separate native limitation, not silently fixed in23A.

App/control remain independent Fargate; worker bf55/config6f313/source0be tuple unchanged. No source
connection, provider key, paid inference, new permission, current Meri/Capiro change or cutover.
49 findings /22 severe OPEN, Office DEFERRED, legacy JS classifier UNQUALIFIED, native/security/G1 OPEN.
