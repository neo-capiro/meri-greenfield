# Independent task lookup evaluation review

Base: PR38 `77cedb126d57a0223d2df42ad2f3fe988eb51759`. Root outline `1e95f5b8`. Reviewer owns only `evals/task-lookup/test/eval-independent.test.mjs` (layout confirmation pending), this task, the matching review report, and `docs/qualification/candidates/task-slice-20261012/eval-review/`. Author owns production; no shared source changes are authorized here. Criteria recorded before candidate inspection.

## Review criteria

1. Reuse canonical contracts, hashes and inert JSON boundaries. Imports have no resource effects; CLI help/error handling is bounded. No model/provider/source/customer/native/database calls or installed dependencies; no implicit source activation.
2. Ingestion distinguishes approved real inputs from synthetic controls. Caller labels or counts cannot alone establish approval, provenance, successful collection or measured gates. No approved corpus is present in this lane; the real corpus remains zero.
3. Freeze exact case IDs/content, group/split, authority/scope, source snapshots/as-of, exact accepted route arguments, gold records and coverage, and configuration identities. Reject duplicate/substituted/mismatched cases or observations; detach borrowed JSON. Hashing alone is not source authorization or a signature.
4. Group related cases before splitting; detect group leakage. Keep held-out gold separate from runner inputs/tuning. Expose exact denominators and any missing/ineligible/failed/unrun cases. Never silently truncate gold or drop failing cohorts.
5. Score actual returned action-recommendation observations using the frozen expected values and current canonical result structure, including source/window/scope/IDs/counts/status/coverage. A hardcoded pass, unchanged mock counter or self-asserted observation success is insufficient. Recommendations do not imply accepted tasks, completion, delivery or mutation success.
6. Zero-result/incomplete/failed/stale/unavailable evidence cannot establish exhaustive absence. Explicit clarification/abstention expectations stay distinguishable from successful lookup. False absence/exhaustive claims remain visible even in failed or ineligible results.
7. Exact run/config/oracle/source/case identities bind results. Wrong configuration, altered observations, omitted/duplicate cases or incompatible route/arguments must not score as success. Hostile values, invalid arithmetic and empty denominators cannot manufacture passes.
8. Preserve adopted 75-real seed / >=200 expanded, original >=60 end-to-end tasks / >=90% completion / >=95% checked facts, >=100 adversarial isolation / zero leaks, all14 selected skills and all RG gates. Grouped100/50/50 splitting target and threshold provenance remain explicit; this slice cannot close whole-cohort gates. All97 catalog operations remain unavailable.
9. Scope is deterministic evaluation tooling, not runtime/model/real-data qualification. Exact source acceptance remains distinct from those HOLD gates. Source-level synthetic controls can test future approved-input ingestion without being admitted as real evidence.

## Execution plan

Confirm the author's concrete API before writing independent controls. Freeze synthetic test cases independently, inspect immutable source, then replay meaningful positive/negative controls via the actual modules. Preserve original failures and unchanged controls across any author repairs. Each local check is bounded to240 seconds, captures raw stdout/stderr and source identities, and verifies owned process-group exit. No broad suite duplicates or recursive delegation. Finish with exact source/packet/preservation audit, an ACCEPT_SOURCE or HOLD report, a hashed review manifest and clean review-only commits.

References read: AGENTS.md; IMPLEMENTATION-STANDARDS.md; ROUTING-EVALUATION.md; adopted MERI-DEPLOYMENT.md (original release table and RG qualification); exact `docs/coordination/r2/gates.json`. The repository has no tracked `.agents` entries at this base. Runtime/source credentials, real corpus access and paid-model budget remain unqualified.
