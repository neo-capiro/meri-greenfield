# Fable lane report: final scope ledger (15 October 2026)

Lane `scope-ledger`. Branch `fable/a5-scope-ledger-20261015`, worktree `/home/user/meri-a5`, base `e76189da` (`fable/p3-general-reads-design-20261015`). This is a documentation and source-evidence lane: it changes no product code, contract, catalog, lockfile, migration, credential or deployment.

## Outline (standards section 4)

| Responsibility | Module |
| --- | --- |
| Entry point (`--check`, `--write`, `--help`; exit codes 0/1/2/3) | `scripts/scope-ledger/cli.mjs` |
| Source reading, CSV integrity pin, excluded-name reference scan (offline, inert on import) | `scripts/scope-ledger/sources.mjs` |
| Strict decoding of the audit CSV evidence | `scripts/scope-ledger/coverage-csv.mjs` |
| Pure ledger construction and validation (rows, gates, product capabilities, ownership graph) | `scripts/scope-ledger/ledger.mjs` |
| Pure audit-versus-p3 reconciliation | `scripts/scope-ledger/reconcile.mjs` |
| Markdown table rendering and splicing between fixed markers | `scripts/scope-ledger/markdown.mjs` |
| Curated inputs | `owner-exclusion.json`, `gates.json`, `product-capabilities.json`, `ownership-graph.json` |
| Drift and consistency test | `scripts/scope-ledger/ledger.test.mjs` |

Dependency direction: cli → sources/ledger/markdown; ledger → reconcile; sources reuses `parseScopeLedger` from `scripts/general-reads/sources.mjs` (no reverse import, no cycle). The ledger reads the committed general-read inventory rather than rebuilding it, so `scripts/general-reads/inventory.test.mjs` stays the single owner of inventory drift. Only Node built-ins are used.

## Deliverables

- `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md`: hand-written decisions plus a generated block.
- `docs/coordination/ledgers/scope-ledger.json`: machine-readable ledger.
- `docs/coordination/ledgers/TOOL-COVERAGE-96.csv`: byte-exact audit copy from `origin/dot/meri-comprehensive-audit-20261015` `82a01508`; 25,248 bytes; SHA-256 `42dc47fb19a326bb2ed0b45c03f293ea27478a004e29916741aabeecb38977a1`. A directory-local `.gitattributes` (`-text -whitespace`) keeps its 97 CRLF lines and stops `git diff --check` from flagging them. The committed blob `e65b4fb0` is identical to the audit branch blob.

## Audit requests addressed

1. **Reconciled final scope ledger** (README "Corrected tool and scope accounting"; product-integration "End-goal scope accounting" and "All 43 historically deferred registry capabilities"). All 139 rows are covered.
   - Each row records: decision, kind in both accountings, replacement contracts, declaration status, adapter, dispatch context, route, integration phase, planned lane and canonical owner, verifier, gates and open items.
   - The audit numbers are reproduced from the CSV:
     - 85 reads + 11 non-reads;
     - 53 declared = 52 reads + `create_word`;
     - 43 undeclared = 33 reads + 10 non-reads;
     - 47 + 6 − 1 = 52.
   - The p3 numbers are reproduced from the inventory: 82 / 10 / 4; 88 same-name + 8 renamed; 97 contracts.
   - Every difference between the two is explained row by row: 3 product-state reads, `create_word` (Bill Watch), `query_action_items` (historical successor), 6 renamed declared reads, and 1 renamed undeclared.
   - The generator refuses to build if the CSV and the inventory disagree on any row's canonical contract, version, side effect, declaring skills or declared flag.
2. **The 43 historical exclusions are not silently perpetuated.** They are recorded as excluded by Neo's explicit direction of 15 October 2026, with the quote and date, separately from the 10 October deferral. The drift test pins them to the deferred scope rows and the five owner groups: 17, 9, 5, 3 and 9.
   - "Built by accident" check: no implementation was found at the base or on any `fable/*` branch tip, so there is no dead code to delete.
   - 35 files name excluded tools. Each is a classified non-implementation reference.
   - Two canonical model-visible texts remain, `update_client_profile` and `create_client`. They are contract-owned, so they go to dot as P6.
