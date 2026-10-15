# Package 2 browser re-review

15 October 2026. Read-only independent review and isolated cloud tests. No implementation changes, browser/SDK launch, model call, user-computer operation, infrastructure activation or deployment.

## Decision

**ACCEPT the narrow H1–H5 repairs and dependency addition as source corrections. HOLD blanket structural-validator source acceptance on one remaining PDF reference-coherence defect. Activation, canonical contracts and live qualification remain HOLD independently.**

The desired browser capability stays **ON by default**. Empty destinations, tenant/role narrowing, pre-execution interaction decisions and held live activation remain separate controls. Pending owner deferral decisions are not treated as approved by this review.

### Exact candidate and integration

- Reviewed integrated pin: [`69040f9b4ab2d239bec1a057354d578d2bf24b1e`](https://github.com/neo-capiro/meri-greenfield/commit/69040f9b4ab2d239bec1a057354d578d2bf24b1e), branch `fable/repair-package-2-20261015`.
- GitHub confirms standalone P2c repair [`ac08174070971880c6ebef8fc34b6f9262ba738f`](https://github.com/neo-capiro/meri-greenfield/commit/ac08174070971880c6ebef8fc34b6f9262ba738f) is an ancestor. Its browser, structure, grader, root package and lockfile content is unchanged in the integrated candidate.
- Prior reviewed P2c pin `31ed4a732e81000c1962765ff1d16cdcdf16ecaf` is also an ancestor.
- P2a repair [`743ae3700751e25947702ce5672b0978c27cc23a`](https://github.com/neo-capiro/meri-greenfield/commit/743ae3700751e25947702ce5672b0978c27cc23a) is an ancestor. Comparison shows no integration edits to its capability modules, options module, sandbox-readiness modules or matching focused tests. This is source-integration evidence, not an independent rerun of all P2a or package-wide tests.

## Retained H1–H5 findings

### H1: malformed OOXML and token-only PDF — ACCEPT the retained fixes

All **11 retained negative files** now reject in both the integrated validator and grader: the original eight-byte `PK` case plus the previous ten XML/ZIP/PDF failures. The test input builders were retained from the previous independent review, rather than replaced by the new authored fixtures.

XML is now parsed completely by namespace-aware `saxes`, with DTD refusal and strict UTF-8. Comments no longer manufacture relationships or overrides, malformed closing structure refuses, and OPC roots/namespaces are checked. See [xml.mjs, lines 19–32](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/xml.mjs#L19-L32) and [ooxml.mjs, lines 57–72](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/ooxml.mjs#L57-L72).

The PDF implementation now parses xref tables/streams and trailer/catalog structure. Both previous token-only PDF failures reject. This corrects the retained findings; it does not establish complete PDF structural validity, as the remaining defect below demonstrates. Native Office/PDF usability remains explicitly UNRUN.

### H2: ZIP central/local agreement — ACCEPT the retained fixes

Local flags, method, filename, CRC and sizes are checked; signed/unsigned descriptors are supported; entry spans must tile the pre-directory region; drive-letter and duplicate portable names refuse. See [zip.mjs, lines 35–69](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/zip.mjs#L35-L69) and [lines 72–92](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/zip.mjs#L72-L92).

The prior contradictory encryption flag, CRC, sizes and Windows path examples all refuse. The authored descriptor, layout, inflation and name regressions also passed independently.

### H3: effective-origin egress requirement — ACCEPT source/contract correction; live HOLD

The effective platform/tenant/role origin list is now **mandatory** for every connection kind and redirect hop, in addition to address/DNS controls. The opening criteria explicitly require negative public-allowlisted → public-unlisted redirect, subresource, WebSocket and narrowed-origin evidence: [activation.mjs, lines 10–24](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/activation.mjs#L10-L24).

The [egress reference decision](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/egress.mjs#L1-L30) and its four authored tests passed. It remains an unwired pure reference, not actual browser/network enforcement. The activation record is still held.

### H4: raw tenant boolean coercion — ACCEPT

Raw partial fields are validated before merging or normalization: [resolution.mjs, lines 67–94](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/resolution.mjs#L67-L94). The expanded write-time/run-time tenant and role type-negative tests passed, including the earlier `enabled:'yes'` and nested download boolean cases.

### H5: non-responsive approval — ACCEPT local completion correction; durable/live contract HOLD

The callback now races the approval port against abort and a bounded deadline, cleans up timer/listener state, and ignores late answers. Requests and allowed inputs are bound to a canonical digest of a private input copy: [permissions.mjs, lines 20–36](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/permissions.mjs#L20-L36) and [lines 78–86](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/permissions.mjs#L78-L86).

In addition to the authored mocked-time tests, independent actual-timer probes showed:

- A never-settling port denied with `BROWSER_APPROVAL_EXPIRED` after about 1,003 ms at the 1,000 ms configured deadline; its signal was aborted.
- Run abort after 10 ms denied with `BROWSER_APPROVAL_UNAVAILABLE` in about 11 ms; the port signal was aborted.

The `/2` local request and digest guard do not themselves authenticate the approver, consume approvals once, bind current page context, revoke durable decisions or prove live SDK delivery. Those remain canonical owner and integration obligations. No policy/contract freeze is implied.

## Remaining concrete source HOLD

### R1 — PDF `/Pages` reference ignores generation

The final catalog check only tests the referenced **object number's** xref entry type. It does not check the indirect reference generation or resolve the reference: [pdf.mjs, lines 124–128](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/pdf.mjs#L124-L128).

Reproduction against the integrated authored valid PDF fixture:

```js
const invalid = Buffer.from(
  pdf().toString('latin1').replace('/Pages 2 0 R', '/Pages 2 1 R'),
  'latin1'
);
structureCheck(invalid, 'pdf'); // { valid: true }
```

The equal-length edit preserves all byte offsets. The xref defines object `2` generation `0`, while the catalog now references nonexistent generation `1`. This is a reference-coherence failure, independent of rendering or full page-tree validation. Because the shared grader and download port rely on `structureCheck`, the positive structural verdict is still too broad. This probe directly exercised the validator; the downstream implication follows from [downloads.mjs, lines 49–54](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/downloads.mjs#L49-L54) and [grader, lines 12–26](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/evals/promptfoo/graders/usable-file.mjs#L12-L26).

**Narrow fix:** validate the `/Pages` reference through the existing resolver, including its generation (and generation-zero requirement for compressed objects), then add this equal-length negative regression. This does not require expanding the task into complete page-content/render validation.

## Parser bounds: accurate limits and recommendations

These observations are kept separate from R1. **They do not independently establish a release-blocking out-of-memory condition.** No qualified host memory budget was inspected and no exhaustion test was run.

- Browser input is capped at **25 MiB** by [policy.mjs, line 27](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/browser/policy.mjs#L27), checked before validation. ZIP permits at most **10,000 entries**, **128 MiB aggregate inflated data**, ratio **1,032**, and bounded inflation: [zip.mjs, lines 17 and 82–85](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/zip.mjs#L17-L85). Thus package XML input is finite and bounded by that aggregate limit.
- XML's event wrapper nevertheless retains every direct child and has no separate depth/node/part limit. A safe 400,013-byte synthetic XML probe retained 100,000 children, with approximately **44 MB additional heap / 68 MB RSS** in this run; depth 10,000 also parsed. That is measured allocation amplification, not a claim of an unbounded input or actual host failure. Recommend node/depth/part budgets chosen against the qualified worker budget, and avoid collecting main-part children when only the root is needed. Existing DTD refusal prevents external/declared-entity expansion.
- PDF has a 32-level direct-object parser limit, 64 xref sections, one million objects and a nominal 16 MiB stream bound. However [decodeStream, lines 101–106](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/structure/pdf-objects.mjs#L101-L106) applies `maxBytes` only to Flate inflation. An unfiltered 33-byte stream passed with `maxBytes=16` in a bounded helper probe. Raw browser input remains capped at 25 MiB. Recommend enforcing the same byte cap on unfiltered streams and predictor output as a small consistency fix; this helper probe is not evidence of an accepted over-budget whole PDF or process exhaustion.

## Dependency provenance and lock consistency

**ACCEPT exact dependency source addition, subject to normal image qualification.**

- Root package declares exact `saxes: "6.0.0"`: [package.json, lines 17–25](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/package.json#L17-L25).
- Lock entries pin saxes **6.0.0** and xmlchars **2.2.0** to the official npm registry with SHA-512 integrity values: [package-lock.json, lines 415–433](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/package-lock.json#L415-L433).
- Comparing parsed locks to `31ed4a73`, only these two package entries were added. Existing package entries are unchanged; the root devDependency map adds only saxes.
- An isolated `npm ci --ignore-scripts --no-audit --no-fund` succeeded using a writable task-local cache. Cached saxes and xmlchars tarball SHA-512 hashes were independently recomputed and matched the lock. Their tarball manifests confirm versions, ISC/MIT licenses, upstream repositories `lddubeau/saxes` and `lddubeau/xmlchars`, and no preinstall/install/postinstall scripts. Saxes' `xmlchars:^2.2.0` is satisfied by the exact locked 2.2.0.
- The first install attempt failed because npm's default cache path `/home/agent/.npm` could not be created, with secondary tar/cleanup warnings. Changing only the cache to the authorized review directory resolved the environment failure. No registry/permission denial was bypassed, no install lifecycle scripts ran, and no implementation/lockfile was edited.
- They are dev dependencies even though used at runtime. The current [runtime Dockerfile, lines 5–6](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/Dockerfile#L5-L6) installs the root lock without `--omit=dev`, so its source build recipe includes them. No image build or package-byte image binding was verified. Image acceptance remains HOLD.

## P2a interaction and unchanged integration gates

No source merge regression was found on the reviewed P2a/P2c boundary. P2a's inspected shared source is unchanged from its repair tip; P2c source is unchanged from its standalone repair tip. The browser fragment still is **not composed into the product activity**: [activity.mjs, lines 31–35](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/activity.mjs#L31-L35), [options.mjs, lines 31–41](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/options.mjs#L31-L41).

The P2a fragment permits neither browser `mcpServers` nor the browser fragment's envelope. Its permission chaining is first-allow-wins: [capabilities/fragment.mjs, lines 58–76](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/capabilities/fragment.mjs#L58-L76). This is not a newly introduced browser bypass because browser composition is absent. Future composition must preserve server-specific ownership, mandatory pre-tool checks, browser approval decisions, disallowed tools and both hooks; it cannot simply concatenate a permissive callback ahead of the browser gate.

Platform/tenant record freeze, execution policy binding, durable approval contract, artifact ingest owner, disposal wiring, installed Playwright image and actual SDK/host egress remain pending. The now-mandatory allowlist record and `/2` request are useful proposals, not approvals of those remaining integrations or pending user deferrals.

## Evidence and limits

- Node **v24.19.0**. Forty-eight materialized source files checked against Git blob hashes; unchanged dependencies were reconciled against the commit comparison.
- **43/43** committed browser + structure tests passed independently on the integrated source (33 browser, 10 structure), including download concurrency, retained failures before ingest, abort/deadline, type validation and egress reference tests.
- **11/11** retained independent malformed inputs rejected by both validator and grader.
- Two independent actual-timer approval probes passed.
- Four bounded parser/coherence probes produced the R1 and recommendations above.
- The complete Promptfoo suite, full conversation/P2a suite, root contracts and package-wide integration checks were not rerun here. Author-reported 236/236 worker and 26/26 structure/graders are not relabeled independent evidence.
- Real Playwright/Chromium, live SDK approval/cancellation, native Office/PDF rendering, real egress/DNS/rebinding, isolated-host sandbox/cleanup, image build, cloud activation and deployment remain **UNRUN**.

Evidence directory: `/workspace/shared/browser-review-69040f9b/`. Principal files: `source-manifest.json`, `npm-ci.log`, `browser-structure-tests.log`, `probe-retained-negatives.mjs`, `retained-negative-results.json`, `retained-negative.log`, `parser-bound-results.json`, `approval-real-timer-results.json`. All review processes exited.

**Next bounded step:** correct R1 and add its negative test, then independently rerun the structure/browser regressions at the new exact pin. Track resource-budget recommendations with the image/host owner without silently widening this repair into a complete parser or native-rendering audit. Keep capability default ON and all live gates held.
