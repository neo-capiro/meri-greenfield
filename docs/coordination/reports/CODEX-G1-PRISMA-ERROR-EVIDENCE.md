# Prisma error evidence — source candidate

Date: 2026-10-11. Base: `2201364be32bc99a5abe68ce96c4d1e18d1a1e8c`.
Worktree: `C:/dev/main/meri-greenfield-worktrees/g1-prisma-error-evidence`.
Branch: `task/g1-prisma-error-evidence`.

This adds one pure diagnostic classifier and its inert tests. It does not establish the cause of the retained wrong-CA failure, accept native TLS, or advance G1. The canonical peer, URL configuration, private native-output capture, clocks, deployment and admission remain integration-owner responsibilities.

## Scope and interface

The only production source is `apps/proxy/qualification/linux/postgres-fixture/prisma_error_evidence.py`. Its public interface is `classify_exception(case, error, *, evidence_complete=True)`. Fixed cases are `positive`, `wrong-ca`, `wrong-san`, `plaintext`, and `wrong-password`. The returned ordinary dictionary contains only the fixed case, specific-rejection boolean, fixed reason/source/class enums and completeness. It contains no exception string, URL, password, response body, metadata values or stack.

The module imports only `json`, `math` and `types`. It performs no file, socket, process, response-reader or Prisma operation. It has no CLI or initialization side effects. Exception class/module labels identify the supported representation; they are not authenticated origin and can be imitated by synthetic objects. The integration must pass the genuine caught exception under its separately pinned source/runtime closure.

Supported extraction is deliberately narrow:

- Explicit `__cause__`, up to eight exceptions; implicit `__context__` is excluded.
- Exact `prisma.errors.DataError` fields `data`, `code`, `meta`, with code consistency and the constructor's shared meta identity.
- Exact `prisma.engine.errors.EngineRequestError.response`; the canonical `prisma.http_abstract.AbstractResponse.original` built-in slot; an `httpx.Response` stored `_content` byte value. No `content`, `text`, `json`, `read` or asynchronous response method is called.
- Generic `EngineConnectionError`, httpx `ConnectError`/`ConnectTimeout`, and built-in `TimeoutError` can be observed but cannot supply positive evidence. Unsupported classes/layouts refuse.

The structured error form is the `user_facing_error` record consumed by pinned Prisma's HTTP decoder. Buffered HTTP accepts only a nonempty lower-case GraphQL `errors` array, optionally `data:null`. It does not speculate about native startup-log or direct native-error emission shapes. Unknown keys, panic, malformed field types, unbuffered content and unsupported shapes refuse.

P1011 requires a specific certificate, hostname or TLS-unsupported reason; P1000 requires the supported password-authentication reason. The expected case must match. Generic TLS words, bare codes, generic connection failures, missing/unreadable CA files, timeouts and engine exit do not qualify. Hostname evidence is distinct from a generic certificate verification failure. Mixed incompatible or unspecified structured records refuse. Unknown reasons fail closed rather than expanding a permissive message vocabulary.

Bounds are fixed: 64 KiB aggregate examined UTF-8/raw evidence, eight causes, depth 12 and 2,048 inspected JSON values. Buffered bytes and decoded strings both count, conservatively reducing usable payload size. Strings and containers are checked before expansion/traversal. Raw buffered JSON rejects duplicate keys and nonfinite values. DataError data has already been decoded upstream: this module cannot recover duplicate keys lost by that earlier decoder and does not claim to do so. Incomplete evidence refuses. The caller's completeness flag is diagnostic input, not authority.

## Pinned upstream support

Read-only wheel: Prisma 0.11.0, 109,302 bytes, SHA256 `22bb869e59a2968b99f3483bb417717273ffbc569fd1e9ceed95e5614cbaf53a`, Apache-2.0. Relevant original wheel members are copied unchanged under the ignored evidence directory:

- `engine/query.py.jinja`, SHA `d9ad24e65377b2b38f5bd876684f7247db07093814b366d4c6df7da16df8116b`: spawn retains its last status exception using `raise EngineConnectionError(...) from last_exc`; native stdout/stderr inherit the Python descriptors. JSON logging is configured, but this task accepts no native output.
- `engine/errors.py`, SHA `06f795c9355fb605274ae0adaafd2e74f484f5ac4070619c08f4c84a4571d6b4`: generic connection error has no structured fields; request error retains the response.
- `errors.py`, SHA `3a53f61f5704e2bd526ad5d4b8088b796b592685266fcfb07e39431a75f5f4fe`: DataError retains data/code/meta.
- `engine/http.py.jinja`, SHA `9a496c3261802b09253d24287358a55c2b33dd770568d6ca453bda13554db967`: lower-case GraphQL error handling and retained non-2xx response.
- `http_abstract.py` and `_async_http.py`/`_sync_http.py`: `original` is a slot, and response methods would otherwise decode/read content.

