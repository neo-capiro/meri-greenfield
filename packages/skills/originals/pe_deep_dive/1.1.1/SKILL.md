---
name: meri-pe-deep-dive
description: Prepare the explicitly selected PE Deep Dive with structured public SQL, decisive source reads and visible coverage.
disable-model-invocation: true
---

# PE Deep Dive

Identity: `quick_skill.pe_deep_dive`; immutable version `1.1.1`.

1. Resolve the exact PE with `search_program_elements` and `get_program_element`. Confirm ambiguous names. Preserve the canonical PE code and appropriation type: procurement lines and RDT&E PEs are different records.
2. Call `describe_capiro_data` with `source: public` before structured reads. Use `query_capiro_data` for the described PE/project rows and raw budget-position assertions. Author SQL against only the returned logical relations and columns, with bound parameters. This replaces repetitive structured extraction for these covered rows; it does not replace consolidated/current/enacted funding, source excerpts, contractors or reports.
3. Keep PE and project funding at their own grains. Filter `position_cycle`, `asserted_fy` and `value_kind` explicitly. `total` is USD millions, `quantity` is units and PE `unit_cost` is USD millions per unit. A future-year position in a current PB book is not that future year's submitted request. Never multiply PE totals by joining projects, or use `SUM(DISTINCT amount)` to hide that multiplication. Project sums need not equal PE totals. Preserve all integer/decimal strings exactly; missing years and nullable locators stay missing.
4. Use `get_pe_budget_timeline` for the consolidated FYDP, current basis and enacted funding. Keep requested, authorized, appropriated, obligated, actual and outlay values separate. Retain stage/cycle, fiscal year, revision, units and as-of time; do not interpolate or compare incompatible bases.
5. Use `get_pe_bills` to obtain canonical related bill IDs, then SQL for covered bill/member/subject/cosponsor joins. Match Bioguide IDs, not names; soft joins can be missing. Filter `withdrawn_date IS NULL` when counting active cosponsors. Deduplicate bill IDs before counting subject matches. `congress_members.is_current` does not establish historical membership. Read `get_bill_status` and exact `read_bill_text` versions for decisive legal claims; public SQL metadata does not establish enacted wording or an immutable bill version.
6. Read `get_pe_report_language`, `get_pe_contractors` and the retained CBO/GAO/CRS readers as relevant. A PE reference is not an award. Keep authorization/appropriation and family/chamber lanes separate. Return program purpose, component structure, FYDP, report excerpts, contractors, bill/status table and clearly labeled opportunities/risks, with a source-coverage appendix.

## Structured query examples

These are parameterized starting points, not evidence or hardcoded authority. Confirm the described fields and substitute exact canonical identifiers. Specify a finite `rowLimit`; follow a full-key continuation predicate when more rows are needed. Neither an authored SQL LIMIT nor a row/byte cap proves enumeration complete.

```json
{"source":"public","sql":"SELECT p.pe_code, p.project_code, p.title, p.mission, p.fy, p.source_url, p.page_number, p.source_document_id FROM program_element_projects p WHERE p.pe_code = $1 ORDER BY p.pe_code, p.project_code","parameters":["0600000A"],"rowLimit":200}
```

```json
{"source":"public","sql":"SELECT b.pe_code, b.position_cycle, b.asserted_fy, b.value_kind, b.amount, b.source_url, b.page_number, b.source_document_id FROM program_element_budget_positions b WHERE b.pe_code = $1 AND b.position_cycle = $2 AND b.value_kind = $3 ORDER BY b.pe_code, b.position_cycle, b.asserted_fy, b.value_kind","parameters":["0600000A","pb_fy2026","total"],"rowLimit":200}
```

```json
{"source":"public","sql":"SELECT b.id, b.congress, b.title, b.sponsor_bioguide_id, m.full_name AS sponsor_current_name, b.status, b.last_synced_at FROM congress_bills b LEFT JOIN congress_members m ON b.sponsor_bioguide_id = m.bioguide_id WHERE b.id = $1 ORDER BY b.id","parameters":["hr1-119"],"rowLimit":1}
```

## Evidence, completion and authority

Use only this exact selected version and its allowed operations. The Claude Agent SDK owns the model loop; control and Temporal retain current authority, scope, budgets and immutable selection across resume/fork. Never broaden tenant/client scope or silently replace an old recipe. Ordinary questions do not inherit this comprehensive workflow.

SQL results are derived query evidence. Retain returned canonical IDs, source locators, relations used, generated/read times and disclosed limitations. Do not fabricate source versions, freshness, total matches, immutable source cards or quotation hashes for an aggregate. A null source timestamp remains unknown; a stored-row timestamp is not source freshness. Report `rowLimitReached`, `byteTruncated` and `coverage.sqlLimit` independently, and keep `sourceUniverseComplete: false` honest. Describe missing decisive reads, conflicting amounts and unchecked sources. No negative universe claim follows from bounded rows, a top-k search or a successful query.

For decisive passages, use the retained reader and preserve its actual source/record/version/hash/scope/authorization/time binding. Separate extracted facts, inference, recommendations and proposed language. Source snippets, memory and URLs alone do not verify a conclusion. Partial results are useful when disclosed; continue authorized pages within the admitted budget and say what remains.

Do not create tasks, change memory, send messages, file or share artifacts while preparing this read-only brief. Any mutation uses the existing separate immutable approval proposal. This recipe does not retire the legacy global query tools or their twelve-dataset coverage. Source activation and live qualification remain separate.
