# General long-form cited report (quick_skill.cited_report 1.0.0)

The accepted MM-16 general report recipe, distinct from the congressional Bill Watch 2.0.0 recipe. It
compiles the seven confirmed sections (summary, scope/as-of, findings, conflicting evidence,
recommendations, limitations, references) into an editable cited Word document for a client, portfolio or
personal subject from current authorized source evidence, and preserves the immutable parent's version,
object, specification and retained source evidence on revision.

- `manifest.json` — the installed identity, its four declared sources and their existing closed-catalog
  operations, its subject kinds, window bases, completion rubric, approval and budgets.
- `SKILL.md` — the installed prose with the real SDK frontmatter; it names its own identity and states the
  Bill Watch boundary.
- `skill.mjs` — loads the manifest through the additive 0.3.0 identity receiver, checks the prose pin and the
  manifest↔catalog operation/source pins.
- `input.mjs` — the private typed input. The subject and window are **not** model input: they arrive from the
  trusted selection, so no model output can widen or substitute the scope.
- `evidence.mjs` — binds each read to the trusted selected subject, the caller's scopes, the manifest's own
  operation for that source and the observation instant; the passage/observation kernel is the shared one.
- `compose.mjs` — the compiler, the seven-section renderer, conflict disclosure, revision provenance and the
  prepared-report admission guard.
- `binding.mjs` — recipe correspondence for the canonical artifact owner, including the retained-evidence
  admission so earlier-run evidence is admissible only for this exact prepared context.
- `test/cited-report.test.mjs` — 21 focused tests over trusted synthetic ports.

## Held insertion (prepared, not applied)

The four shared files this recipe must be dispatched from are held for the coordinator's sequence; the exact
spans and code are recorded in `S/work/hermes-implementation/report-native-bridge/GENERAL-REPORT-CLAIM.txt`
(section 2): `apps/control/conversations/skills/execution.mjs` (`createCitedReportCompiler` branch and
import), `apps/control/conversations/skills/retention.mjs` (`admitPreparedCitedReport` import, `admitted` and
`originalGuard` entries), `apps/worker/conversation/skills/mcp.mjs` (`admitOriginalSkill` entry) and
`apps/runtime/selected/output-format.mjs` (compiler key and the SDK schema branch below). No shared edit was
made in this turn.

The output-format branch mirrors this recipe's private input exactly, and deliberately has no `subject`
property (`selectedOutputCompiler` returns `pin.skillId` for this pin):

```js
 else if(selectedOutputCompiler(selected)==='quick_skill.cited_report'){
  const citation=P({sourceId:{enum:[...citedReportSourceIds]},recordId:{type:'string',minLength:1,maxLength:256},
   sourceVersionId:{type:'string',minLength:1,maxLength:256},start:{type:'integer',minimum:0},end:{type:'integer',minimum:1},url:{type:'string'}},
   ['sourceId','recordId','sourceVersionId','start','end']);
  return object({skill:object({skillId:{const:selected.pin.skillId},skillVersion:{const:selected.pin.skillVersion},manifestSha256:{const:selected.pin.manifestSha256},
   proseSha256:{const:selected.pin.proseSha256},catalogSha256:{const:selected.pin.catalogSha256}},['skillId','skillVersion','manifestSha256','proseSha256','catalogSha256']),
   title:{type:'string',minLength:1,maxLength:200},asOf:{type:'string'},summary:{type:'string',minLength:1,maxLength:2000},
   findings:{type:'array',minItems:1,maxItems:40,items:object({id:{type:'string'},kind:{enum:['excerpt','claim']},text:{type:'string',minLength:1,maxLength:2000},
    citations:{type:'array',minItems:1,maxItems:10,items:citation}},['id','kind','text','citations'])},
   conflicts:{type:'array',maxItems:20,items:object({findingId:{type:'string'},note:{type:'string',minLength:1,maxLength:1000}},['findingId','note'])},
   recommendations:{type:'array',minItems:1,maxItems:20,items:{type:'string',minLength:1,maxLength:1000}},
   limitations:{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:1000}}},
   ['skill','title','asOf','summary','findings','conflicts','recommendations','limitations']);
 }
```

## Known limitations

- General branding, cover treatment and the whitepaper template/entry decision are still an open held
  decision; this version is the seven confirmed sections with the general subject scopes.
- Native DOCX rendering/qualification and the Meri Promptfoo/DeepEval regression are separate qualifications
  and are not claimed here.
- The public generated conversation-application contract is regenerated centrally (M5); until it is, the
  committed descriptor still lists the original fourteen identities.