The retained httpx 0.28.1 wheel is 73,517 bytes, SHA `d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad`. Its copied `__init__.py` assigns public class modules to `httpx`; `_models.py` stores buffered response bytes as `_content`. This is a version-specific private representation, deliberately refused if absent or changed. No third-party implementation was copied into the production module.

## Verification and retained development history

Evidence root: `.task-inputs/prisma-error-evidence-1`. Each `run-checks-N.py` invokes the fixed Python 3.12.14 executable with `-I -B`, shell false, replacement four-key environment, 60-second direct-child timeout, raw binary stdout/stderr and a machine envelope written before assertions. Each child denies socket/process audit events before importing the tests. All runs had stable measured source/runtime inputs, no denied external-action attempts and no Prisma import. The supervisor uses `subprocess.run` buffered capture and claims no live capture byte cap or descendant/kernel isolation; these finite inert tests created no child processes.

Development outcomes, all preserved:

1. 17/17 passed. Subsequent source reconciliation found the synthetic response fixture had missed canonical response slots; the initial extractor would have refused genuine responses. Checked source bytes are preserved under `checked-source-1`.
2. Corrected canonical slot extraction plus dictionary/property guards: 18/18 passed.
3. Added argument bounds and DataError meta consistency: 18 passed, one failed. The secret-bearing test changed data.meta without updating error.meta, violating the real constructor's representation. This was a fixture defect; source was not relaxed. Failed raw streams/envelope and checked source remain under `checks-3`/`checked-source-3`.
4. Corrected only the valid fixture's shared meta: 19/19 passed.
5. Added refusal of a hostile unknown input's class accessor and primitive class-label validation: final 20/20 passed at 06:19:47 UTC, exit 0, 0.094 seconds, no timeout. This is 20 final test methods, not 93 distinct cases across the five development executions.

The final checks cover nested typed rejection, buffered HTTP evidence, four distinct cases, generic/unknown refusal, missing CA, cause cycles/depth, explicit versus implicit causes, duplicate/nonfinite/malformed JSON, layout/property traps, byte/tree/value bounds, code/meta conflict, contradictory sources, incompleteness, and secret-bearing input returning only enums. No real TLS, engine, Prisma, database, Docker, AWS, provider or network behavior was exercised.

## Integration and open gates

Root must independently review this source before composing it into the canonical peer. A future private finite native-output owner is still necessary if the engine fails before `/status` and the retained cause is merely a local HTTP connection failure. Its exact engine-emission schema must be established before any native-output acceptance parser is allocated. This module must not be fed a fabricated native log as a DataError to bypass that boundary.

The consumed failed build `fe9f54bd` remains failed. Its wrong-CA receipt exposed only EngineConnectionError and no cause/native detail, so the retrospective TLS cause remains UNKNOWN. Positive TLS/nonowner evidence and successful cleanup do not convert that missing rejection proof into a pass. No existing pack, consume, authority, TLS URL, clock, source contract, runtime image or G1 gate was changed here.

## Correction after independent source HOLD (2026-10-11)

The original candidate21f5686 and E1 seal remain historical and unchanged. Independent review found two false positives despite its synthetic20PASS: `not valid for` also describes certificate validity/date/purpose, and generic `server does not support` also describes unsupported certificate algorithms. The original local suite therefore did not establish those classification boundaries. The integration owner allocated this narrow source correction; no runtime diagnosis or acceptance followed from the original suite.

Only `_reason` behavior changes. The broad hostname phrase is removed; supported hostname evidence is now explicit hostname/IP-address mismatch. No-TLS evidence requires explicit server TLS/SSL refusal, including `SSL is not enabled on the server`; generic support wording refuses. Certificate validity/date/purpose/algorithm wording and mixed incompatible reasons refuse. P1011 and exact case matching remain mandatory. Unknown native wording remains refusal pending separately pinned native-source investigation. No new error/response/property/native-log shape, public interface, budget, completeness, peer, URL, clock or environment behavior was added.

All20 original test-method bodies remain raw-byte identical. Four new methods cover date/expired/not-yet-valid/purpose/algorithm and generic support counterexamples, mixed reasons, and preserved exact hostname/IP/server-specific success plus wrong-code refusal. Final24/24 passed once at06:29:16.946237-06:29:17.065168UTC, exit0, no timeout,0.109seconds, under fixed Python3.12.14-I-B/60s external bound. Source/runtime inputs remained exact; zero candidate socket/process attempts and no Prisma imports. This correction introduced no failed test invocation; the original development failures and helper diagnostic remain preserved in E1. The supervisor retains its previously disclosed buffered-capture/direct-child limitations.

New evidence is exclusively `.task-inputs/prisma-error-evidence-2`; it includes original3rawfiles, outline, raw test streams/machine envelope, source AST/body reconciliation, all62 original E1 payload hashes verified unchanged, fresh rawGit/current source binding and a new finite seal. Original report snapshots and FINAL-MANIFEST were never rewritten. Source acceptance still requires distinct independent/root review. Native output capture/parser/peer composition and actual TLS/authentication/G1 remain open; the failed wrong-CA runtime cause remains UNKNOWN.
