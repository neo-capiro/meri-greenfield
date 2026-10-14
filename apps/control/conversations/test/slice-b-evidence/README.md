# Control source slice B — 2026-10-14

Base: `700f203e7b97b64207489d29e17e00014f7ff43b`. Source-only, synthetic local SQL protocol controls. No PostgreSQL, AWS, model, real credentials or shared database execution is claimed.

The canonical store owns completion identities and publication in `completion-journal.mjs`; `next-run-journal.mjs` consumes only genuine completion rows and reads immutable source checkpoint to target lineage. `sequence-ranges.mjs` seals a predecessor under the existing conversation lock. Lifecycle resume and next-run acceptance use the same allocator; fork starts at zero. Initial acceptance refuses a second unreserved run. Authenticated execution returns a distinct `nextTurn` descriptor and refuses ambiguous lifecycle lineage.

`begin` persists CAPTURING and the completion hold before physical capture, returning `capture:true` only once. A lost acknowledgment or UNKNOWN row never reauthorizes capture. `publish` validates the full canonical proof, inserts the exact verified/completed events and records the proof in one transaction. Failed/cancelled races win before publication. Runtime object readback remains the trusted runtime owner's responsibility; a UUID alone is not object-readback evidence.

Migration 0009 remains unallocated/unexecuted source. Its existing-row policy exclusively locks retained runs, rejects duplicate writer fences, reconstructs sequence bases from retained event counts, and closes every historical predecessor. No per-run event is renumbered. This is an explicit reconstruction policy requiring migration review and separate execution approval, not evidence of repaired existing databases. Closed ranges prohibit later source projection/last-sequence changes and event inserts.

The PostgreSQL fixture now uses real completion and native budget admission/revocation owners, including unrevoked refusal, actual COMMIT acknowledgment loss injection, three accepted prompts, and closed-range SQL trigger checks. It was syntax-checked but not executed: the allocated Unix-socket PostgreSQL environment is unavailable on this Windows host. Do not start or migrate the protected database from this task.

`local-controls.tap` and `typecheck.txt` retain the checks actually executed. The known integration HOLD test intentionally characterizes the unresolved resume problem: after committing a successor, current-run enforcement makes the original session stale, so existing postcommit `fresh()` prevents dispatch. It proves fail-closed behavior, not usable composed resume. A reviewed bounded transition-authority operation in the canonical session owner is required; stale historical session authority has not been relaxed.

The scripted fixtures model transaction rollback and lost acknowledgments; they establish owner behavior, not PostgreSQL trigger execution, native task retirement, object storage durability, or release acceptance. Historical proof manifests and unrelated rows were untouched.
