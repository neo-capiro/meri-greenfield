# Handover reference index

Engineering snapshot: **11 October 2026, 12:10 UTC**. **G0 accepted; G1 OPEN; G2–G7 unentered.**

This index publishes the documents referenced by the engineering handover. Existing canonical documents are linked at immutable GitHub commits; previously local-only report documents are copied below with original commit, hash and acceptance boundaries. The controlling plan, workbook and earlier supplied plans are already checked in. No private raw capture, credential, key, customer content or candidate implementation is published by this change.

**Implementation outline:** integration owner owns `docs/handover/20261011/` plus the latest-human-direction update to AGENTS/DECISIONS in a dedicated worktree. Fast-forward its base to accepted integration `2f0e03a`; publish accepted/pending source branches and a separate byte-preserved SDK WIP checkpoint for remote pickup. Reuse canonical plans/reports and exact report blobs. Publish references first, bind Word/PDF links to that immutable revision, then publish visually verified handover artifacts. Verify all GitHub targets, source/file hashes, acceptance labels and layout. Pending code remains unintegrated; gates and deployments are unchanged.

**Reading private links:** sign in to GitHub with repository access. A GitHub documentation link is not proof that ignored raw operational evidence was uploaded or independently reproducible from a clone. [Published local-evidence status](LOCAL-EVIDENCE-STATUS.md) states exactly what remains outside Git. Copied author reports retain historical wording; current root acceptance below controls.

## S01

**Adopted deployment plan R2**

SHA256 43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388; 86,848 bytes.

- [docs/plans/MERI-DEPLOYMENT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/MERI-DEPLOYMENT.md)
- [docs/plans/revisions/20261010-R2/Meri_Codex_Hermes_Deployment_Plan-R2.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/revisions/20261010-R2/Meri_Codex_Hermes_Deployment_Plan-R2.md)
- [docs/plans/Meri_Greenfield_Agent_Plan.docx](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/Meri_Greenfield_Agent_Plan.docx)
- [docs/plans/archive/MERI-DEPLOYMENT-20261009-before-figma.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/archive/MERI-DEPLOYMENT-20261009-before-figma.md)
- [docs/plans/archive/MERI-DEPLOYMENT-20261010-before-R2.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/archive/MERI-DEPLOYMENT-20261010-before-R2.md)

## S02

**Pinned workbook and input manifest**

SHA256 3d281d7a1a9a1eaf4fe520dde8e46e2abedac82f6b771041a613c1cfb0df25ec; 127,877 bytes. Downloads copy is locked; pinned copy hash reverified.

- [docs/plans/revisions/20261010-R2/Meri_Capability_Inventory-20261010-R2.xlsx](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/revisions/20261010-R2/Meri_Capability_Inventory-20261010-R2.xlsx)
- [docs/plans/revisions/20261010-R2/manifest.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/revisions/20261010-R2/manifest.json)

## S03

**Human authority and engineering rules**

D010 Codex-only; D012 scope/pilot; D014 frontend. Two historical D013 headings exist: cite heading/date, not number alone.

- [AGENTS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/AGENTS.md)
- [docs/IMPLEMENTATION-STANDARDS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/IMPLEMENTATION-STANDARDS.md)
- [docs/coordination/DECISIONS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/DECISIONS.md)
- [Latest human continuation direction superseding historical no-Hermes restriction](CONTINUATION-INSTRUCTIONS.md)

## S04

**G0 accepted discovery**

Discovery/policy observations and pending live enrollment; planning acceptance retained.

- [docs/coordination/reports/CODEX-G0-DISCOVERY.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G0-DISCOVERY.md)

## S05

**Figma final inventory**

189 original classified IDs across Meri/Settings split; structural classification does not establish behavior acceptance.

- [docs/coordination/reports/CODEX-FIGMA-FINAL-INVENTORY.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-FIGMA-FINAL-INVENTORY.md)
- [docs/UI-COVERAGE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/UI-COVERAGE.md)

## S06

**Component and security register**

Pinned versions, image history, Office and license/security qualification holds.

- [docs/COMPONENTS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/COMPONENTS.md)
- [docs/qualification/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/qualification/)

## S07

**Source and capability scope**

22 domains, 139 native IDs, accepted 96/43 disposition; replacement nulls in inherited ledger are historical coordination data.

- [docs/SOURCE-INVENTORY.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/SOURCE-INVENTORY.md)
- [docs/CAPABILITY-SCOPE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/CAPABILITY-SCOPE.md)
- [docs/coordination/r2/capabilities.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/capabilities.json)

## S08

**Canonical public contracts**

Strict 0.1 public contracts; regenerate generated artifacts through generator.

