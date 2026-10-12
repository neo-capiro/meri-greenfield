# REL-02 meeting and operational contracts — canonical composition

**ACCEPT for source integration only. REL-02 and G1 runtime remain OPEN.**
Reviewed implementation commit:
`3e783935c66a57a491d3882402dfa26980409054`;
tree `5ebe4f9ace8ff7a8b094c5837ca9c5553d8b8731`;
base `8d045221aa314871edf214deb2c9f1800fde6b17`.
Branch: `task/codex-g1-rel02-validators-20261011`.

## Change and canonical ownership

Previously accepted inert meeting and operational-read factory validators
existed alongside their schemas, but their tests instantiated duplicate
Ajv, subject, window and source-inventory collaborators. The production
private validator did not compose those factories. They now use the same
canonical collaborators as mail through
`packages/contracts/retrieval-0.2/validate.mjs`.

The only production change is registering the existing two schema groups
and exporting the existing factories' named assertions/pending-mode
constant. Seven meeting assertions, four operational-read assertions and
one pending-mode constant become available through the private validator.
No new schema, operation registry, live handler or authorization system
was introduced.

The two test suites import this composition while retaining their shared
collaborator negative cases. All 28 original test bodies are byte-identical.
Six added cases cover canonical entity/roster consistency, timezone and
calendar boundaries, including a DST week, and pending timestamp refusal.
One malformed synthetic portfolio subject now supplies the versioned
authorized roster required by the pre-existing canonical contract.

## Preserved contracts and availability

The four meeting/operational schema and factory files remain byte-identical
to the base. Public 0.1.0 schema, exports, generated files and catalog are
unchanged. Catalog counts remain 139 originals, 96 selected and 43 deferred,
with the same three mail mappings. All five affected operations remain
unregistered/unavailable with pending status, null handlers and disabled
sources. `evidenceReady:false` and unscoped action-item pending mode remain.
This composition does not create negative absence assertions or qualify
cursor/authentication/source timestamp claims.

The private validator exports no combined schema fingerprint. Its existing
mail schema hash still uses the same unchanged mail bytes. The historical
operational schema description saying it is not wired into validate.mjs
is superseded by this source composition; the inert schema bytes are
intentionally preserved. That phrase never described a callable backend
endpoint.

## Verification

Node 24.19.0, locked root and contracts dependencies, lifecycle scripts
disabled. Parent replay against the clean exact source commit:

| Check | Result |
| --- | --- |
| Meeting/operational suites | 34/34 passed |
| Root checks | 172/172 passed |
| Public generated-byte check and TypeScript | PASS |
| Public package tests | 7/7 passed |
| Original test-body preservation | All 28 byte-identical |
| Four immutable schema/factory files, catalog/public metadata | Byte-identical |
| Diff checks and source identity | PASS |

Distinct reviewer `native_candidate_review` independently inspected the
three-file change, immutable dependencies, definition uniqueness across
seven groups, test-body preservation and public/mail identity, and replayed
the focused, root and public distribution checks. The reviewer accepted
the exact source commit; no local suite establishes live retrieval or G1.

[Machine-readable checks](../../qualification/candidates/rel02-canonical-20261011/source-checks.json)
and six raw stdout/stderr captures are tracked beside it. Suites overlap.
The writer's first root replay passed 171/172; the sole failure was missing
package-local esbuild before dependency restoration. The final replay
passed without changing assertions. An initial read-only preservation
diagnostic used an incorrect factory filename; the corrected diagnostic
verified all preserved files and bodies.

No cloud, customer SQL, provider request, source connection, endpoint
enablement or frontend change occurred. Source permission-aware eligibility,
catalog mapping, live adapters and measured evaluation remain separate
qualification work. GitHub source publishing remains blocked by the
integration's write permissions; the importable handoff carries local
commits rather than claiming a published branch or PR.
