# Remaining target engine assembly

Status: CLOSED, Codex source preparation from
`85619d4adddbda2a08dfb6a7be9c4fedacf51cd1`, pending independent review. This repairs
the missing target-specific query-engine inputs for the unchanged upstream
five-target schema. It does not establish generation, app import or runtime
admission. The earlier failed Linux build and its context remain unchanged.

A proportionate outline was written before implementation: extend pins,
reuse safe cache assembly, validate each generated target, retain inert failures,
then create a separate complete context after owner DATA acceptance. Only
`apps/proxy/qualification/linux/{assembly-pins.json,prisma-build.py,assembly.test.py,README.md}`
and this report are changed. No shared contracts, requirements, Dockerfile,
import probe, schema, old context or native engine was modified or executed.

## Accepted input and exact closure

The owner accepted recovery DATA before dependent source edits/copy: report
commit `c45f67eff756ae545b7163265348beb7e4b02bf8`, recovery seal
`5f23bc4980861531ca55ba56a5373716673519acdbcdc0e73325f69b9ec49e00`,
reconciliation `84b5fd44e535c92981729baf6bb720fae61332d7a38d8bc14e633cfa5f465de0`.
The accepted nine files are under the recovery worktree's
`.task-inputs/prisma-remaining-engine-data-1/recovered-cache-1/master/ac9d7041ed77bcc8a8dbd2ab6616b39013829574/`.
They contain three distinct bodies and two exact 64-byte checksum texts each:

| Query target | Body bytes | Body SHA256 |
| --- | ---: | --- |
| debian-openssl-1.1.x | 17,568,600 | `31628668b87cc70845652e5787757bebd591caaa07fe6739f85c208eb202a374` |
| linux-musl | 17,535,736 | `9af1fb0d0f97151e10fc2d9419c5be557cd7f78ac6e7965e0593218ee11b53f6` |
| linux-musl-openssl-3.0.x | 17,543,944 | `9472689617f471a63ddb59acdc2d07dc98882d0454499bba4256f7eed7f3b9af` |

All 321 old artifact records, all 124 wheel records, the 74,271-byte schema,
requirements and native Debian3 query/schema inputs remain exact. Nine artifacts
add 52,648,664 bytes: the new total is **330 artifacts / 271,935,624 bytes**.
The only changed pins fields are `prisma`, `artifacts` and `artifactTotals`;
inside `prisma` the delta is `otherTargetsAcquired`, `queryEngineMappings` and
`remainingEngineRecovery`. Gzip bodies were not acquired. Their checksum texts
are retained metadata, not compressed-payload verification or checksum bypass.

The retained genuine generated client has four concrete `BINARY_PATHS.query_engine`
keys: Debian1.1, Debian3, musl and musl3. `native` resolves to Debian3; it is not
an invented fifth output key. All five original schema targets remain intact.

## Focused implementation

`query_engine_inputs` validates a closed four-target mapping, unique exact keys,
fixed artifact paths/kinds and body/sidecar bounds. `verify_query_engines` checks
all mapped bytes and the uncompressed checksum-to-body relationship. Existing
streamed copying/hash checks populate each target's own upstream cache directory;
only Debian3 receives the native schema engine. Existing cache/output paths are
refused, including broken links. No platform receives another platform's bytes.

Future genuine generation must return exactly those four keys, each fixed
`/opt/prisma/binaries/node_modules/prisma/query-engine-<target>` path and that
target's pinned body/size. The validator refuses missing/unknown/native-alias keys,
other paths, drift and another accepted platform's body. The original generation
command, 240s child deadline, network-none build requirement and raw-output bounds
remain unchanged. No engine override or generated-client substitution was added.

Final source identities before commit:

| File under linux/ | Bytes | SHA256 |
| --- | ---: | --- |
| assembly-pins.json | 276,134 | `ebf200547b05f4e0fe7a3878df188148a8c010084cc6a553fa77a734ee52cc41` |
| prisma-build.py | 19,316 | `3b5abbca90301329a5cf8ef61db416b9d0249dfe38367a35c90fa651f725b798` |
| assembly.test.py | 17,466 | `593257c88923c5f4656b70a5ef50dc23b12a4954627717f69936062548d36873` |
| README.md | 7,838 | `2b6c8d81b8caa5ae3dbe270ef6f7d3480e3cebd1e56217f1ffb5d0bdfc9f2d6f` |

