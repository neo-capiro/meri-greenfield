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

Before closure, final review made the requested generic invalid-certificate exclusion explicit, including its mixed hostname/server-refusal forms. The same24 methods, with additional literal subcases, passed in a new source-bound run; the first corrected candidate d7cbe0b and its raw checked files/receipt remain retained. There was no failed invocation in this correction session. Final checks are E2/checks-2/process.json; root acceptance remains pending.
# Terminal-clause correction, E3

Independent review of sealed E2 found that the `server does not support tls`
substring also accepted TLSv1.1 and TLS extensions. E2 and its HOLD remain
immutable. E3 changes only `_reason`: a single supported no-TLS mention must
be the complete terminal colon-delimited clause. Malformed suffixes and mixed
hostname/certificate mentions refuse before any other positive reason. No
vocabulary, exception/response layout, native parser, bound or completeness
policy was added. The two new methods retain all previous 24 test bodies.
The one bounded inert suite passed 26/26 on 2026-10-11 at
06:36:22.580945–06:36:22.709214 UTC (0.140 seconds), fixed Python 3.12.14
`-I -B`, shell false and a 60-second external ceiling. Source/runtime pins
were stable, denied socket/process events were empty and Prisma was not
imported. Binary streams and the process envelope are in E3/checks-1.
The bounded inert suite result is recorded in E3; source qualification requires
independent review, and actual wrong-CA cause/native TLS/G1 remain unqualified.


## Root mixed-issuer correction after E3 SOURCE HOLD

The distinct E3 review found `unknown issuer: server does not support TLS` and
`unable to get local issuer: server does not support TLS` could pass plaintext:
the terminal-clause guard omitted the already computed certificate reason.
Root took the same three paths after the author released ownership. One guard
now includes that computed reason; one new test method exercises three issuer
forms across plaintext, wrong-CA and wrong-SAN. All 26 earlier test methods and
helpers remain AST-exact. Extraction, supported classes, response handling,
byte/tree/completeness bounds and native-output exclusion are unchanged.

Root ran the 27-method inert suite once under fixed CPython3.12.14 `-I -B`,
closed stdin, replacement environment and a 60-second external direct-child
bound. It passed27/27, exit0, 0.110 seconds; source hashes stayed stable,
no Prisma import and zero socket/process audit attempts. Raw streams, fixed
child source, prior exact three bodies, outline and receipt are retained in
`.task-inputs/prisma-error-evidence-4-root/`. E1/E2/E3 and their SOURCE HOLDs
remain unchanged. Final classifier11499B SHA256
`406aef930fb9712c7c17ada3205d125113a7894f5ad23419a92a2d759c6d90a2`;
test17014B SHA256
`199ad268f9fda65d3547d3520a859ae675728bf281a8235a833f76d81adcb386`.

Distinct final source review and integration-owner acceptance remain required.
No native parser, peer composition, new Linux run or actual certificate proof
follows from this repair. The historical wrong-CA cause stays UNKNOWN, its
build stays FAILED, and G1 remains OPEN.
# Native startup KnownError parser — source-only addition

Base `af5c0304d1779e1a5e686f2b110d85e0ebc4827e`; new branch
`task/g1-native-diagnostic-parser` in the same clean dedicated worktree. Earlier
branches, reports and E1–E3/root-correction evidence remain historical.

`classify_native_output(case, stderr_bytes, *, expected_user, expected_host,
evidence_complete=True)` consumes only complete bounded native fd2 DATA. It
imports no Prisma/native implementation and performs no I/O. The canonical
exception classifier and its 27 controls retain their bodies. Both public
functions are listed in `__all__`; no parallel reason classifier was added.

The result contains only fixed `case`, `specificRejection`, `reason`,
`tlsCandidate`, `source`, `recordCount`, and `complete` enums/counts/booleans.
Invalid caller cases become `INVALID`; private user/host/text/path/hash values
are never returned. One LF-terminated UTF-8 JSON object is required, with exact
KnownError keys, literal false panic, no duplicate keys, nonfinite values,
unknown/extra fields, GraphQL envelope, tracing record or extra stderr line.
Existing 64 KiB aggregate and structure limits are reused conservatively,
counting raw bytes plus decoded strings. Expected synthetic identity strings
are ordinary nonempty strings of at most 256 code points and 256 UTF-8 bytes;
the code rejects characters with `ord < 33`, DEL (`ord == 127`) and backtick.
It does not reject every Unicode whitespace/control character. Root must bind
these values to the trusted fixed synthetic fixture identity; these lexical
bounds and caller-supplied strings do not authenticate identity or origin.

Primary public source is pinned Prisma engines commit
`ac9d7041ed77bcc8a8dbd2ab6616b39013829574`. Root's closed discovery
`prisma-native-diagnostic-discovery-1/FINDINGS-2.md` and exact raw Rust copies
establish the renderer and formatters. The renderer writes a serialized
KnownError to stderr followed by one newline; startup constructors omit
optional `batch_request_idx`. The exact P1000 formatter in
`libs/user-facing-errors/src/common.rs` is:

```text
Authentication failed against database server at `{database_host}`, the provided database credentials for `{database_user}` are not valid.

Please make sure to provide valid database credentials for the database server at `{database_host}`.
```

P1000 requires exactly `database_user`/`database_host` meta, agreement with both
caller-supplied expected synthetic identities, and exact formatter equality.
It can report `PASSWORD_REJECTED` only for the wrong-password case; this does
not prove SCRAM use or authenticate the process origin.

P1011 requires exactly one `message` meta and exact outer formatter
`Error opening a TLS connection: {message}`. Only the pinned connector value
`error performing TLS handshake: server does not support TLS` qualifies
`TLS_UNSUPPORTED`, only for plaintext. Other P1011 values remain
`specificRejection=false`, `TLS_REASON_UNQUALIFIED`; `tlsCandidate` may observe
`CERTIFICATE_REJECTED` or `HOSTNAME_REJECTED` exclusively through existing
`_reason`, otherwise `UNRECOGNIZED`. No native CA/name wording is accepted as
qualified, and no DataError is fabricated.

One inert run passed **37/37** (old27 + new10),
2026-10-11 06:54:21.173061–06:54:21.291300 UTC, 0.125 seconds. Fixed
Python3.12.14 `-I -B`, shell false, external60-second ceiling, pre/post source
and runtime pins stable, socket/process audit attempts0, Prisma unimported.
New controls cover source formatters, case/identity mismatch, CA/name privacy,
strict framing, duplicate/nonfinite/unknown/panic/GraphQL/log shapes, exact
meta/outer agreement, incomplete evidence, malformed expected identities,
byte/depth limits and sanitized output. No parser test failed or was replayed.
Raw streams/envelope, source/Git reconciliation and public-source copies are
sealed under `.task-inputs/prisma-native-parser-1`.

Root must separately bind the genuine engine/process/config, complete private
capture and original deadline, actually caught exception, and non-conflicting
available evidence before composition. The parser cannot authenticate origin
from caller bytes or completeness flags. Actual wrong-CA cause remains UNKNOWN;
native TLS/auth/runtime/security/G1 remain open. No native, network, DB, Docker,
provider, image or fixture execution occurred in this source session.
