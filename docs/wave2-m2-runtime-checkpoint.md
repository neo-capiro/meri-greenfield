# M2 runtime source checkpoint

Pinned base: `0e5e6f8765abcdebcc88db32fee79d349ddf523c`. This candidate is source work, not activation or acceptance.

Implemented at this checkpoint:

- Nullable conversation binding, exact private actor General scope, current Core authority preflight, and immutable client selection. Legacy null-client Core records require the explicit bootstrap receipt in the companion Core change.
- Public `conversation-session` receiver generated from the canonical session schema. Existing action/document consumers remain client-only. Initial session run ID may be omitted in the caller's expected context; a supplied ID is matched exactly.
- Canonical browser catalog for all 14 skills and 15 exact versions. Only the already supported two are marked runtime-supported; every asset remains unavailable until the installation gate qualifies it.
- Existing native and signed read owners accept General origin with current client walls, preserve true client result provenance, and pin a signed v2 target per call. General memory is restricted to personal/firm passive reads. Generic subset checks and token ceilings are unchanged.
- Management port holds the canonical retention transition before the conversation lock; Core owns metadata/CAS/idempotency. Trash suppression survives an unknown Core commit; Restore releases only through Core's committed revision check. New work admission reads canonical Core status under the same conversation lock. Missing management ports refuse composition.

Validation: public TypeScript compile and 32 focused public receiver/catalog tests pass. A 212-test bounded source regression selection passes. Transition lifetime/contending history, stale client walls, legacy General refusal, target switching, metadata outage, archive/admission races, and unknown Trash commit controls are included. These are source tests, not native PostgreSQL or deployed proofs.

Remaining before acceptance:

- Complete automatic canonical client-context loading before the first model call and its final authority/revision checks.
- Complete full signed retained-read release-chain controls with the companion Core v2 source, including personal/firm memory's mandatory eligibility helper and revocation immediately before final release.
- Complete management runtime composition with the canonical Core metadata reader and existing retention owner, native PostgreSQL contention checks, and all admission-path controls. No parallel title store or purge job is authorized or introduced.
- Complete General completion/next-turn/checkpoint adversarial controls, additional mutation controls, and full remaining-scope audit.
- The frozen `sdk-option-template.mjs` still requires a client scope. General activation requires its separately authorized post-P1/C9 digest/proof change; this candidate does not bypass it. Any extra General authority observations exceeding the existing signed token ceilings remain a closed activation dependency.
- Incoming S2 main change `4f8725b826a48c046a49e8d8d11babe188515894` must be checked after integration; this work retains its pinned base and does not rebase or merge it.

The inherited native authority constructor mismatch is isolated in the preceding commit: the full Core interface included `readCurrent`, while strict private readers accepted only identity/context. The composition now projects those exact reader interfaces and leaves their validators strict. An exact-base local constructor probe failed `INVALID_COMMAND`; the candidate succeeds without making HTTP calls.

Unrelated task-command/user-preferences generated drift was restored to the pinned base. Targeted generators own only the changed conversation and catalog outputs. No AWS writes, database execution, deployment, live chats, P1 hot-path budget/proof edits, or proxy MP implementation were performed.
