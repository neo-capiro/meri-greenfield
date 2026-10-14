# Next-turn source candidate — HOLD

Pickup: `700f203e7b97b64207489d29e17e00014f7ff43b`, tree `ffbcfe3da380439ec73aa5d4c4a2243759791f92`. Dedicated Codex worktree and branch. Source-only implementation authorized by root's 14 October review. No cloud resources, image builds, credentials, provider/model calls or shared database changes.

## Implemented owners

- Control commit `264a6a73c9838e3057b8a6fcc5f36fa0d18ebfbb`: locked current-run/reservation selection, sealed sequence ranges across next-run acceptance and lifecycle resume, completion capture claim/publication journal, dedicated completion table source, and distinct immutable next-turn execution lineage. Its local evidence is under `apps/control/conversations/test/slice-b-evidence/`.
- Context commit `761daa71ed755aed1c18d5565bb538a54bae8fb9`: optional trusted run selector, preserved fixed binding without it, exact before/after current run/backend context and original deadlines.
- Runtime completion: `checkpoint-publication.mjs` shares captured-byte/object verification with lifecycle capture; `completion-capture.mjs` claims one durable identity before physical capture and reconciles a lost publication acknowledgment by immutable proof. Real `createTaskCheckpointSource` supplies the frozen SDK snapshot and actual temporary workspace bytes in local controls. Worker capture precedes input/query disposal and publishes no second completed event.
- Restore: distinct `nextTurn` descriptor and canonical reader, shared validator, existing physical restorer and SDK snapshot bootstrap. New prompt text can differ; source snapshot/context/scopes/versions and new target identity stay pinned. No lifecycle resume envelope or same-prompt validator was weakened. Current next-turn restore requires the same window/skill context as its source checkpoint; broader context transitions need a separately reviewed design.
- Issuance: `prepared-run-issuance.mjs` validates trusted provider receipts and canonical per-run preparation/allocation/grant facts. `prepared-run-registry.mjs` composes lazy target-specific controllers and strict HTTP routing. Retired source capabilities/grant IDs and attempt/worker identities cannot be reused. UNKNOWN never authorizes another issuance/allocation dispatch. Real issuer generation/binding is absent and fails closed; no conversation-shared task token fallback exists.
- Optional prepared-candidate composition requires all three trusted inputs: `runIssuance`, `issuanceIntent`, `admissionForBinding`. CLI startup does not construct these ports or generate credentials. Existing first-run configuration remains the default.

## Checks actually run

Follow-up source pin `9f2c04b9f566760677befbd4d2de3b1752d15bda`, tree `2305035807ace1f9e29fcfdbcd46bb1474ec3c2a`, corrects terminal refusal ordering and the one committed-LF proof mismatch found during qualification preparation. Exact committed blobs now match all45 candidate rows. Focused completion/current-run/proof checks pass25/25; the control suite excluding the unavailable real-PG file passes132/132. See `RESULTS-followup.json`, `RESULTS-control-followup.json`, and `PUBLICATION-AND-ENVIRONMENT-REVIEW.md`. Historical receipts below are retained at their original evidence level; the earlier Windows proof check alone did not establish committed-byte proof.

`RESULTS-final.json` records exact commands, Node `24.19.0`, Windows platform, exit status and summaries. Do not sum overlapping author/reviewer checks as independent coverage.