- [packages/contracts/meri.schema.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/meri.schema.json)
- [packages/contracts/validate.mjs](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/validate.mjs)
- [packages/contracts/README.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/README.md)
- [packages/contracts/dist/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/dist/)

## S09

**R2 typed retrieval foundation**

Private additive 0.2 namespace, selected intents and source references. No complete runtime parity.

- [packages/contracts/retrieval-0.2/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/retrieval-0.2/)
- [docs/coordination/r2/requirements.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/requirements.json)
- [docs/coordination/r2/capabilities.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/capabilities.json)
- [docs/coordination/r2/skills.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/skills.json)

## S10

**R2 reconciliation**

Ten sheets reconciled; six ledgers; original formulas not recalculated; optional providers disabled.

- [docs/coordination/reports/CODEX-R2-ADOPTION.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-R2-ADOPTION.md)

## S11

**Retrieval baseline protocol**

75→200 labelled baseline, snapshots/oracles/diagnostics and pending real data.

- [docs/RETRIEVAL-AUDIT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/RETRIEVAL-AUDIT.md)
- [docs/coordination/r2/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/)

## S12

**Qualification infrastructure and active owner notes**

Published STATUS at 11:30 UTC is older than local collector and subsequent actual browser review; see this handover deltas.

- [docs/coordination/STATUS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/STATUS.md)
- [docs/coordination/reports/CODEX-G1-ACTUAL-ABI-AND-DISCOVERY-OWNER.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-ACTUAL-ABI-AND-DISCOVERY-OWNER.md)
- [infra/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/infra/)

## S13

**Native TLS bounded actual result**

CodeBuild 6baed94e-1d9f-4e5e-bf56-dce4f9b0e660; image a748fe7184c8879b12c0f1cd0aa924b14408c7e14583cf55ad3e8dabc33b9611. Five controls pass; bounded scope only.

- [docs/coordination/reports/CODEX-G1-PROXY-PRISMA-NATIVE-TLS-DISCOVERY.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PROXY-PRISMA-NATIVE-TLS-DISCOVERY.md)
- [docs/coordination/reports/CODEX-G1-PRISMA-DIRECT-TLS-GROUP.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PRISMA-DIRECT-TLS-GROUP.md)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S14

**Combined native proxy source**

Integrated 9998ade; 21-member preparation and 353-file context; actual combined application auth not run.

- [docs/coordination/reports/CODEX-G1-PROXY-COMBINED-OWNER-SOURCE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PROXY-COMBINED-OWNER-SOURCE.md)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S15

**Runtime body provenance and collector**

13036c0 provenance; collector 1f68d7d → local 2f0e03a. Root 23/23 controls, source only; actual image collection unrun.

- [docs/coordination/reports/CODEX-G1-PROXY-RUNTIME4-PROVENANCE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PROXY-RUNTIME4-PROVENANCE.md)
- [Published CODEX-G1-PROXY-RUNTIME4-COLLECTOR-report.md](references/CODEX-G1-PROXY-RUNTIME4-COLLECTOR-report.md) — Root accepted source-only; actual collection unrun.
- [Published CODEX-G1-PROXY-RUNTIME4-COLLECTOR-task.md](references/CODEX-G1-PROXY-RUNTIME4-COLLECTOR-task.md) — Original bounded task; no renewed runtime admission.
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S16

**SDK fixture and interruption**

accf7ca/878ee87 corrected fixture contract; mandatory partial flags remain false. Worker wire/adapter unfinished separately.

- [docs/qualification/SDK-FIXTURE-CHANNEL.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/qualification/SDK-FIXTURE-CHANNEL.md)
- [docs/coordination/reports/CODEX-G1-SDK-FIXTURE-TIMING-REPAIR.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-SDK-FIXTURE-TIMING-REPAIR.md)
- [packages/contracts/qualification-sdk/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/packages/contracts/qualification-sdk/)
- [apps/worker/qualification/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/apps/worker/qualification/)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S17

**Proxy durable state and Temporal**

Local PostgreSQL crash/race evidence; accepted Temporal design. No production database/HA/restore acceptance.

- [docs/coordination/reports/CODEX-G1-PROXY-DURABLE-STATE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PROXY-DURABLE-STATE.md)
- [docs/qualification/PROXY-TEMPORAL-DECISIONS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/qualification/PROXY-TEMPORAL-DECISIONS.md)

## S18

**Browser SOURCE4 actual diagnostic**

Proof 76ecc118-e818-4814-9ef7-d48e161a41c0 consumed and expired. 11 calls, two empty filtered replies; no host/cleanup/absence admission.

