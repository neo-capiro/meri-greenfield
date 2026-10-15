# Meri security and release audit

Reviewed 15 October 2026, 18:37–18:48 UTC. **Release verdict: HOLD.**

This is a read-only source/integration audit, not a penetration test or deployment attestation. The shared source contains substantial fail-closed primitives, but it is not a sealed, integrated, qualified product release. Browser capability must be composed ON by default for the intended release; destination policy and consequential-action controls remain separate gates. Keeping browser off is not completion.

## Exact source scope

| Ref | Observed SHA | Relationship to reviewed base |
|---|---|---|
| Shared reviewed base | ba40647c5b6f1f81773869e41ce82c099d64d505 | Main source reviewed here |
| main | 8b123bea4c90794dc2d766814b6ddbdbfe0928bc | Behind base; not an integrated release |
| fable/meri-complete-20261015 | f0befe1e486cfda644f1f6170cf3d9d671e5158f | 9 commits behind base |
| fable/meri-resume-20261015 | b5be44d5141ae5fd3830aed789cb7ad525506c4e | 23 commits behind base |
| p1a candidate | 6d9bb391005f73c8be6ec636c346a05381b5bd98 | 5 commits ahead of base |
| p1b candidate | 06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40 | 4 commits ahead of base |
| p1c candidate | e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4 | 5 commits ahead of base |

The three p1 candidates are separate descendants, not one integrated candidate. Their existing HOLD reviews are not replaced by this report. This audit inspected selected exact-pinned files through GitHub and materialized 79 source/doc files, not a complete checkout. Selected probe-critical files were verified against their Git blob IDs. The separate master crosswalk is pinned at [9a41cfe](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/coordination/master-crosswalk-20261015/README.md). Its accepted G0 does not imply G1–G7 acceptance. The deployment target remains [MERI-DEPLOYMENT.md](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/plans/MERI-DEPLOYMENT.md).

## Findings

### SEC-REL-01 — P1: retained proxy ingress rejects the observed pinned CLI request