3. **Product capabilities outside the registry.** All 11 scope rows are covered with their exact planned owner and acceptance text, plus 7 more rows:
   - browser ON by default, with destinations denied by default (`7606375d`), on the public-browser row;
   - memory proposals and sourced corrections;
   - retention and deletion;
   - desktop surfaces;
   - Objective → Strategy → Planner;
   - mobile, deferred relative to desktop;
   - four non-registry historical deferrals, recorded as owner decisions required.
4. **One ownership graph (audit repair step 2), as a proposal for dot.** It covers 15 domains, and every path is verified at the base.
   - Owned: 0.
   - Partial: 11.
   - Unowned: 4 (budget/proxy, retention, settings, release).
   - Unowned responsibilities are listed for each domain.

No audit defect finding (L1–L6, SEC-REL-01–06, DA-1–4) is closed by this lane. Those are code lanes. This lane maps them to gates and owners.

## Checks

Node v24.21.0. Root `node_modules` was symlinked from `/home/user/meri-fable-complete` because the root `package-lock.json` is byte-identical (`cmp`). The link was removed at handoff. The ledger itself uses only built-ins.

- `node --test scripts/scope-ledger/ledger.test.mjs`: **15/15 pass** on the first full run, and again after adding the symlink case and the title fields. This is a new file, so there was no before state. The optional git-blob comparison ran (not skipped) because the audit commit is present locally.
- `node scripts/scope-ledger/cli.mjs --check`: exit 0.
- `node --test scripts/general-reads/inventory.test.mjs`: **11/11 pass** with the byte-identical root dependencies linked. Without them the file fails at import (`Cannot find package 'ajv'` from `packages/contracts/schedules-0.2/lifecycle-validation.mjs`). That is environmental and matches the p3 report; the ledger test needs no dependencies and passes 15/15 either way.
- `node scripts/general-reads/cli.mjs --check`: exit 0. Inventory unchanged.
- Drift proofs. Each one was a temporary change, restored afterwards, with `--check` run against it:
  - hand edit of `scope-ledger.json` → exit 1 (drifted);
  - hand edit inside the Markdown generated block → exit 1;
  - planted `apps/worker/conversation/legacy-probe/send.mjs` naming `send_email` → exit 3 (unclassified file names an excluded tool);
  - owner list missing `save_note` → exit 3;
  - one byte appended to the CSV → exit 3 (differs from the audit-published bytes).
- Reverted-guard proof: with the `node_modules`/symlink skip removed from `scanReferences`, the scanner test fails (it finds `node_modules/y/index.mjs` and the symlinked `packages/linked.mjs`). It passes again once the skip is restored.

Not run: the contracts suite, worker suites and anything live. No contract, catalog, product or test file outside `scripts/scope-ledger` changed. No SDK, model, database, browser or deployment check applies to a documentation lane.

## Proposals for dot

- Accept, amend or reject the ownership graph, and allocate the shared files and migrations it implies.
- P6: neutralize the canonical guidance naming `update_client_profile` and `create_client`.
- P7: successor skill versions naming `actions.query`.
- Confirm whether `search_public_web` and `scrape_web_page` (planned A/C) are served by a gateway adapter or by the browser, with no second path.
- Integrate the guard test `875b3055`.
- Carry the general-read proposals P1–P5, P8, P9, P11 and P12 forward.

For Neo:

- P10, the `meri_intents` governed intent surface.
- The five non-registry historical deferrals.

## Residual risks

- The owner quote is relayed through the lane brief and corroborated by `875b3055`. This lane did not re-confirm it with Neo.
- `knownReferences` is a curated classification. A future legitimate reference must be classified by a reviewer, which is the intended friction.
- The scan covers text sources under `apps/`, `packages/` and `scripts/`, not `docs/` (historical evidence) or the separate frontend/backend repositories.
- Gate assignment rules are derived from route owner, side effect and dispatch context. They are a proposal for dot's review, not accepted acceptance criteria.
- The ownership states are source-level judgements drawn from the audit reports at `82a01508` and paths at `e76189da`. Later branches (a1–a4, p2a–p2c) may change them.

No processes were left running. The temporary drift-proof files and the scanner test's temporary directories were removed. Backups of the edited files were kept only in the session scratchpad.