- [docs/coordination/reports/CODEX-G1-BROWSER-POST-BOOTSTRAP-READONLY-PROFILE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-BROWSER-POST-BOOTSTRAP-READONLY-PROFILE.md)
- [docs/coordination/reports/CODEX-G1-BROWSER-WIRE-SHAPE-REPAIR.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-BROWSER-WIRE-SHAPE-REPAIR.md)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S19

**Browser actual independent review and enforcement**

79 review payloads and 1,176 refs. Genuine sandbox/host qualification remains open; exact-volume source follow-up unfinished.

- [docs/coordination/reports/CODEX-G1-BROWSER-WIRE-SHAPE-INDEPENDENT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-BROWSER-WIRE-SHAPE-INDEPENDENT.md)
- [infra/browser-enforcement/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/infra/browser-enforcement/)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S20

**Mail first full-read contract**

867a9e1 integrated; root 55 checks; no handler or live source.

- [docs/coordination/tasks/CODEX-G1-REL02-MAIL-FIRST-CONTRACT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/tasks/CODEX-G1-REL02-MAIL-FIRST-CONTRACT.md)
- [docs/coordination/reports/CODEX-G1-REL02-MAIL-FIRST-CONTRACT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-REL02-MAIL-FIRST-CONTRACT.md)

## S21

**Mail list/search pending candidate**

dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6; distinct ACCEPT_SOURCE_ONLY; root acceptance/integration pending. 68 distinct author test names, not one final whole-suite replay.

- [Published CODEX-G1-REL02-MAIL-LIST-SEARCH-CONTRACT-report.md](references/CODEX-G1-REL02-MAIL-LIST-SEARCH-CONTRACT-report.md) — Pending root acceptance; distinct source-only review does not integrate this candidate.
- [Published CODEX-G1-REL02-MAIL-LIST-SEARCH-CONTRACT-task.md](references/CODEX-G1-REL02-MAIL-LIST-SEARCH-CONTRACT-task.md) — Original bounded task; no source connection enabled.
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S22

**Remaining capability metadata**

086263abdf1b5c34b502a44d957b5568e837f992; 93 intents, 86 literal/2 partial enum/5 missing schemas; metadata only, root review pending.

- [Published CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA-report.md](references/CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA-report.md) — Pending root review; metadata observations only.
- [Published CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA-task.md](references/CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA-task.md) — Original bounded task; no contract or handler acceptance.
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S23

**R2 qualification records**

Exported PENDING fields are source inventory state, not live gate results.

- [docs/coordination/r2/gates.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/gates.json)
- [docs/coordination/r2/tickets.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/tickets.json)
- [docs/coordination/r2/audit-findings.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/r2/audit-findings.json)
- [docs/RETRIEVAL-AUDIT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/RETRIEVAL-AUDIT.md)

## S24

**Rollback and deployment obligations**

No staging/release/cutover accepted; production restore/rollback remains future work.