| Check | Result | Evidence level |
| --- | --- | --- |
| Source proof | 5/5 | Static byte audit: 10 declared changes, 35 unchanged rows; historical/Fable manifests and Dockerfile unchanged |
| Full worker conversation, skills and continuation suite | 138/138 | Scripted SDK/query/authority ports |
| Focused runtime/capture/restore/issuance/registry/bootstrap | 137/137 | Source/local bytes; installed SDK SessionStore validation; injected journals/authority/native process/issuer ports |
| Context adapters and identity | 75/75 | Synthetic native authority; bounded local HTTP test required approved sandbox escalation |
| Control local aggregate in initial integration receipt | 131/137 | Six tests attempt unavailable PostgreSQL Unix socket and fail ENOENT; all other controls pass |
| Independent owned control gate | 103/103 | Separate author evidence; includes fail-closed resume characterization, not successful composed resume |
| Existing hold/task capture compatibility | 25/27 | Two POSIX executable-bit assertions fail on Windows; unchanged assertions retained |
| Existing selected MCP test | 0/1 module | Windows absolute-path dynamic import fails with ERR_UNSUPPORTED_ESM_URL_SCHEME before tests run |
| Existing candidate/bootstrap/control lifetime group | 9/16 | Seven tests fail POSIX path normalization in preparation fixtures on Windows before behavior |
| Conversation typecheck | PASS | Existing tsconfig includes workflow and checked worker options |
| Runtime typecheck | PASS | Existing tsconfig includes only test/types.ts; does not establish full JS typechecking |
| Additional selected next-turn/wiring controls | PASS | See supplemental receipt; no source/model calls |

The initial integration receipt is retained, including six unavailable-PG failures. Broader candidate attempts and platform failures remain visible. Source-proof initially caught the newly changed task-bootstrap proof row missing from `changedRows`; it was explicitly enumerated and independently byte-reviewed, then passed. Earlier local development attempts diagnosed missing locked dependencies, test fixture wrapping, and Windows uid assumptions; no failed assertions were removed to obtain a green result.

Docker CLI is installed but its Linux engine is unavailable. The latest WSL inventory returns `Wsl/E_ACCESSDENIED`, so no current inventory claim can be made. No psql executable is discoverable on PATH and no compatible disposable Unix-socket test database is available. The real-PG fixture is source-updated to use canonical completion and budget admit/revoke owners, lost-COMMIT injection, three turns and SQL immutability checks, but remains UNRUN. No protected fixture was restarted. No composed real-CLI/Linux rehearsal or migration execution is claimed. `LINUX-PG-QUALIFICATION-PLAN.md` is prepared for a future supplied offline isolated sandbox.

## Independent review and remaining HOLD

Independent Codex review found and verified fixes for genuine task capture's extra `sessionId`, object method boundary validation, all-target-grant source capability reuse, reused attempt/worker IDs and ambiguous SDK lineage hints. Reviewed final wiring and proof enumeration were ACCEPT_SOURCE only. Runtime/issuer source controls do not prove an actual provider's durability, task retirement, PostgreSQL triggers, POSIX isolation or release readiness.

One concrete integration HOLD remains: lifecycle resume commits its successor, then existing postcommit `fresh()` revalidates the now-stale source session and refuses before dispatch. The retained regression proves one target, zero starts/continued signals and UNKNOWN. No stale session authority was restored. The exact proposed bounded transition-authority method and public cursor proposal are in `docs/coordination/reports/DOT-NEXT-TURN-CONTRACT-PROPOSALS-20261014.md`; root must review and allocate the shared session-owner change before that path is implemented.

The expanded exact interface, ownership request and real source excerpts are in `docs/coordination/reports/DOT-TRANSITION-AUTHORITY-REVIEW-20261014.md`. Owner approval now covers publishing a sanitized review branch. Its single-commit history starts at verified existing public Fable700; raw Dot logs/intermediate commits remain local only. See the publication/environment review for the complete audit/disposition and remote readback requirement. Publication does not clear the remaining technical HOLDs.

Migration 0009 remains centrally unallocated source. It records an explicit exclusive-lock reconstruction policy for existing retained rows and seals historical ranges; duplicate writer fences abort rather than guess. Central allocation and separate execution approval are required. Public conversation-wide cursor/listing is proposed, not frozen or implemented. Real issuer binding, Linux/PG controls, composed CLI qualification, image scan/admission and every live milestone remain held with their existing owners.
