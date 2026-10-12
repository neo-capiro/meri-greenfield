# Credential separation and physical sentinel — source acceptance

**ACCEPT source; HOLD image/runtime; G1 OPEN.** This continuation starts
at imported head `7e4e3f8579b716148ce9c4d67e47fc497356e49e` and does not
deploy it. Final independently reviewed and tested source is
`9d044f1396aa28e66987d0525ca2b21eda380d6b`, tree
`e34962f5a75a831c5485a451967c2c254902df8b`. Implementation is in `b5c03b6`,
with two visible test-only prerequisite corrections in `8ecd009` and
`9d044f1`. No remote merge or publication occurred.

## Problems fixed and canonical owners

The old resume driver sent stale A context using B's gateway. The canonical
credential resolver correctly rejects B's certificate/A's audience with
HTTP 403, so that request cannot establish typed A revocation. The driver
now uses B's gateway for B only. `checkpoint/resume-admission.mjs` validates
public admitted A/B metadata, constructs the exact existing correlated
authorization request and invokes a separately admitted owner port.
`scripts/qualification/sdk-stale-worker-challenge.mjs` alone borrows A's
original transport and returns the actual canonical stale-decision response.
It is excluded from worker packaging. No A key or transport belongs in B.

Both modules call the existing replacement validator before dispatch and
reuse the existing private request/response contracts. Foreign tenant,
namespace, pins, identities, correlation, freshness and current B metadata
refuse before restoration. Attempts reserve before awaiting possible
effects; uncertainty cannot authorize a retry. Timer preparation checks
the clock synchronously before scheduling owner work. The actual loopback
test uses separate A/B certificates and individually scoped synthetic
lookup audiences: B/A returns raw 403/empty body while the owner obtains
A's typed stale denial. The lookup is not PostgreSQL or ECS identity proof.

The old sentinel was a DTO only. `checkpoint/fixture-sentinel.mjs` now
owns one fixed Linux file, `qualification/continuity.txt`, under a borrowed
exclusively owned/quiesced root. It validates the existing 65,536-byte
grammar before copying/decoding, anchors directory descriptors, refuses
aliases/links/hardlinks/FIFOs/substituted objects and existing paths,
fsyncs the file and created directories, and checks actual readback.
Failure cleanup removes only identities it created, retaining foreign
entries and reporting incomplete cleanup. It never removes the borrowed
workspace root or claims full-workspace snapshot support.

The phase driver requires a sentinel: A writes before query and verifies
after observed exit/drain; B supplies its exact immutable file to checkpoint
verification, restores it before query and reauthorizes. The channel binds
explicit expected file data to its stored/loaded sentinel before any
commit/verify dispatch. Its prior callers can still omit that optional
argument; the phase driver always supplies it. Post-resume physical
verification also occurs before the driver returns.

Private `qualification-sdk/validate.mjs` retains domain ownership: the
existing replacement function is exposed without changing its body or
original internal arguments, a small sentinel validator reuses existing
shape/bytes checks, and the JSON-data guard now refuses Proxies before
traps. Public `0.1.0`, schemas, TLS rules, registry audiences, four wire
operations, package versions, source availability and absolute D720/C900
clocks are unchanged. Both completeness flags remain false.

New responsibilities live in cohesive modules rather than accumulating
transport/filesystem rules in the phase driver. All UI remains in the
separate frontend repository; no Capiro implementation was imported.

## Exact source checks

All **13 commands** met their expected result against final source `9d044f1`.
The SDK suite ran alone with serial test files and an exclusive TMPDIR;
remaining independent checks ran with bounded concurrency afterward.

| Check | Actual final result |
| --- | --- |
| `check:sdk-evidence` | 357 passed; no skips |
| Root contract check | 182 passed |
| Public distribution | Generated-byte/type checks and 7 tests passed |
| Worker package | 197 passed |
| Control service | 36 passed; 2 explicit isolated-PostgreSQL skips |
| Actual local mTLS ingress/channel | 30 passed; listeners physically closed |
| Context/pin Python tests | 21 passed |
| Source-pin generation check | 19 exact records verified |
| Fixed context assembly | 53 members, 994,107 bytes, source-only |
| Driver and source-pin help/missing configuration | Four expected exit codes: 0/2/0/2 |

Suite counts overlap because canonical shared test fixtures also register
their cases; do not sum them into a count of unique acceptance scenarios.
Context-manifest SHA-256 is
`da96000546d9688bafd50ffb5d6101ce5a76300e65a47bfb5ea55a1273bd13a4`.
Raw final outputs, exact commands and source byte/hash records are under
`docs/qualification/candidates/runtime-wiring-20261011/`. Independent review
checked all 19 pins against frozen Git blobs and accepted module boundaries,
data/allocation guards, file binding, assertions and clocks. Diff formatting
passed. Existing build-authority hashes deliberately remain unchanged;
this revised context has no image-build admission.

## Failures retained and corrected

The first precommit integration check passed 72/75: three old observer
fixtures used a non-Sentinel placeholder and were rejected by the new
mandatory bound. They now use the canonical fixture. The prior sentinel
object-identity assertion intentionally became exact-data equality plus
distinct immutable capture assertions; original lifecycle/error assertions
remain. The first broad `b5c03b6` check then found two stale 49-member test
counts and a deadline test only 1 ms outside the production 30-second
limit, which could become valid during validation under load. Counts now
assert exactly 53; the invalid input has adequate margin, with the same
production bound and refusal assertion. The `8ecd009` test-only edit
introduced an indentation error; independent review caught it and `9d044f1`
restored the original scope. Final 13-command rerun passed.

Failed captures/results remain losslessly base64-encoded under
`earlier-failures/`, with decoded byte counts/hashes. They are not acceptance
evidence and have not been overwritten by successful outputs.

## Remaining work and shipping boundary

The published digest still has recorded **47 findings, including 5 critical
and 17 high**. This code does not remediate it. The fresh-image disposition
report records verified vendor leads and the missing complete immutable
scan/component/notice evidence; no coherent patched Trixie set was qualified.
A rebuild of the same pinned recipe would not resolve those findings.

Real owner-port delivery/provenance, trusted signer/UID/PID/IAM placement,
four signed-record byte delivery and S3 publication, real PostgreSQL/ECS
identity/credential issuance, thin control/native-owner entry points,
actual A STOPPED/B restoration/resume/stale denial and independent cloud
cleanup remain unqualified. No in-process callback or local file test
proves those boundaries. Complete SessionStore/workspace/subagent/
compaction recovery is a separate qualification obligation.

**No AWS command, image build, native SDK/CLI execution, provider call,
customer data, production cutover or deployment occurred.** Prepare and
independently review exact source/image/resources/IAM/network/cost and
cleanup before requesting the user's AWS shipping approval. The prior
build approval was consumed; this source acceptance grants no standing
cloud authority.