- [docs/plans/MERI-DEPLOYMENT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/MERI-DEPLOYMENT.md)
- [docs/qualification/PROXY-TEMPORAL-DECISIONS.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/qualification/PROXY-TEMPORAL-DECISIONS.md)
- [infra/](https://github.com/neo-capiro/meri-greenfield/tree/f2d6c0b8bdb728bcccc8628538e678711b679c1c/infra/)

## S25

**Frontend architecture**

Private neo-capiro/capiro-frontend; clean main 28c300093c0886018c49df8764a8e6fac44819eb.

- [Frontend: docs/ARCHITECTURE.md](https://github.com/neo-capiro/capiro-frontend/blob/28c300093c0886018c49df8764a8e6fac44819eb/docs/ARCHITECTURE.md)
- [Frontend: AGENTS.md](https://github.com/neo-capiro/capiro-frontend/blob/28c300093c0886018c49df8764a8e6fac44819eb/AGENTS.md)
- [Frontend: packages/meri-client/](https://github.com/neo-capiro/capiro-frontend/tree/28c300093c0886018c49df8764a8e6fac44819eb/packages/meri-client/)
- [Frontend: packages/ui/](https://github.com/neo-capiro/capiro-frontend/tree/28c300093c0886018c49df8764a8e6fac44819eb/packages/ui/)
- [Frontend: apps/web/](https://github.com/neo-capiro/capiro-frontend/tree/28c300093c0886018c49df8764a8e6fac44819eb/apps/web/)

## S26

**Home acceptance**

Offline Next build and 8 browser groups pass; 19 assets/25 slots; no live backend acceptance.

- [Frontend: docs/coordination/CODEX-MERI-HOME-FINAL-ACCEPTANCE.md](https://github.com/neo-capiro/capiro-frontend/blob/28c300093c0886018c49df8764a8e6fac44819eb/docs/coordination/CODEX-MERI-HOME-FINAL-ACCEPTANCE.md)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S27

**UI transport and Elements fixture separation**

Backend removed 44 obsolete UI files after verification; preserved transport/Elements checks; full workspace remains pending.

- [docs/coordination/reports/CODEX-FRONTEND-BACKEND-CLEANUP.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-FRONTEND-BACKEND-CLEANUP.md)
- [docs/coordination/reports/CODEX-FRONTEND-CLEANUP-INDEPENDENT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-FRONTEND-CLEANUP-INDEPENDENT.md)
- [docs/coordination/reports/CODEX-FRONTEND-STREAM-PRODUCER.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-FRONTEND-STREAM-PRODUCER.md)
- [Frontend: packages/qualification-transport/](https://github.com/neo-capiro/capiro-frontend/tree/28c300093c0886018c49df8764a8e6fac44819eb/packages/qualification-transport/)
- [Frontend: packages/qualification-elements/](https://github.com/neo-capiro/capiro-frontend/tree/28c300093c0886018c49df8764a8e6fac44819eb/packages/qualification-elements/)

## S28

**Durable state independent and owner acceptance**

38fb296 candidate / 72340be distinct review. Owner accepted bounded local PostgreSQL source/persistence behavior; not live runtime durability.

- [docs/coordination/reports/CODEX-G1-PROXY-DURABLE-STATE-ACCEPTANCE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-PROXY-DURABLE-STATE-ACCEPTANCE.md)
- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S29

**Managed canary historical acceptance**

One task start/stop; STOPPED confirmed within original deadlines. Workload FAILED exit137. Canary2 cleanup UNKNOWN retained.

- [docs/coordination/reports/CODEX-G1-CANARY3-ACCEPTANCE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-CANARY3-ACCEPTANCE.md)

## S30

**Native SDK loopback owner and distinct review**

Synthetic native tool_use/tool_result/end_turn fixture; physical STOPPED exit0. No real provider/discovery/resume proof.

- [docs/coordination/reports/CODEX-G1-SDK-NATIVE-WIRE-OWNER.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-SDK-NATIVE-WIRE-OWNER.md)
- [docs/coordination/reports/CODEX-G1-SDK-NATIVE-WIRE-INDEPENDENT.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/CODEX-G1-SDK-NATIVE-WIRE-INDEPENDENT.md)

## S31

**Accepted offline Temporal design**

d96168bd1a05511533dc0b63e622d0dd56f30526; design/offline only.

- [docs/coordination/reports/W02-03-TEMPORAL-ACCEPTANCE.md](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/coordination/reports/W02-03-TEMPORAL-ACCEPTANCE.md)
- [apps/control/qualification-temporal/component-pins.json](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/apps/control/qualification-temporal/component-pins.json)

## S32

**Handover data audit**

78,821 bytes; SHA256 b89ae6b1a161ba39a352fd9d4d5395e1126bdee10dba4112f4725ad7b2af6d57. 48 evidence pins. Collector pending wording in this audit is superseded by root 2f0e03a acceptance.

- [Published current evidence and review limits](LOCAL-EVIDENCE-STATUS.md)

## S33

**Latest continuation and validation direction**

Latest human direction: multiple bounded Hermes workers, cleanup-session coordination and Codex validation of every delivery and integrated candidate at each phase/workstream end. No Hermes worker was launched by handover publication.

- [Continuation instructions](CONTINUATION-INSTRUCTIONS.md)
- [Current repository rules](../../../AGENTS.md)
- [Recorded human decision](../../coordination/DECISIONS.md)

## S34

**Cleanup coordination inputs**

Verified GitHub plan paths at d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7. Current cleanup execution is on another remote server; locator/owner not verified here. Discover and confirm that live execution before overlaps or release; cleanup is not greenfield acceptance.

- [docs/plans/CleanUp1.md](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp1.md)
- [docs/plans/CleanUp2.md](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp2.md)
- [docs/plans/CleanUp3.md](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp3.md)
- [docs/plans/CleanUp4.md](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp4.md)
- [Cleanup session coordination protocol](CONTINUATION-INSTRUCTIONS.md#continue-coordination-with-the-cleanup-session)

## S35

**Remote code pickup and published checkpoints**

Accepted source 2f0e03a, pending dd98d62 and 086263a, unfinished SDK WIP 4d33640 were pushed and remote refs verified. Seven original SDK paths are byte-preserved. Browser SOURCE5 has no implementation diff. Raw private evidence needs secure recovery; no dormant Hermes sessions.

- [Remote pickup runbook](REMOTE-PICKUP.md)
- [Exact published code checkpoint manifest](REMOTE-CODE-MANIFEST.json)

## Publication provenance

[Copied-document hash and provenance manifest](references/manifest.json). The original candidate code remains outside this documentation change. The handover snapshot precedes these publication commits, which add documentation only.