[ingress.py:60–66](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/runtime/ingress.py#L60-L66) requires an empty query string for POST /v1/messages. The candidate's [real CLI probe receipt:6–13](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/qualification/candidates/fable-resume-20261015/rehearsal/standin-probes-20261015.json#L6-L13) records CLI 2.1.295 sending POST /v1/messages?beta=true twice. The stand-in routing was corrected; the retained inference ingress still refuses this wire form. The [completion report:92–94](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-COMPLETION-RETURN-20261015.md#L92-L94) distinguishes that corrected stand-in control from an actual CLI success.

Independent local probe on the exact ingress Git blob:
- Empty query: ACCEPT.
- beta=true: REFUSE INFERENCE_ROUTE_REQUIRED.
- Only validate_scope executed with synthetic valid typed grant/peer objects. No DB, provider, TLS, server or AWS calls occurred.

Impact: composing the retained proxy as-is blocks the observed pinned client's inference call. This is not a claim that a live deployed product proxy was tested.

Minimum fix: define and test the closed supported query/header contract, including the pinned CLI's beta request. Keep arbitrary routes/query parameters refused. Run one real CLI → actual proxy → provider flow, including stream termination/cancel and the next turn; do not substitute the permissive stand-in.

### SEC-REL-02 — P1: product budget, proxy admission and per-run model credentials are not composed

The product allocation owner [requires the product namespace:12–16,29–32](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/gateway/budget/native-allocation-admission.mjs#L12-L32); its grant activation is in the product schema. Prepared-candidate readiness [reads meri_product_budget:55](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-candidate.mjs#L55). The retained proxy's [grant checks:19–34](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/state/admission.py#L19-L34), [grant storage:51–85](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/state/grants.py#L51-L85) and [ledger:64–117](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/state/ledger.py#L64-L117) hard-code meri_qualification.

Additionally, [prepared-run-bindings.mjs:35–41](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-run-bindings.mjs#L35-L41) issues fresh task grants but assigns the same configured secrets.proxy to every retargeted run. That is not evidence of a fresh task/run-scoped model-proxy grant. The proxy expects exact grant/peer binding and capability-hash matching ([ingress.py:51–56,91–96](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/runtime/ingress.py#L51-L96)). Its own [server:1,161–163](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/proxy/qualification/runtime/server.py#L161-L163) says TLS/LiteLLM/ECS composition is not supplied.

Impact: no inspected executable composition proves provider requests consume the canonical product liability budget or use the current run's independently revocable model capability. This is an integration blocker, not a demonstrated current overspend/auth bypass.

Minimum fix: one trusted product proxy composition using the canonical product grant/budget owners, actual peer/task identity, short-lived per-run model credentials and revocation. Prove combined model/tool reservations and UNKNOWN holds across retry, timeout, cancel and parallel runs. Do not introduce a second authoritative budget.

### SEC-REL-03 — P1: ECS readiness proof does not establish the claimed isolation profile

The [ECS proof explicitly distinguishes a declaration from runtime measurement:1–3](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/ecs-prepared-task-proof.mjs#L1-L3). Its [acceptance checks:19–29](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/ecs-prepared-task-proof.mjs#L19-L29) bind exact task/image and runner hash declaration, Fargate/awsvpc and a single container. They do not check absence of a task role, non-root user, read-only root, dropped capabilities/init, mounts, other secrets/environment, or actual network destinations.

The [allocator:12–16](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/task-allocator.mjs#L12-L16) refuses public IPs and validates subnet/security-group identifiers, but [line 35](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/task-allocator.mjs#L35) only checks the attached subnet. Security-group rules, routing, DNS and credential/metadata access are not proven by that readback.

Existing native qualification IaC includes useful isolation settings, but its [app:1–21](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/infra/native-qualification/app.mjs#L1-L21) is a probe-only definition, not a deployed control/Temporal/product stack. The [deployment handoff:7–15](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/CODEX-PREPARED-CANDIDATE-DEPLOYMENT-20261014.md#L7-L15) itself says existing task definitions cannot be relabelled as this candidate and actual runner/executable measurement is absent.

Impact: image identity/readiness must not be promoted into proof of credential isolation or network confinement. This is a missing release attestation and trusted-profile enforcement; no deployed permissive task was observed.

Minimum fix: bind one reviewed immutable product task definition and network/IAM profile, check its security-critical fields, and attach actual native measurements plus adversarial egress/metadata/credential/descendant-cleanup receipts. Reuse already-approved dedicated resources only after checking suitability.

### SEC-REL-04 — P1: no current sealed image, source closure or exact-digest security acceptance

The [image producer:4–13](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/scripts/qualification/assembled-image/meri_image_build.py#L4-L13) retains a historical SOURCE, QUALIFICATION_SOURCE=None and CODE=None. Its [validation:64–70](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/scripts/qualification/assembled-image/meri_image_build.py#L64-L70) intentionally refuses stale/unsealed input. That safeguard is correct, but it means no current release image can be derived from this packet as-is.

The candidate [completion report:90](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-COMPLETION-RETURN-20261015.md#L90) states there are no image digest/deployment receipts. Earlier scan findings in the [W03 draft:7](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-W03-BINDINGS-PACKET-DRAFT-20261014.md#L7) concern an earlier image; they are not a fresh scan of ba40647. No new vulnerability scan was performed in this audit.

Positive controls: [Dockerfile:1–25](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/Dockerfile#L1-L25) requires an explicit base, uses lockfiles/ignore-scripts, materializes SWC with network none and sets USER node. The producer tests imports/native measurements/Temporal bundling under non-root read-only restrictions and [checks scan counts against exact digest:113–116](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/scripts/qualification/assembled-image/meri_image_build.py#L113-L116). Those are limited image controls, not full conversation/recovery or product gates.

Minimum fix: freeze one accepted integrated source tree and close manifests against it; build a fresh approved immutable base and exact runtime image; retain source/probe/compiler/lockfile provenance and SBOM plus OS/language scan evidence. Enforce the stated zero HIGH/CRITICAL rule on that digest. Do not reuse host wheels, historical image receipts or source-only probes as native release acceptance.

### SEC-REL-05 — P1: deployment and migration handoff is incomplete for current source

The [small first-conversation handoff:17](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/CODEX-PREPARED-CANDIDATE-DEPLOYMENT-20261014.md#L17) names conversations migrations 0001–0008 and product budget 0001. The [W03 draft:18](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-W03-BINDINGS-PACKET-DRAFT-20261014.md#L18) adds artifacts 0001 only. At ba40647, directory listings contain:
- Conversations 0001–0011, including 0009_next_runs, 0010_retention and 0011_run_issuance.
- Artifacts 0001_versions and 0002_retention.
- Schedules 0001_schedule_owner.
- Product budget 0001_product_budget.

Current startup [control.mjs:37–41](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L37-L41) requires retention projections/barrier when selected, [69–74](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L69-L74) composes issuance store 0011, and [prepared-candidate.mjs:55](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-candidate.mjs#L55) requires next-run/completion tables for multi-run. The file-backed capability authority also needs durable owner-only storage; the [completion report:98](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-COMPLETION-RETURN-20261015.md#L98) acknowledges material loss fails closed and production reconciliation has no running owner.

The [handoff:9](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/CODEX-PREPARED-CANDIDATE-DEPLOYMENT-20261014.md#L9) lists missing DB/Temporal/proxy/authority/TLS/image/task/network bindings. Existing infra roots are qualification/enforcement fixtures; no inspected product deployment closes these inputs.

Minimum fix: one current deploy manifest keyed to the integrated SHA, with exact migration inventory/order and restore/rollback prerequisites, durable material/evidence locations, TLS/authority/proxy/Temporal/task bindings, startup owners and readiness checks. The historical first-prompt handoff is not the complete intended release. Browser default-on and artifact/tool/schedule composition cannot be waived by using that narrow handoff.

### SEC-REL-06 — P2 release-control gap: no integrated CI acceptance or production observability evidence

At the reviewed base, the root tree has no .github directory. GitHub returned no workflow runs and no combined statuses for ba40647; no workflow runs were returned for the three p1 candidate SHAs. This does not prove branch-protection settings or the absence of external CI. [Root package.json](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/package.json) runs a narrow contracts/Hermes check, not a single integrated product gate.

The [completion report:62–64](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-COMPLETION-RETURN-20261015.md#L62-L64) retains partial/failing local results, missing-isolation-attestation skips/refusals and contract drift. They are historical reported receipts, not independently rerun current green results. [Gate table:70–90](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-COMPLETION-RETURN-20261015.md#L70-L90) leaves live UI, durability, authority, browser/artifacts, held-out and deployment gates unrun. The [W03 packet](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/coordination/reports/FABLE-W03-BINDINGS-PACKET-DRAFT-20261014.md) has unbound CI OIDC/log retention; the historical image script's manual caller check is not an OIDC release pipeline.

The p1b observability candidate is separate and remains HOLD under its existing review. No live alert, cost-correlation, recovery or cancellation receipt was established here.

Minimum fix: one CI/release job for exact source validation, all required suites, contract/migration drift, image provenance/security and explicit manual live-gate receipt attachment. Bind redacted tenant/run/attempt correlation, model/tool liabilities, UNKNOWN holds, physical cancellation/recovery and actionable alerts to the same candidate. A new monitoring framework is unnecessary.

## Done / unrun / blocked

| Work | Status | Evidence limit |
|---|---|---|
| Current ref pinning and base comparisons | DONE | Snapshot around 18:37 UTC; branches may move afterward |
| Deployment plan, crosswalk, selected IaC/runtime/proxy/issuer/budget/build/CI sources | DONE | Selected exact-pinned source, not full checkout |
| Proxy query mismatch local reproduction | DONE | Exact ingress Git blob; synthetic scope-validation only |
| GitHub workflows/status inspection | DONE | Returned no runs/statuses; branch protection/external CI not inferred |
| Full unit/typecheck/contract/migration suite | UNRUN here | Partial tree, no installed full dependency/database environment; historical results preserved |
| Actual DB migrations and restart/restore | UNRUN | No live approved binding or migration execution |
| Current image build/SBOM/security scan/native measurements | UNRUN | Unsealed packet and no exact current image |
| ECS/IAM/security-group/DNS/metadata/egress verification | UNRUN | No AWS/cloud requests or changes made |
| Real SDK/CLI → product proxy → provider, multi-turn/cancel/recovery | UNRUN | Actual product composition/bindings absent; no paid/provider call |
| TLS/CA stand-in rerun | BLOCKED historical receipt | Prior permission denial is recorded by source; this audit did not retry, alter trust, or request exception |
| Integrated browser default-on product qualification | UNRUN/HOLD | Default-on is required; p1c remains separate HOLD |
| Live two-tenant authorization, adversarial leak and held-out performance/cost gates | UNRUN | Cannot be replaced by fixtures/source-only acceptance |
| Changes/deployments/credentials/network policies/user computer | NOT PERFORMED | Read-only audit scope |

No new authorization denial occurred during this audit.

## Minimum release path

1. Integrate only reviewed fixes into one pinned candidate, preserving the p1 HOLD findings until fixed. Resolve the real proxy wire mismatch and product budget/model-grant composition.
2. Produce one exact deployment/migration/binding manifest and one task isolation profile; compose production owners, including browser ON with separately enforced destination and consequential-action policies.
3. Seal source and build one immutable, measured, scanned image with complete evidence. Make current source tests and drift checks green on that same candidate.
4. Use an explicitly approved bounded isolated live run to qualify actual identity/tenant scope, first and second turns, provider budget, cancellation, crash/recovery and original physical cleanup.
5. Complete the crosswalk's real adversarial, held-out, concurrency, artifact/browser and operational gates; attach failures as well as successes. Release only after the required gates pass. Do not infer release acceptance from source acceptance.

Reproduction artifacts accompanying this report: proxy-route-probe.py and proxy-route-probe-result.json.

