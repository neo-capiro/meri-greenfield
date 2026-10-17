# Funding observation source review - 17 October 2026

Base: `615a5467ffa555f913ad49258b3919723ecf207d`, branch `codex/meri-funding-asof-20261017`, task-owned `meri-resolution-next`. This reviewer owns only this report. The parent owns source integration and publication; other allocated authors own the private wire and funding adapter. No production edits, recursive delegation, dependency installation or live calls are allocated to this reviewer.

Disposition: **ACCEPT_SOURCE for the frozen bounded Meri-side funding source slice, with no blocking source findings. The actual Core bridge, complete five-read implementation, installation qualification and SDK funding exposure remain HOLD.**

## Design and canonical owners

Reviewed `AGENTS.md`, `docs/IMPLEMENTATION-STANDARDS.md`, [observation proposal section A](CODEX-READ-OBSERVATION-SEAMS-20261017.md#a-first-slice-fundings-existing-parameter-bridge-five-reads), the unchanged funding normalizers/receivers and the existing native CONTROL, source-handler and HTTP transport seams. The private protocol must admit only these five `0.2.0` operation references:

- `search_funding_opportunities`
- `get_funding_opportunity_requirements`
- `get_funding_opportunity`
- `get_opportunity_client_context`
- `get_opportunity_government_landscape`

The closed carrier is separate from public tool arguments and binds the canonical hash of the **original flat request**, not normalized/defaulted input. Its decoded canonical UTF-8 JSON is at most 2,048 bytes; base64url must be unpadded and canonical. Reject malformed UTF-8, duplicate/noncanonical JSON encodings, unknown fields, wrong versions/operations and context fields other than one canonical `asOf`. Re-encoding must reproduce the accepted carrier exactly. No source, tenant, actor, role, visible-client list, credential or caller clock is introduced into model arguments.

The existing CONTROL native credential owner captures the trusted instant once per delivery and retains it through rechecks, together with the original request hash and current tenant/user/client/task/run/allocation evidence. The canonical client UUID, task subject/resource and actual native visible membership must be coherent before source credentials. Rotating authorization-decision IDs do not permit semantic context/resource drift or extension of the first expiry. Carrier construction and source HTTP follow successful current credential proof. A fake context callback or static credential must not replace the production owner.

The source family preserves exact raw bodies and all existing funding gates, source meanings, refusal states, pagination, summaries, requirement provenance, deadline arithmetic and landscape projections. Complete frozen receiving applies to available and refusal envelopes; no timestamp/result rewriting or post-read scope filtering is accepted. Funding's envelope anchor does not pin independent SQL lifecycle, health or search generation clocks. Context remains exactly `{asOf}` and no mode observation is required by this bounded funding contract.

## Core and unsupported-server qualification boundary

The pinned existing Core dispatch does not forward the optional funding anchor. Section A proposes a verified-service transport-to-parameter bridge; this report does not claim that route/header consumption is implemented or deployed. Existing native JWT/current actor/tenant and real internal-service verification remain required. A development guard returning true in observe mode is insufficient proof that a service secret matched.

An old server can ignore an unknown header. Matching `output.asOf` alone cannot prove that the producer consumed the carrier: native clocks may happen to agree. Therefore source fixtures may establish Meri mechanics only. Installation/source qualification must independently bind the reviewed Core bridge and actual server artifact, or use a separately allocated explicit validated-consumption acknowledgement. No such acknowledgement is invented by this review. Missing or unsupported bridge behavior must never cause a legacy retry, a locally substituted timestamp, SDK promotion or a live-qualified claim.

## Focused acceptance plan and evidence

Review frozen files for canonical DTO/hash/size/encoding admission, exact raw/body/context correlation, trusted once-only capture, current authority before credentials/carrier emission, whole-result validation and resource cleanup. Run only meaningful new focused checks; the parent coordinates broader integration. Required negatives include operation/body/context substitution, malformed/oversized carriers, hostile inert inputs, authority/grant/expiry drift, unsupported server behavior, cancellation and refusal envelopes. SDK funding stays withheld and ledger metadata must distinguish implemented source from qualified/live availability.

Initial disk check: about 2.49 GiB free. Existing Node/dependency overlay is borrowed; no install, archive or additional worktree was created.

## Frozen production acceptance

Reviewed all 13 changed/new production or inventory files listed below against the base. The funding source uses the existing shared mechanics, enforces an explicit coherent client UUID, requires call-bound current credentials and sends only five fixed POSTs with the original body. The shared observation branch forbids request/result bridges and delegated transport. It creates the closed observation only after credential proof validation. The existing CONTROL owner reuses its privately pinned trusted `asOf`, current membership/task/run/allocation and original expiry; no new credential issuer or fake producer port is added. Complete frozen output validation is unchanged, including refusal clocks and requirement-page generation. SDK eligibility is unchanged.

Independent focused checks passed with Node 24.19.0, `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000`:

| Selected new file(s) | Result |
| --- | --- |
| `packages/contracts/native-read-observation-0.2/test/validate.test.mjs` | 53/53 |
| `apps/gateway/sources/funding-opportunities/test/handler.test.mjs` | 28/28 |
| `apps/runtime/native-authority/test/funding-asof-context.test.mjs` and `apps/runtime/test/funding-source-integration.test.mjs` | 32/32 |

All three commands exited zero with no failures, skips or cancellations; no old broad selection was repeated. The mounted checks use real Meri CONTROL/task/native-current/receiving/budget owners over scripted SQL and synthetic identity/source HTTP. The explicit offline source stand-in decodes the carrier before constructing the stored response; it is not a Core implementation or proof of installed consumption. The actual runtime refuses all five funding operations even with overclaimed approved/install/discovery inventories. Pre-source mismatch cannot release source credentials; post-source membership/time/result uncertainty withholds whole output and leaves its reservation uncharged in `UNKNOWN`. Static credentials, delegated observation transport and legacy retry remain unavailable.

The authors retained their initial fixture failures and corrections in [adapter evidence](../../../apps/gateway/sources/funding-opportunities/test/EVIDENCE.md) and [owner/source invocation evidence](funding-asof-20261017/owner-source-final.json). The reviewer found no weakened behavior or receiving assertion in those corrections. The final pure-helper revision added canonical UUID selection validation; its final bytes were reviewed and the adapter/owner selections ran afterward.

The coordinator's final source audit found that the integration module statically imports funding for every family composition. Conditional wire/helper measurement was therefore incomplete. The corrected manifest includes all five new production files in its common measured set and deduplicates labels; it changes no runtime execution behavior. Independent readback and a narrow no-source-I/O probe passed for native bill-text, retained Florida budget and funding compositions: all eight returned operation manifests include the five exact current hashes once and have a correct aggregate fingerprint. No old test suite was rerun for this correction.

Accounting source changes are wording-only: the existing partial state and SDK prohibition remain intact. The five funding rows are explicitly `PARTIAL_BRIDGE`; source presence is never counted as complete bridge implementation. Independent JSON inspection confirms **82 = 56 complete + 15 partial + 11 absent**, still **26 incomplete reads across 15 families**, **SDK 58 operations / 35 families**, **42 passive constructors**, **live 0**. The eight historical fields are exactly serialized-equal to PR107, PR106 and `08f65a79`, including unchanged excluded references; the excluded-capability count stays 43. The ledger author's 25/25 focused result is separate evidence and was not redundantly rerun by this reviewer. After the manifest correction, the final provenance refresh has JSON SHA-256 `0e9521b70f96c6da3f366711fc63cff8bffcbbc3afc50115f14e704e12971a74`; all 13 frozen production/inventory hashes were rechecked and still match the table.

`git diff --check` passed. Acceptance covers the frozen production hashes and the stated source-only boundary. No installation, live authorization, backend bridge or complete funding family is accepted by this disposition.

### Final staged acceptance

**ACCEPT_SOURCE for the 44-file staged snapshot, with no blocking findings.** All 13 staged production/inventory hashes match the table, the final ledger matches its recorded provenance hash, cached whitespace checking passes, and all local links in the ten staged Markdown files resolve. Four evidence files have only the normal Git CRLF-to-LF distinction between working and staged bytes; no production drift is present.

The coordinator's [integrated command](funding-asof-20261017/integrated-final.json) and [full result](funding-asof-20261017/integrated-final.txt) agree: exit zero, **1,006/1,006** passes across 16 relevant files, with zero failures, skips or cancellations. This reviewer inspected the retained result without rerunning the suite. The staged initial logs still contain their assertion diagnostics and failed outcomes: funding 25/26 and owner/source 27/32. [Normalization metadata](funding-asof-20261017/log-whitespace-normalization.json) retains original and whitespace-trimmed working hashes, identifies the twelve whitespace-only diagnostic lines, and now separately records each actual staged/published LF hash. Those working and published hashes were independently checked against their respective bytes. No initial failure is presented as a pass.

Main implementation, authority, Core-pending, preservation and ledger reports accurately separate the accepted Meri source increment from the unimplemented Core bridge, SDK withholding and live-zero qualification. Historical fields/exclusions and the retained research-portfolio, changes and Florida budget scope remain intact. The sole final review-report addition is documentation only; the coordinator must restage it before capturing the immutable publication tree.

| Frozen production / inventory path | SHA-256 |
| --- | --- |
| `apps/gateway/general-reads/families/funding-opportunities.mjs` | `056a354b15e9e96fdc25a8a6aed3c37c911f8435259b485c525a157e746a1530` |
| `apps/gateway/general-reads/integration.mjs` | `753e55fe0ec3605558011477e990085b701f1e2cd545ccaea31b3137c1673d7e` |
| `apps/gateway/sources/funding-opportunities/handler.mjs` | `de7e192577b676423a085249e6af23df76882444d4029f0d2d3e8896de473836` |
| `apps/gateway/sources/funding-opportunities/request-context.mjs` | `fff73469a064a7b2db64b92e46b1734cd77f207f6f0c2bc96981000d13bbaddb` |
| `apps/gateway/sources/retained-reads/http-transport.mjs` | `4e667c2635fbf353dbb04c3c170e8fa0ab6ee6b42bcdec32cb16da25660fe162` |
| `apps/gateway/sources/retained-reads/native-families.mjs` | `c8aaab1d26fb94e4e07a8531b46c9261c5f04400ca8a4a25709b33ba0def2803` |
| `apps/gateway/sources/retained-reads/native-handler.mjs` | `3708d84023ced6e220ec3706e8d7589a353c737b9b2a2f6b11d3b1ac5db9f681` |
| `apps/runtime/native-authority/native-read-credentials/source-read-context.mjs` | `409f1eac79275dae57379f912d1672139e2cfcb5cd285abb5479e65fe9fb4f4b` |
| `packages/contracts/native-read-observation-0.2/schema.json` | `5bbe3c113adf2cd1b338ee432c2fb73ec368b0a336d0632fbcf4a929cb81d0de` |
| `packages/contracts/native-read-observation-0.2/validate.mjs` | `f02d651c9d157428040473eba39dd899498a6acb811483522940f6115a7281fe` |
| `scripts/general-reads/adapters.json` | `f919958a7605195042684ea5e449ff743b12c1e332935f5d0168177ab13397f2` |
| `scripts/scope-ledger/markdown.mjs` | `e85decdce3763ef55090f6da373f888fa940284409d0d65faafd15f121aa037e` |
| `scripts/scope-ledger/source-exposure.mjs` | `1aaab66c3b86343a2a51581e6f2339ee4a7cceae8cebf19eda13cf3a3500bda5` |
