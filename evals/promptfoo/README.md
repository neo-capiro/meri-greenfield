# Representative-task suite (Promptfoo)

Sixty task slots across the plan's five capability groups, twelve each: data and memory (`DM`), government intelligence (`GI`), client work (`CW`), deliverables (`DL`) and agent product (`AP`). The JSON files in `cases/` are the single owner of every slot. Each slot names its capability, expected evidence, permissions (principal, scope kinds, allowed or denied with the canonical refusal code, forbidden markers), output format and success criteria, and lists the graders that apply.

- `AWAITING_APPROVED_REAL_REQUEST_SOURCE` (48 slots): the task needs a real Capiro request, source snapshot and frozen gold evidence. Prompt, scenario and evidence values stay `null` and the slot never runs. This matches `evals/retrieval-r2/manifest.json`, where no real request has been received.
- `SYNTHETIC_RUNNABLE` (12 slots, at least two per group): prompts start with `SYNTHETIC:` and use synthetic tenants only. They run against the canonical owners composed in `evals/offline-targets` (conversations HTTP application, gateway authority and dispatch, artifact service with the plain-text executor). The agent-product recovery slots wrap the existing deterministic provider `apps/worker/qualification/checkpoint/session-store-eval-provider.mjs` without changing it.

## How it works

`promptfooconfig.yaml` uses the custom JavaScript provider `provider.mjs` and the test generator `cases/index.mjs`, which emits only runnable synthetic slots. The provider is a scripted runtime: it resolves the case from the repository, rejects a prompt that differs from the frozen one, and passes the scenario a runner view with evidence IDs and paths but no expected values or refusal codes (`runnerView`). It returns an observation envelope with claims, cited evidence, files and any refusal, read from what the target actually returned. Cost and token usage are zero.

`graders/index.mjs` is the Promptfoo `javascript` assertion. It looks the case up by `vars.caseId` and runs that case's graders:

- `factual-claims`: every claim cites expected evidence; the observed evidence source, path and value, and the claim value, must equal the frozen expectation; every required evidence item must be supported. The score is the share of correct claims.
- `usable-file`: file count, extension, canonical MIME type (`packages/contracts/artifacts-0.2/artifact-formats.mjs`), strict base64, size limit, recomputed SHA-256, structural validity through `apps/artifacts/structure/file-structure.mjs` (verified ZIP/OPC package with the claimed main part for DOCX/XLSX/PPTX, PDF cross-reference trailer, strict UTF-8 text) and required text in the latest file (text files only; a non-empty requirement on another format fails closed as `REQUIRED_TEXT_UNVERIFIED`). A pass is structural evidence only: native open/render in Office or a PDF reader is UNRUN.
- `permissions`: no refusal when allowed; exactly the canonical code when denied; no forbidden marker anywhere in the output.
- `output-format`: case ID, envelope kind and envelope shape.

## Running

- `node --test evals/promptfoo/test/*.test.mjs` runs the provider and graders directly over every generated test, checks the 60-slot cohort and validation, and covers each grader's failure modes.
- With promptfoo 0.124.1 installed (a candidate in `docs/COMPONENTS.md`; this lane did not install it): `npx promptfoo@0.124.1 eval -c evals/promptfoo/promptfooconfig.yaml --no-cache`. That CLI path has not been run here.

## What it does not prove

These are LOCAL_FIXTURE observations. No model, Claude Agent SDK query, network, database, Temporal, browser or native Office executor runs. A passing synthetic slot shows that the scripted runtime and the composed owners behave as frozen. It does not show that Meri completes real work. The plan's real-work release criterion (at least 60 representative real tasks at 90% or more completion and 95% or more checked factual correctness, scored against a staging candidate) stays unmet until approved real requests fill the 48 awaiting slots, gold evidence is frozen before grading, and the suite runs against the deployed runtime. The YAML config has not been run under the Promptfoo CLI, and the shape of the JavaScript test generator is unverified against that CLI.
