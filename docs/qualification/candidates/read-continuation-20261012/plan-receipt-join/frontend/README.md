# Nine-finding frontend follow-up

Nine existing findings across eleven bounded row facets are repaired and independently reviewed. The exact integrated candidate passed combined local qualification. Eighteen original source/design findings remain individually open; the 337-row acceptance ledger is unchanged. Native persistence, provider effects, live identity and final visual acceptance remain governed by each row's original criteria.

This is a separate successor to PR13. Frozen shipping source `d5dd0be9bf5ad7800e648ff1421ce047523288b3` and its evidence commit `fd1176790a6fb31b7ae68587f965a22d4145d8a2` remain untouched. No merge, deployment or AWS action occurred.

## Exact candidate

- Qualified source: `ee01be3b2c5c64a53744994ae4ad0d992a111054`
- Root tree: `bce79ae8c0f526e113468b885fc2c7a5515ac7b9`
- `apps/web` tree: `17385e9404d12baa01e695c72584a375f4842813`
- `apps/web/src` tree: `7b269ad4ecdd3071acb0a0fec9775a2190458388`

The later publication commit adds evidence/docs only. Source heads, archive identity and integration details are in [SOURCE.json](SOURCE.json). The standalone ZIP contains the exact 8,211 tracked source files plus source marker; both archive tools verified every byte and file mode. The archive is local, with no cloud upload or Library publication.

## Changed behavior

| Findings | Repair |
| --- | --- |
| MS02–MS05 | Verified Modules Calendar scope, retained URL date/view, separate scheduled/due task occurrences, independent feed errors and exact canonical Planner task navigation |
| CR-07, CR-11 | Safe current saved-signature preview and local Undo of the latest verified rewrite |
| OWI-F02 | Exact authorized supplied owner labels and individual upcoming-node status |
| PROS-F03 | Local search over the current authorized Prospect Files collection |
| CP-03 | Fence an uncertain dispatched deletion until deliberate current-file review; retain uncertainty after failed or superseded review |

Peer review found and closed four corrections before the source freeze: Calendar client navigation losing date/view; stale signature previews after failed rereads; failed delete recovery leaving stale file actions available; and TanStack silently adopting a replacement read that could clear the deletion fence. All failing baselines and intermediate outcomes remain in lane evidence.

Root adapted only the test fixture's existing dual transports/Clerk session mock and exact structure-review registrations. Shared production auth/session/client ownership, route entry points, shared styles, root manifests, governed transport contracts and architecture guard policy are unchanged from the consolidated baseline. The feature-level email and Work styles changed with their scoped repairs. The fixed Modules operation gateway, Portfolio Core/Intel transports and Meri public package boundary remain separate. Client selection remains presentation context, never backend authorization.

## Combined qualification

Every command receipt binds the same candidate before/after with empty source diffs. No browser test was skipped or retried.

| Gate | Result |
| --- | --- |
| Clean install | 847 packages; `npm ci --ignore-scripts --no-audit --no-fund` |
| Combined check | 1,432 tests: 58 root, 21 transport, 1,243 Portfolio, 110 Capiro; type/public-package/format checks passed |
| Lint | 0 errors, 76 inherited warnings |
| Architecture | 416 signals, 392 reviewed, 24 inherited-unreviewed, 0 blocking, 0 boundary errors |
| Elements | 15/15 with a newly prepared, verified SSR receipt |
| Production | One Next production build; actual standalone smoke passed |
| Modules browser | 182/182; one worker, 60-second timeout, zero retries |
| Portfolio/Meri browser | 1,051/1,051; three workers, 60-second default timeout, four existing slow cases at 180 seconds, zero retries |

The initial Elements invocation failed three of fifteen checks because its required SSR receipt was not supplied. That failed log is preserved. After preparing the official exact-source SSR artifact and receipt, all fifteen passed without a source change. Routine command-path setup mistakes remain separately recorded; none is presented as a product defect or hidden rerun.

The actual Next server ran without credentials, fixture identity or intercepted services: 11 HTTP checks, four desktop/mobile light/dark states, two cross-mode/history checks and zero page errors. It exercised Portfolio default root, compatibility/calendar/sign-in/health/narrow backend paths and Meri/Portfolio/Modules/Settings navigation with back/forward. Synthetic browser gates additionally exercise sign-out/expiry, actor/org/tenant/client replacement, interrupted writes, keyboard/focus and bounded desktop/mobile behavior. [VISUAL-SCOPE.md](VISUAL-SCOPE.md) preserves Figma and accessibility limits; complete screen-reader and 337-row visual/native acceptance remain unrun.

## Evidence and remaining work

[STATUS.json](STATUS.json) holds exact commands, counts and raw receipt links. [SCOPED-FACETS.json](SCOPED-FACETS.json) maps nine findings to eleven original rows without replacing row status. [Independent review](evidence/integration/INDEPENDENT-INTEGRATION-REVIEW.md) verifies 51 changed paths, lane equality, 250 preserved baseline specs/assertions, 345 original references including 337 in-scope rows, exact architecture bindings and the frozen d5dd archive. [STRUCTURE-REVIEW.md](STRUCTURE-REVIEW.md) explains cohesive ownership of each size signal. EVIDENCE-COPY-PART-1 through 5 retain per-file original paths, byte lengths and SHA-256 digests. Raw evidence attributes prevent line-ending conversion.

[REMAINING.md](REMAINING.md) retains all eighteen findings: four source, four source/design and ten design. Native follow-up requires the qualified image, known deployed versions/origins and provisioned synthetic tenant/client/actor fixtures described in `evidence/triage/STAGING-CHECKS.json`. The read-first checks, local Undo check, separately approved real rewrite and bounded disposable-file DELETE checks remain distinct. No native request, provider message, paid model workload or storage/security/database change was performed.

The [final publication audit](evidence/final-publication-review/report.md) independently checked the completed gates, copied evidence, source archive and bounded acceptance statements. Its original wording findings and verified corrections remain in that report. Committed-blob verification and the draft PR receipt are the final publication steps.

Before committing, root verified every manifest-listed file against the Git index. Existing `*.log` and generated-output ignore rules had omitted 199 evidence copies from ordinary staging; root explicitly added only those manifest-listed files, leaving application source and ignore policy unchanged. All 1,459 records (211,139,215 bytes, including the final audit packet) then matched their staged Git blobs. [Restoration inventory](IGNORED-EVIDENCE-RESTORATION.json) preserves the exact affected paths.
