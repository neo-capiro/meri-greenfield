# Wave5 M5 durable artifact library producer

## 1. Scope and ownership

MM-11 / MF-14 library producer continuation from independently reviewed known-artifact history. M5 owns artifact storage/service/routes, tests and Git; A5 owns the private current-origin authority and public contract source/generation. Hermes independently reviews; root coordinates package integration and Release/native/deployed acceptance. Existing Research Portfolio and Wave4 finding work are unchanged.

## 2. Source lineage

Base `289df116f2d3c7d07e2d6627ef355a65cd0618be`, tree `3ef7dee47c736f651e0d394a148aae5a1ab9044c`. Branch `codex/wave5-m5-artifact-library-20261027`, task checkout `work/wave5-m5-artifact-library-20261027`. Existing Core peer remains `13fb7a401c0249bd50c90d163b6dfaf67fcafd46` / tree `aa91d4771c0a97d8bdd3bc6ba58a3cf27a606549`; no new Core mutation was required for origin reads. History and all original package/source checkpoints remain preserved.

## 3. Implementation

The explicit public list request is `{scope:'conversation'|'client'|'owner',limit:1..100,cursor:null|lowercase64hex}`. It returns `{scope,versions:DocumentVersion[],nextCursor}`. Original version, source binding, scopes and evidence are preserved. No count, hidden identifier, byte-verification claim or download-admitted brand is added.

The existing publication owner supplies bounded current-head candidates for the authenticated tenant/actor and selected scope, excluding terminal publications. These candidates are internal metadata, not authorization. The new cohesive artifact-library helper reuses canonical stored-record validation, operation lifetimes, current authority and retention. It scans at most `limit` candidates; each releasable row first receives a fresh same-user Core check for its actual original conversation/client, then the existing version read verifies SQL/publication/retention agreement. Release obtains a separate fresh origin observation and repeats retention. Only explicit access denial/suppression omits rows; unknown/unavailable/session failures refuse the request.

The private callback uses the caller's same live native bearer and the existing Core artifact endpoint. Core still owns current membership, conversation ownership, client and wall checks. Original scope facts and policy revisions never grant access; canonical single client/private-user source scope must match the current trusted policy. Observation caching exists only within this one resolved request and one phase, keyed by origin; release cannot reuse admission. Actual check times and expiry are preserved and validated, not restamped.

Cursor binds the current caller binding/scopes, query and candidate-head snapshot plus offset. It is a selector, never authority. A completely denied page may return no versions and a nonnull opaque continuation; consumers must continue and must not say end-of-library until `nextCursor` is null. Changed head/query/context refuses continuation with409 `ARTIFACT_LIBRARY_CURSOR`. Discovery and its release recheck perform no model call, write allocation, object-byte operation or new file store. Direct history/inspect/download same-conversation fences remain unchanged; selecting a listed origin requires its proper current session for those reads.

## 4. Focused author validation

Node24.22.1; task-owned links reuse exact retained dependency caches read-only. No installs or shared dependency mutations.

- New library storage2, service9 and actual external public-control/runtime-route3 checks PASS. Covers14 owned heads across pages/reconstruction, cross-conversation own results, colleague exclusion, scope filtering, empty denied continuation, current denial/suppression/release revocation, unknown failure, SQL corruption, candidate-head races, tampered query/context/cursor and truthful phase-cache timestamps.
- Existing history16 checks PASS after callback forwarding changes. Initial combined30 run had one assertion expecting the inner corruption code directly; the existing canonical wrapper is `RETENTION_STORE_UNAVAILABLE` with `ARTIFACT_VERSION_CORRUPT` cause. The assertion was corrected to that exact shape; final service9/9 PASS. No production correction was needed and the failed run is retained.
- A5 public list/history/inspect/download/native231/231 PASS; origin/current-conversation23/23 PASS; public TypeScript PASS. Both canonical generator `--check` commands and scoped diff hygiene PASS.
- Public list against exact old289df receiver fails `INVALID_ROUTE`; original authority baseline and release-cache mutation fail as expected. Original source bytes were restored before final checks.
- Direct physical0.1.22 compatibility remains6 inspect,6 download and18 matching refusal pairs PASS; old receiver refuses list/history.

Commands/logs are in the orchestrator's `work/wave5-library-*` and `work/wave5-m5-library-*` files and A5's peer handoff. No native database, renderer, build, browser, model, provider or target check was run. Previously independently reviewed history evidence and the six exactly reproduced old authority-fixture failures remain as recorded; the broad old fixture file is not claimed PASS.

## 5. Public and immutable compatibility

The unpublished document-access0.2.0 source now includes list and history while old inspect/download shapes remain. The frozen document-application0.1.0 runtime/types/schema are byte-identical. Its generator excludes exactly the two new read-only cursor errors after asserting409; source-binding metadata is canonically refreshed. Thus runtime/schema bytes are frozen while their shared-source provenance changes. No generated output was edited by hand.

## 6. Files and cleanup

Implementation follows the owned `OUTLINE.md`. The new library helper is called by the existing artifact service; there is no second store or orchestration owner. Runtime composition/application only forward the private callback. Existing native-file/history/write/preview owners remain in use. No replaced executable path is left dead. All test processes exited; no target, browser, model turn, native service or cloud resource was created. Reusable checkout/dependency links remain.

## 7. Remaining consumer and package dependency

MF-14 canonical frontend library/detail/history/deep-link consumption remains next. It must follow empty continuations, clear retained data on scope/lifetime changes and use original conversations for subsequent reads. The current physical contracts0.1.22/UIstream0.1.9 archives remain immutable and cannot receive this new wire surface. Root must allocate a fresh canonical package/peer cohort before physical consumer integration; no manifest, lock, archive, npm version or registry action occurred here.

## 8. Remaining qualification and full scope

This is source implementation of durable library/history producer behavior, not full MF-14 or Wave5 completion. Required native DB/access/deployed/reload/another-tab acceptance remains owed, as do the other M5 matrix requirements. Preview, upload/extraction, trusted conversational revision and distinct starters continue through existing owners. Share/comment/rename/delete remain unavailable until their canonical semantics exist. No credential or scope record is treated as permanent access.

## 9. State and next action

READY FOR INDEPENDENT SOURCE REVIEW once this clean checkpoint is committed. Root supplies the final head/tree through the author receipt. Continue the canonical frontend consumer and MB-04 work while independent review and A5's disjoint MM-10 preview continuation proceed. No push, merge, deployment, package publication or accepted live outcome is claimed.