## Actual checks and preserved failures

Pinned CPython3.12.14 ran `-I -B -S assembly.test.py` in two distinct bounded
children with shell=false and binary stdout/stderr retained. All 18 original
test-method ASTs remain exact; six focused methods were added for mapping,
missing/wrong body, sidecar relationship, cache paths and generated-target checks.

1. At 03:21:08.131804–03:21:11.129859 UTC on 11 October 2026, **23 PASS / 1 ERROR**
   out of 24. The new deep cache fixture exceeded Windows MAX_PATH. Exit1,
   2.985s child; process receipt SHA
   `baeedc7ff1b465caad167a4a99c5126045e4cdd315a834546c8449f9cef554c9`.
   Exact seven source bytes and the 4,726-byte stderr are preserved in
   `source-checks-1/`; stderr SHA
   `85c0b4e099b358ff9e5bfa904abe7dd493a4ee8a001651092023d3c6fefd0929`.
2. Only the new temporary test path received the Windows extended-length prefix.
   At 03:21:55.176229–03:21:57.064373 UTC, the justified replay passed **24/24**,
   exit0, 1.875s child. Receipt SHA
   `b1faa674144425f98b95ba729b84b4c849bc4f4f4b49d02586d011a6589f7124`;
   3,216-byte stderr SHA
   `24cf2fa795d4d063e466c191b62aadaadefe450049cb2fa27c0761b5bf80b813`.
   Both runs have empty stdout and seven stable source pre/post records.

The wrapper has a direct-child 120s timeout and finite post-completion capture;
it does not certify process-tree containment. Audit guards deny socket/process
effects in these inert tests. After tests, README received only a line reflow;
the report and DATA evidence were finalized without another behavior replay.

## Complete context and Windows path evidence

Evidence base, relative to this dedicated worktree:
`.task-inputs/linux-remaining-engine-assembly-1/`.
`FINAL-MANIFEST.json` seals finite evidence/current source records; the separate
postcommit readback binds raw Git blobs and the exact five-path scope.

The first context copy failed on a Windows long filename. The original helper
and **326 files / 271,537,462 bytes** remain in `context-artifacts-1-FIRST`.
Every retained partial member matches its pinned input; no mismatched file was
overwritten. The original preparation error is retained in the tool trace, not
misrepresented as a binary subprocess capture. A newly named DATA helper
`complete-context-2.py` copied a fresh `context-artifacts-1` with native Windows
extended-length IO, verifying all input/destination bytes before and after copy.
It changed no artifact boundary or schema.

The requested complete manifest is `artifact-context-manifest-1.json`,
**68,575 bytes**, SHA
`91dd2b9b171d3db7e1a170ab60b9599c244fb6e03b0ccfc7306573a37644824a`.
Its four keys are `contextArtifacts`, `assemblyPins`, `requirementsLock` and
`artifacts`, binding the final complete directory. It is not the failed partial.
The longest final relative member is the websockets15.0.1 Linux wheel filename:
**122 relative characters / 268 ordinary absolute path characters**. The
partial's longest retained member is the charset-normalizer wheel:
**112 / 264 characters**. Later Windows preparers need extended-length IO and
membership enumeration; they must not silently omit a long member.

`scope-data-proof.json` records exact old/new pins, old18 AST preservation,
protected Dockerfile/requirements/import-probe identities and complete final/
partial artifact hashes. The complete context is DATA only, with no package
install, engine execution, generation or upstream application import.

## Limits and owner next action

This author result requires distinct source review and a separately frozen fresh
Linux build/import action. Actual generated paths/bytes remain unmeasured for
this repaired context, and may still fail. No build, ABI, native authentication,
SessionStore, provider, database, network or G1 acceptance follows. Existing
security and license/notice holds remain open; no enterprise package or whole
upstream image was adopted. All prior source/context/build failures remain
preserved and consumed actions remain consumed.
