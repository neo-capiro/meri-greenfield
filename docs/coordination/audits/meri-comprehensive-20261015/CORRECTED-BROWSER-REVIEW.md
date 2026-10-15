# Independent re-review: browser default-on correction

Review date: 15 October 2026. Scope: read-only source, tests, reports and synthetic cloud probes. No repository edit, commit, deploy, browser launch, provider call, credential use or user-computer operation was performed.

## Decision

**Overall source: HOLD at `31ed4a732e81000c1962765ff1d16cdcdf16ecaf`. Activation/live qualification: HOLD independently.**

The requested product default is preserved: **browser capability ON, destinations denied by default, consequential interactions decided before execution**. No recommendation here changes the capability default to OFF.

The new commit materially corrects the original permission-list bug, synchronous download claims, misleading profile description and unsafe activation posture. However, its structural-validation correction still accepts malformed files, the proposed egress acceptance criteria do not guarantee the advertised effective origin allowlist, and two narrower input/liveness defects remain. These are not claims of current deployed exposure: the public entry point remains inert while activation is held.

Exact identity:

- Branch `fable/p2c-browser-default-on-20261015` resolved through GitHub to [`31ed4a732e81000c1962765ff1d16cdcdf16ecaf`](https://github.com/neo-capiro/meri-greenfield/commit/31ed4a732e81000c1962765ff1d16cdcdf16ecaf).
- Prior HOLD source: [`e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4`](https://github.com/neo-capiro/meri-greenfield/commit/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4).
- GitHub compare reports three commits ahead, zero behind, 23 changed files. The branch head was checked independently, rather than inferred from the report.
- The prior review and subsequent explicit default-on direction were read at commit `7606375d`. Its relative link is absent from the new branch tree (404); the historical commit remains readable. This is a documentation-link issue, not a reversal of that direction.

## Findings requiring correction

### H1 — High: malformed OOXML and PDF still pass structural validation and the grader

The validator recognizes XML with regular expressions. `rootOf` only recognizes an opening tag; it does not establish well-formed XML. Relationship and override searches also match markup inside comments, and the relationship document root/namespace is never validated. See [file-structure.mjs, lines 44–62](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/artifacts/structure/file-structure.mjs#L44-L62).

Independent probes against the exact source all returned `structurallyValid: true` and grader `pass: true`:

1. A DOCX main part consisting only of an unterminated `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`.
2. A DOCX whose only officeDocument relationship is inside an XML comment.
3. A DOCX whose only matching content-type override is inside an XML comment.
4. A DOCX with the relationship under `NotRelationships`, without the required relationship namespace.

Python's independent XML parser rejected the unterminated main part with `ParseError: no element found`. This is a structural failure before native Office rendering is relevant.

The PDF validator merely checks that `startxref` points to the token `xref` or an object prefix. It does not establish a cross-reference table/stream, trailer or catalog. See [lines 64–68](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/artifacts/structure/file-structure.mjs#L64-L68). This 32-byte value passes:

```text
%PDF-1.7
xref
startxref
9
%%EOF
```

A 47-byte file pointing `startxref` at an ordinary `1 0 obj <<>> endobj` also passes. Available `pdfinfo` independently rejected the 32-byte file: `Couldn't find trailer dictionary` and `Couldn't read xref table`.

These are shared admission defects: [downloads.mjs, lines 44–52](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/downloads.mjs#L44-L52) trusts this validator before ingest, and [usable-file.mjs, lines 9–12 and 22–29](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/evals/promptfoo/graders/usable-file.mjs#L9-L29) gives the same corrupt examples a positive structural result. I directly exercised the validator and grader; the download integration implication follows from that call site, not from an independently run ingest test.

Required: use reviewed structural parsers rather than XML/token signatures; require well-formed, correctly namespaced OPC relationships/content types/main XML and coherent PDF cross-reference/trailer structure. Add the above negative cases. Keep native Office/PDF usability explicitly UNRUN until actually exercised. The old eight-byte `PK\x03\x04rest` regression is fixed, but it is insufficient coverage.

### H2 — Medium: ZIP checks do not establish the local-header agreement they claim

The implementation reads encryption flags, CRC and sizes from the central directory, but only checks local signature, name, method and data boundary. It never compares local flags, CRC or sizes, and it ignores local data-descriptor semantics. See [file-structure.mjs, lines 24–34](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/artifacts/structure/file-structure.mjs#L24-L34), against the [explicit agreement claim, lines 1–5](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/artifacts/structure/file-structure.mjs#L1-L5).

Independent probes all pass the validator and grader:

- Local encryption flag set while the central flag remains clear.
- Local CRC set to zero while the central CRC and bytes remain intact.
- Local compressed/uncompressed sizes set to zero with the data-descriptor flag unset.
- A ZIP member named `C:/escape.txt`, despite the stated no-absolute-path claim. This is a portability/claim defect; no archive extraction exploit was exercised.

Required: validate matching headers and supported data descriptors, entry boundaries/overlaps and portable safe entry names through a reviewed ZIP implementation or equivalent comprehensive checks. Correct the documentation only if the intended accepted structure is genuinely narrower in scope; do not describe the present checks as full agreement.

### H3 — High activation-contract gap: the eight requirements do not enforce the effective destination allowlist across redirects

The code and report explicitly acknowledge that Playwright origin flags do not affect redirects: [server.mjs, lines 19–24](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/server.mjs#L19-L24). The in-process gate checks the supplied navigation/new-tab URL only: [permissions.mjs, lines 19–29](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/permissions.mjs#L19-L29).

The activation record mandates private/non-public destination blocking and resolved-address/redirect checks, but does not mandate rejecting an unlisted **public** origin: [activation.mjs, lines 9–18](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/activation.mjs#L9-L18). The report explicitly calls effective allowlist enforcement at egress “Recommended, not required”: [report, line 140](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/docs/coordination/reports/FABLE-P2C-BROWSER-DEFAULT-ON-20261015.md#L140).

Consequently, an allowed public origin redirecting to an unlisted public origin is not forbidden by the stated opening criteria. This also undercuts tenant/role narrowing. This is a source/contract deduction from the declared control coverage, not a measured browser bypass; no live browser was run.

Required before approving activation criteria: enforce the **effective** platform/tenant/role origin policy for every relevant destination and redirect hop, in addition to private-address protection. Include public-allowlisted → public-unlisted redirect, subresource/WebSocket and policy-narrowing negative tests. Do not open the gate solely on the existing eight measurements. Default-on capability remains appropriate and separate.

### H4 — Medium: tenant settings silently coerce invalid booleans instead of refusing the record

`override()` calls `normalize()` before full validation. `normalize` converts any value other than literal `true` to `false`: [resolution.mjs, lines 35–39](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/resolution.mjs#L35-L39) and [lines 69–74](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/resolution.mjs#L69-L74).

Independent results:

- `{browser:{enabled:'yes'}}` is accepted and resolves to `{enabled:false}`.
- `{browser:{downloads:{enabled:'yes'}}}` is accepted and silently disables downloads.

This does not widen authority, but it contradicts strict validated settings and gives admin writes misleading success. Validate the raw partial field types first; normalize only already-valid booleans/list intersections. Include write-time and run-time negative tests.

### H5 — Medium liveness/contract gap: pending approval has no enforced timeout or abort completion

The comment promises timeout denial, but the implementation directly awaits `approvals.decide` and only checks abort once it resolves: [permissions.mjs, lines 8–10](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/permissions.mjs#L8-L10), [lines 54–61](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/permissions.mjs#L54-L61).

A port returning a pending promise leaves this callback pending after its AbortSignal is aborted. When the same synthetic port finally returns approve, the callback correctly denies. Thus late approval is fail-closed, but bounded completion currently depends on an unspecified port guarantee. No claim is made that the entire SDK necessarily hangs; outer SDK cancellation was not tested.

Required: specify and enforce approval expiry/deadline and cancellation behavior at the owning boundary, including a non-responsive port test and a live SDK cancellation round trip. Do not claim timeout refusal from this fragment alone.

## Scoped source acceptance of corrected elements

The following findings are **ACCEPT for the inspected source behavior only**, not integration or live activation:

1. **Default-on product policy with empty destinations.** [policy.mjs, lines 28–33](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/policy.mjs#L28-L33) preserves ON and an empty origin list. Exact origin checks and immutable platform URL limits reject tested literal/private/scheme/credential cases. Tenant/role intersection and ordinary widening rejection worked in independent pure-function probes, subject to H3/H4.
2. **Original SDK `allowedTools` defect corrected.** Interaction tools are excluded, a pre-tool `ask` is returned, and the injected approval port must affirm the exact tool-use ID. See [permissions.mjs, lines 34–63](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/permissions.mjs#L34-L63) and [fragment.mjs, lines 23–33](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/fragment.mjs#L23-L33). Independent checks covered all seven interactions, missing/denied/mismatched approvals, pre-abort and valid approval. This proves fragment decisions, not actual SDK permission ordering; the authored test itself uses a [scripted SDK model, lines 7–23](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/test/permissions.test.mjs#L7-L23).
3. **Original asynchronous count race corrected in source.** Filename and slot are reserved before the first await, and retained after any attempted ingest, including unknown acknowledgment: [downloads.mjs, lines 29–60](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/downloads.mjs#L29-L60). The committed [concurrency/unknown-outcome regression, lines 39–55](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/test/downloads.test.mjs#L39-L55) is meaningful. I inspected it; independent full execution was dependency-blocked below. This acceptance is limited to the same-port, same-filename claim scope; it does not establish durable retry deduplication across processes.
4. **Held public entry point.** [index.mjs, lines 18–25](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/index.mjs#L18-L25) consults the shipped held constant, contributes no server/tools/hooks and refuses downloads; policy cannot open it. The direct open-fragment export is explicitly internal/test scaffolding, not a runtime configuration authority.
5. **Profile statement corrected and disposal supplied.** [README, lines 41–43](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/README.md#L41-L43) now acknowledges cookies/session storage until disposal. [workspace.mjs, lines 12–24](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/browser/workspace.mjs#L12-L24) removes and verifies state. Independent synthetic checks passed deletion, idempotence and symlink refusal. Process shutdown ordering, ongoing cancellation and actual host destruction remain live qualification work.

## Contract proposals: review disposition

The proposals are [report lines 142–157](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/docs/coordination/reports/FABLE-P2C-BROWSER-DEFAULT-ON-20261015.md#L142-L157). They are proposals; no canonical contract freeze or production composition has occurred.

- **Platform `{maximum,defaults,roleCeilings}` and tenant `{browser?,roles?}`: ACCEPT direction, HOLD wire/storage freeze.** Preserve trusted Core ownership, tenant-admin authorization, server-side roles, strict partial types (H4), revisioned approved origins, auditing and stale-policy/revocation semantics. The same effective record must govern browser requests and the mandatory egress allowlist (H3). Define canonical role vocabulary and configuration owner before adopting the local shape.
- **Execution-record `browser` beside the closed Run: HOLD pending the canonical owner’s reviewed schema/admission change.** Bind policy revision/digest to the task/attempt, restore/replay and revocation checks. Avoid transporting a client-provided effective policy as authority. Keeping runtime installation paths/scopes outside user policy is sound.
- **`approvals.decide` port: ACCEPT as an injected boundary, HOLD as a complete approval contract.** A `{decision,toolUseId}` response is not by itself durable authorization. The owner must authenticate the approver, bind tenant/actor/conversation/run/attempt/fence, server/tool, canonical input digest and relevant page origin/context, and define expiry, revocation, one-time/idempotent consumption, resume/retry and uncertain execution. Reuse the canonical approval mechanism rather than creating a second authorizer. A synthetic repeat with the same tool-use ID and different input is allowed by the fragment when the port approves both; preventing stale/replayed authority is therefore the port owner’s obligation, currently unspecified. This is not evidence of a live bypass.
- **UI status: ACCEPT direction.** Distinguish capability enabled, no allowed destinations, activation held, and tenant-disabled. Do not render `cap.enabled:false` in the held fragment as “user turned browser off.” Approval UI additionally needs exact action/target/data, expiry, cancellation and stale-state treatment.
- **Options composition: HOLD integration.** The current [options.mjs, lines 23–28](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/options.mjs#L23-L28) admits only `meri_original_reads`. Composition must preserve both hooks, all disallowed tools and server ownership, prevent a more permissive decider from short-circuiting browser decisions, keep default permission mode, and requalify actual SDK ordering. A generic “first allow wins” chain is insufficient.
- **Installation, ingest, cleanup: HOLD integration.** Playwright is not in the [conversation package dependencies](https://github.com/neo-capiro/meri-greenfield/blob/31ed4a732e81000c1962765ff1d16cdcdf16ecaf/apps/worker/conversation/package.json#L1); artifact ingest is an unimplemented owner port; cleanup must be wired after process exit on all lifecycle outcomes. Pin package/image, input/output bounds and artifact provenance/idempotency under their owners.
- **Decision-log wording: ACCEPT desired product direction, revise qualification claim.** Record source HOLD and activation HOLD separately, and require effective allowlist enforcement. Do not state that all prior defects have been accepted.

## Verification and limits

Independent work used Node **v24.19.0**, not the author’s v24.21.0. GitHub retrieved 32 source files into an isolated cloud review directory; their Git blob SHA-1 values were checked against the returned metadata after materialization. No repository source was changed.

- Committed structure suite: **4/4 passed**, rerun after exact blob verification.
- Additional policy/permission/disposal probes: **59 assertions passed**, rerun after exact blob verification.
- Independent malformed artifact probes: **10 newly malformed cases accepted** (four OOXML, four ZIP/path, two PDF); all ten also graded `pass:true`. Eight-byte original DOCX case correctly rejected. These are expected-negative failures in the implementation, not a green test result.
- Independent XML parser and `pdfinfo` reject the corresponding corrupt examples. A real Office open/render was not run, and `pdfinfo` rejection is not blanket PDF usability qualification.
- Attempted authored browser+structure command: structure tests passed, **four browser test files failed to load because `ajv` is absent**. No mocked validator or edited dependency was substituted. The reported **28/28** was therefore read as author evidence, not independently reproduced. Root/contracts checks and reported baseline failures were not rerun.
- GitHub combined-status query returned no statuses; the commit workflow-runs query returned no PR-triggered runs. This does not establish all CI systems or all possible workflows are absent; it supplies no independent passing CI evidence.
- Actual Playwright MCP/Chromium, SDK round trip, artifact ingest service, DNS/redirect/rebinding, approved isolated host, sandbox, AWS, deployment and native Office usability remain **UNRUN**.

Review evidence retained in `/workspace/shared/browser-review-31ed4a73/`: `source-manifest.json`, `probe-negative.mjs`, `probe-results.json`, `probe-negative.log`, `probe-policy-permissions.mjs`, `probe-policy-results.json`, `probe-policy-permissions.log`, `structure-tests.log`, and `rerun-28.log`.

## Next acceptance boundary

Fable can return a new exact source pin addressing H1/H2/H4 and explicit H3/H5 contracts, with new negative regressions. Independently re-review that pin and the canonical owners’ integration changes. Keep the desired capability default ON. Keep activation held until both effective destination policy and private-address/DNS/redirect protections, actual SDK pre-execution approval, profile lifecycle, sandbox and per-conversation host cleanup are measured on the approved host. No source-only ACCEPT advances a live or deployment gate.
