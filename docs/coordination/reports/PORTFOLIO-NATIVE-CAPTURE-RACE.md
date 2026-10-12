# Native checkpoint capture race candidate

## Scope and implementation outline

Bounded Codex assignment from the Portfolio coordinator, 11 October 2026.
Base `7b2e77b8739eeb48d96f3c6025de7aaec0f63549`, isolated worktree
`C:/dev/meri-greenfield-sessionstore-20261011`, branch
`codex/sessionstore-recovery-20261011`. Shared operating policy was fetched and
read at `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; machine map modified
`2026-09-30T00:21:48.2698715Z`. The working tree was clean before this work.
Current local `origin/main` was observed at
`fa00d587ddf7793457fde7191a24bfdef3b8a631`; no rebase or integration was performed.

Ownership is limited to `checkpoint/native-session-files.mjs`, the new focused
`checkpoint/native-capture-boundaries.test.mjs`, and this report. Existing
native-session tests, SessionStore implementation, public contracts, runtime
driver, infrastructure and dependency locks are unchanged. The canonical capture
module continues to own opaque bounded file preparation; trusted orchestration
continues to own quiescence, authority, fencing, workspace persistence and
checkpoint publication.

Before implementation, the proposed repair was recorded with the coordinator:
distinguish the owned config namespace from borrowed ancestors, retain full
metadata/content checks in the owned namespace, retain identity/type/owner
anchors above it, and test actual mutation/replacement boundaries. No new service,
framework, dependency, retry or fallback was introduced.

## Root cause and intentional behavior change

The original broad test run was 295/297, with two `SOURCE_CHANGED` failures from
the final `unchanged(roots)` call in native capture. That call compared full
directory metadata, including size, link count, mtime and ctime, for every
ancestor through the drive root. Parallel tests create/remove siblings beneath
shared temporary directories. Such sibling changes alter the shared directory's
metadata while leaving the selected transcript and parent inode unchanged.

A deterministic real-filesystem reproduction creates one unrelated sibling
beneath a borrowed parent during a transcript read. The original implementation
throws `SOURCE_CHANGED`; assertions establish unchanged transcript bytes,
unchanged parent device/inode, and changed parent modification timestamp. The
new positive regression initially reproduced that exact refusal. This is a
specific reproduced mechanism matching the original final-ancestor failure;
the historical run did not record the offending ancestor's full metadata.

Capture now keeps full metadata snapshots for `configDir`, `configDir/projects`,
the project directory, and every captured file/subdirectory. Ancestors above
`configDir` retain device/inode/mode/uid/gid anchors and repeated lstat/realpath
type/link checks. Their unrelated sibling membership may change. Replacing an
ancestor, changing its owner/type/mode, following a junction, or mutating the
owned namespace remains outside the allowed boundary and is refused where
observable. Directory link counts above configDir may change with sibling
creation; selected regular files still require a single link.

This is an intentional ownership clarification: the trusted caller must quiesce
the complete config namespace and prevent ancestor replacement, rather than
quiesce unrelated files all the way to the filesystem root. It does not prove
hostile-filesystem atomicity or detect changes made and reverted between checks.
The existing lack of atomic openat traversal and complete Windows reparse
qualification remains. Timestamp granularity limitations are unchanged.
Node's [Stats documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html#class-fsstats)
distinguishes device/inode/type identity from modification/status timestamps;
the reproduction, rather than documentation alone, establishes this failure.

## Checks actually run

Evidence is retained under the Portfolio task's
`outputs/evidence/sessionstore-candidate/native-capture-race/` directory.

1. **Original reproduction PASS:** the standalone diagnostic asserted the
   original refusal and unchanged session/inode, exit 0. The new boundary suite
   against original source failed its expected positive with `SOURCE_CHANGED`.
   Its initial two replacement fixtures also failed with Windows `EPERM`, because
   Windows would not rename a directory while the descendant transcript was open.
   Those outcomes remain in `native-boundaries-before.log`.
2. **Fixture scheduling repair:** replacement/junction mutations run immediately
   after the real transcript fd closes and before final verification. They still
   mutate real directories and retain the same refusal assertions. The positive,
   owned-root and same-length-write mutations still occur during the real read.
3. **Focused filesystem PASS:** all 14 unchanged native-session cases and seven
   new boundary cases, 21/21, exit 0, no skipped tests. The new cases prove
   unrelated sibling tolerance, refusal for config/projects/project mutation,
   refusal for actual borrowed-ancestor replacement preserving the transcript
   inode, refusal for actual junction replacement, and same-length file mutation.
4. **Focused qualification PASS:** static, native-session, new boundaries and
   SessionStore suites, 128/128, exit 0, no skipped tests.
5. **Full parallel suite FAIL:** `node --test probes/*.test.mjs checkpoint/*.test.mjs`,
   303/304, exit 1, no skipped tests. All native/SessionStore tests passed. The sole
   failure is unchanged `image-inventory.test.mjs:77`, whose Python scanner reports
   `directory/ancestor identity changed` for the shared temporary directory.
   This separate scanner deliberately checks full ancestor metadata and has a
   different security contract. It was not edited or weakened. The full suite
   remains non-green.
6. **Original scanner focused diagnostic PASS:** the unchanged image-inventory
   suite ran once on its own, 25/25, exit 0. This distinguishes concurrency
   sensitivity; it does not erase or accept the full parallel failure.
7. **Deterministic conversation-state regression PASS:** existing seven
   SessionStore Promptfoo custom assertions, Promptfoo 0.124.1, 7/7, exit 0.
   No model/native SDK query/cloud/provider call was made. These assertions
   preserve SessionStore semantics; the 21 filesystem cases verify this repair.
8. **Diff validation PASS:** `git diff --check`, exit 0. No runtime, dependency,
   lock, public contract, native-test assertion or deployment-plan change.

## Integration and recovery prerequisites

This is a review candidate on draft PR2, not G1 acceptance. Existing native
capture ownership and independent review must agree on the clarified boundary
before integration. The separate scanner's parallel shared-temp conflict remains
an evidenced dependency for its owner; no broader scanner repair is included.

The user's recovery recommendation remains intact: Claude SDK and Fargate,
native transcript files plus workspace snapshots as the primary immutable
checkpoint, with SessionStore qualified alongside. Native layout completeness,
SDK/process/subagent/tool quiescence, Linux/Fargate interruption and replacement,
authenticated durable storage, atomic fenced checkpoint publication, renewed
authority and external action reconciliation are **NOT RUN** here. No cloud,
provider, native SDK query, source activation, customer data, credentials,
deployment, merge or external message was involved in this candidate.
