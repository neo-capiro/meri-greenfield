# report-brief — sourced cited report recipe

Private recipe owner for the accepted **seven-section cited Word report**:

    Summary, Scope and as-of, Findings, Conflicting evidence, Recommendations, Limitations, References

It adds no route, no model loop and no authority. It reuses the congressional sourced brief's kernel
(`../research-brief/{input,evidence}.mjs`) for the trusted source read binding, citation/offset rules,
verification statuses and conflict detection, and pins its own recipe prose (`SKILL.md`) and manifest.

## Owner surface

| File | Role |
| --- | --- |
| `manifest.json` | recipe identity: installed skill pin, prose hash, required sources, allowed operations, report rubric |
| `SKILL.md` | the recipe prose (hashed by `manifest.json`) |
| `skill.mjs` | `reportSkillPin()`, `reportManifest()`, `reportSourceIds`, `reportReadOperation(sourceId)` |
| `input.mjs` | closed report input (summary, findings, conflicts, recommendations, limitations) over the shared legislative subject |
| `compose.mjs` | `createCongressionalReportCompiler({readSource,readBase,now})`, `admitPreparedReport`, `preparedReportEvidenceSha256` |
| `binding.mjs` | `bindPreparedReportArtifactOptions(prepared, artifactOptions)` — composition guard plus the retained-evidence admission |

## Production seam

The compiler is composed exactly like the existing congressional sourced brief: trusted `readSource`
and `readBase` ports owned by the runtime/gateway, then the prepared result is bound into the
existing document application's `artifactOptions` (`createDocumentApplication({artifactOptions:
bindPreparedReportArtifactOptions(prepared, artifactOptions)})`). The artifact service, the document
application routes, the intent journal and the native DOCX executor are unchanged.

`readBase` is the existing artifact owner's retained record read. On revision the compiler verifies
the immutable parent's version id, spec hash, tenant/actor/conversation, scopes and provenance block,
refuses a parent whose spec references assets (there is no retained asset object to re-present), and
carries the parent's **retained evidence** into the new context evidence. The bound
`admitRetainedEvidence` admits that evidence only for this exact prepared context, so the revised
version keeps the parent's evidence instead of dropping it.

## Not in this owner

- No installed public skill package: the recipe is a distinct bounded selection over the installed
  pin `quick_skill.bill_watch` `1.0.0` that the congressional sourced brief already uses. A dedicated
  installed long-form report/whitepaper skill pin remains a coordinator/public-package dependency.
- No routing, activation, filing, approval or publication change.
- No asset-bearing report container: assets stay with their existing prepared owners.
