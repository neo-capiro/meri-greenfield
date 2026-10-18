# Outreach explicit-client name correction — 2026-10-17

## Approved outline before implementation

Base: public PR125-equivalent source, commit `4359e05bd11b7756d4f1d42fcd2243b3e07f126b`, tree `aa31607522e34df3bca96b9e381caae0d599d398`. Root approved the following narrow interface before source edits. This lane owns only `apps/gateway/sources/outreach-query/{handler.mjs,request-context.mjs,test/**}`, this report and its raw verification evidence. Shared credential/context wiring, current native/task grants, provenance, SDK registration and accounting remain root-owned.

- Split pure canonical raw admission into `captureOutreachListClientReference(request)` and `captureOutreachListClientSelection(request,resolution?)`. Preserve the existing trim/clip-80/trim grammar, all own `outreachId` refusals and missing-client refusals. Names require an exact closed `{reference,clientId}` observation; the selector itself grants no access.
- Reuse the existing fixed native handler and `credentialsForCall` boundary. Names require that per-call boundary. Keep the original request, normalized arguments and client-resolution proof; rewrite only the campaign endpoint's named `clientId` to the observed UUID. Legacy UUID requests retain their original HTTP body.
- Preserve exact one-client subject/resource checks and the canonical output validator. Reuse the actual native check-ref reader through root's current identity, membership and task-wall owner. Do not add a second lookup, grant issuer, clock, rollout mode or endpoint.
- Test name projection and unchanged raw proof, static fallback refusal, malformed/foreign resolution, opaque ambiguous/unavailable resolver failure, current-grant denial, and UUID compatibility with bounded synthetic HTTP. Retain initial failures and full output. Source fixtures do not establish live source qualification.

The operation remains **PARTIAL_INPUT**. Unscoped campaign predicates and detail resource preauthorization still require the existing Core owner work. No whole-family completion or SDK promotion is requested.

## Implemented interface and evidence

The approved helper signatures are implemented. Missing named resolution is `UNAVAILABLE`; malformed, hostile, mismatched or non-lowercase UUID observations are `ACCESS_DENIED`. Canonical malformed requests stay `INVALID_ARGUMENTS`. The handler requires `credentialsForCall` for names and verifies exact `{clientResolution}` context, normalized client ID and the existing exact one-client subject/resource. The shared helper receives the original call and hashes the original request. Only its fixed campaign HTTP body substitutes the resolved UUID; `status`, `limit` and every other admitted raw argument remain unchanged. Legacy UUID bodies retain original spelling, whitespace and clipping input. No credentials, clocks or resolver reason are included in the output.

Root's shared source-context owner consumes `captureOutreachListClientReference` for early admission and existing native check-ref observation, then supplies the optional resolution to `captureOutreachListClientSelection`. That owner retains principal/identity, current native membership, current task and selected-client checks and pins the reference through rechecks. The adapter adds no lookup or grant owner. The synthetic fixture's new optional `storedCase(id,{request,resolution})` argument leaves existing callers unchanged.

The existing Core behavior was reread through the source connector at immutable commit `b525032222515d636b0dae2d46e40c7c3d8b5528`:

- [Native check-ref route, controller lines 601–603](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri.controller.ts#L601-L603), blob `598e9146e5568349f213cbd548de0213113dc924`: existing `POST /api/clio/clients/check-ref` accepts `{ref}` using the current tenant context.
- [Check-ref service, lines 2494–2505](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2494-L2505), blob `32a7a744ba9ab812337baaf6093a37540864333b`: closed success or false/reason wrapper; no authority receipt or wall grant is issued.
- [Resolver, lines 9714–9757](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L9714-L9757), same blob: trim, same-tenant non-archived UUID lookup or unique case-insensitive exact client name; ambiguity and missing names refuse. The adapter does not interpret or expose their reason strings.
- [Campaign list, lines 8848–8890](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L8848-L8890), same blob: the explicit resolved client narrows the existing list read. The own-detail-key refusal prevents entry into its compound detail branch. The earlier [list-slice audit](CODEX-OUTREACH-LIST-SLICE-20261017.md) retains the independently pinned engagement predicate, scalar receiving and nested-detail analysis.

## Focused verification and freeze

Node `v24.19.0`, borrowed exact dependencies, serial tests, 256 MiB heap; no installation or build. Exact executable, argument vector, working directory, timestamps, exit status, byte counts and untruncated stdout/stderr are retained in:

| Capture | Result | Evidence |
| --- | --- | --- |
| Initial focused source run | 21 passed / 6 failed; exit 1 | [metadata](outreach-name-correction-20261017/source-tests-initial.json), [full output](outreach-name-correction-20261017/source-tests-initial.txt) |
| Corrected focused source run | **27 passed / 0 failed**, exit 0, 1.416 s | [metadata](outreach-name-correction-20261017/source-tests-final.json), [full output](outreach-name-correction-20261017/source-tests-final.txt) |

The initial failures were retained before repair. Five new test failures came from composing the actual reader with the generic gateway fixture's non-UUID identity placeholders and omitting the existing native-owner failure translation in the synthetic credential port. The remaining failure expected `ACCESS_DENIED` for a malformed multi-ID client subject; the existing canonical subject validator fails closed as `INTERNAL_ERROR` before this adapter. Only the new test setup/expectation changed. Production bytes did not change between these runs. The test still asserts no credentials and no campaign HTTP for that malformed subject.

New tests cover exact UTF-16 clipping/Unicode, inert hostile-object rejection, missing/malformed resolution, named per-call requirement, raw-call identity and private request hash, UUID-only body bridging, no static fallback, foreign selection/subject/resource, native false ambiguity/missing reason suppression, Nest201, unavailable/HTTP/malformed native resolver failures, unchanged UUID behavior, canonical output predicates and transport lifecycle limits. All 13 previous source tests remain; only the formerly unsupported named branch moved into new explicit per-call tests. Unscoped and every own detail-key refusal remain asserted.

Reproduce from the repository root with Node24 and the existing dependencies:

```powershell
node --preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000 --test-reporter=tap apps/gateway/sources/outreach-query/test/handler.test.mjs apps/gateway/sources/outreach-query/test/name-correction.test.mjs
git --no-optional-locks diff --check
```

Whitespace check passed. The two production modules and three owned test files are frozen at these SHA-256 hashes:

| Path | SHA-256 |
| --- | --- |
| `apps/gateway/sources/outreach-query/handler.mjs` | `ba28007c0da94fd9288000c8015db07fc41539ded544d3d10d0c8e43620de491` |
| `apps/gateway/sources/outreach-query/request-context.mjs` | `682da23f050dc0ec1bd0622209e44f970f5de2ac29068f5328b5896aa6f6a57c` |
| `apps/gateway/sources/outreach-query/test/fixture.mjs` | `0ba3ed7fdf8f3f07ee95585a62a220f94d6f73da1823484d2350d19605e55781` |
| `apps/gateway/sources/outreach-query/test/handler.test.mjs` | `386760041d85ee3070bdb6bdb12966973e6a78c6776eaed2d44024541501d647` |
| `apps/gateway/sources/outreach-query/test/name-correction.test.mjs` | `6d2822750ef9f2b5fe1110c4143e9cfa91facf9ff29a146a926ed5f94b70398f` |

Independent source review, shared current-native/task-owner integration tests and source-provenance refresh are root-owned and pending at this lane's freeze. These local source/reader fixtures do not prove live native membership, wall enforcement, source availability or current data. The operation remains partial and SDK-held. No shared owner, SDK, registry, contract, ledger, lockfile, startup, deployment or Core source was edited by this lane; no live call, install, build, stage or commit was performed.
