"""Read-only PR59 source inventory. Writes only this owned audit directory."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
PIN = '18adda2c5461b8d346277135aafd3972b4768802'
TREE = 'eaec635b6b1c6cdc353ad48a5fda1f7a3dc10b21'
LEDGER = 'docs/qualification/candidates/vertical-source-20261012/integration/requirements-continuation.json'
PLAN = 'docs/plans/MERI-DEPLOYMENT.md'

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], timeout=30)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

# Per-subcriterion categories deliberately overlap at whole-row level. One work
# package can contain finished source, missing code and external qualification.
def criterion(implemented, missing, external, owners, tests, note='', deferred=()):
    return {'implementedButUnqualified': implemented, 'missingImplementation': missing,
            'externalRuntimeDependency': external, 'genuinelyDeferred': list(deferred),
            'canonicalOwnerPaths': owners, 'existingTestPaths': tests,
            'reconciliationNote': note}

C = {}
C['W00'] = criterion(
    ['Discovery scope decisions, 139-row inventory (96 selected/43 deferred), original Figma inventory/shell decision and REL-01 baseline/trace plan accepted as discovery source.'],
    [], ['Later measured REL-01 baseline and source/UI/native activation are separate requirements.'],
    ['docs/coordination/reports/CODEX-G0-DISCOVERY.md','docs/CAPABILITY-SCOPE.md','docs/CAPABILITIES.json','docs/SOURCE-INVENTORY.md','docs/UI-COVERAGE.md','docs/ROUTING-EVALUATION.md'], [],
    'Retain completed-source discovery; no downstream runtime or product promotion.')
C['W01'] = criterion(
    ['Public @capiro/meri-contracts 0.1.2 includes unchanged typed document create/revise/inspect/download and action routes; private retrieval 0.2.15 catalog has 97 closed operation descriptors.',
     'Canonical subject/window/evidence/skill continuity, commands/schedules/artifacts/checkpoints and UI event shapes exist with independent contract controls.',
     'Original Bill Watch 1.0.0 prose/manifest and evidence-linked brief compiler exist for one congressional DOCX output.'],
    ['Full executable manifests/prose/required-source completion for all fourteen selected quick skills; thirteen have no original executable recipe, and Bill Watch remains a bounded output rather than full client federal/state workflow.',
     'Complete fixture/control/state mapping and production descriptions/handlers for selected capabilities.'],
    ['Catalog activation requires qualified current identity/source adapters; all 97 descriptors remain unimplemented/pending/handler:null.',
     'Full semantic UI mapping is owned in the separate frontend repository.'],
    ['packages/contracts/package.json','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/validate.mjs','packages/contracts/retrieval-0.2/skill.schema.json','packages/contracts/document-application/boundary.mjs','docs/SKILL-CONTRACT.md','docs/coordination/r2/skills.json','apps/control/document-application/research-brief/skill.mjs','apps/control/document-application/research-brief/manifest.json','apps/control/document-application/research-brief/SKILL.md'],
    ['packages/contracts/test/retrieval-r2.test.mjs','packages/contracts/test/document-application-public.test.mjs','packages/contracts/test/retrieval-selected-next-independent.test.mjs','apps/control/document-application/independent/research-brief-independent.test.mjs'],
    'Old remaining26 input/result contract allocation is stale; typed descriptor inventory is now97. Shape completeness is not handler or skill completion.')
C['W02'] = criterion(
    ['Pinned worker SDK/model-proxy/native discovery/checkpoint/session/file probes, budget and durable invocation owners, sandbox/browser/Office preparation and Temporal topology source exist.',
     'PR57 host-address projection repair is integrated as reviewed source.'],
    ['Qualified retirement-provider implementation for real worker replacement is still absent from the Temporal recovery owner; generic product runtime wiring is not supplied by fixtures.'],
    ['Supported immutable image, actual proxy native discovery, Fargate/browser/Office/egress admission and complete SDK A/B restore remain native owner gates.',
     'Latest separately reported PR57 native local install/preparation/client-crash pass is limited; live worker observation, identity and activation are blocked.',
     'Native archive/receipt transfer approved by Neo at10:16UTC; producer Library401 blocks delivery. No native packet has been joined by this audit.'],
    ['apps/worker/qualification/Dockerfile','apps/worker/qualification/component-pins.json','apps/worker/qualification/probes/runtime.mjs','apps/worker/qualification/probes/sdk-discovery-tools.mjs','apps/worker/qualification/checkpoint/native-session-files.mjs','apps/proxy/qualification/assembly/lifecycle.py','apps/control/qualification-temporal/recovery-activities.mjs','apps/control/qualification-temporal/recovery-workflow.ts','infra/native-qualification/app.mjs'],
    ['apps/worker/qualification/probes/sdk-discovery-tools.test.mjs','apps/worker/qualification/checkpoint/native-session-files.test.mjs','apps/control/qualified-application/schema-host-address.test.mjs','apps/gateway/test/postgres-budget-host-address.test.mjs'],
    'Earlier33/9/12 native counts are historical parent reports, not source/runtime acceptance here.')
C['W03'] = criterion(
    ['New isolated qualification build/runtime, roleless native task-definition, browser enforcement and checkpoint CDK source exist; existing Aurora decision remains current.'],
    ['Product control/gateway/web services, production persistence/network/secrets and OIDC CI deployment composition/runbooks are not implemented by the qualification stacks; .github is absent at the reviewed tree.'],
    ['G1 admission, actual restricted identities/source connections, selected Aurora configuration, reviewed immutable image/configuration/resource/cost diff and separately authorized deployment.'],
    ['infra/qualification/app.mjs','infra/qualification/checkpoint-app.mjs','infra/qualification/README.md','infra/native-qualification/app.mjs','infra/native-qualification/README.md','infra/browser-enforcement/workflow.mjs','docs/INTEGRATION-BOUNDARY.md','docs/qualification/PROXY-TEMPORAL-DECISIONS.md'],
    ['infra/qualification/security.test.mjs','infra/qualification/checkpoint-security.test.mjs','infra/native-qualification/security.test.mjs'],
    'Preparation-only qualification stacks cannot be counted as the deployed product foundation; historical new-RDS fixture does not override selected Aurora.')
C['W04'] = criterion(
    ['Canonical current capability/run/business/source authority checks and retained mail/memory/action context boundaries exist.',
     'Concrete private action-items, pending memory-proposals, research portfolio evidence and dataset-metadata handlers exist with exact typed projection and refusal tests.',
     'Action lookup persists source result/events and authorizes fresh retained reads; Capiro authority client binds separately published external identity/context endpoint source.'],
    ['Selected-domain exact/search/full decisive source adapters and persistent continuation/coverage/freshness interfaces remain missing beyond those narrow families.',
     'Canonical ordinary memory.read storage/query producer, broad mail body/thread and meeting/client roster handlers are not implemented by retained-page context validators.',
     'Complete two-tenant/within-tenant source/wall/revocation fixtures and real required-source completion joins remain missing.'],
    ['Restricted nonowner source principal/views/current grants, actual authenticated backend identity, storage and source connectivity; stored-context revocation timing must be measured.'],
    ['apps/gateway/authorization/current-tool-authority.mjs','apps/gateway/dispatch/mail-read-context.mjs','apps/gateway/dispatch/memory-read-context.mjs','apps/gateway/dispatch/action-read-context.mjs','apps/gateway/sources/action-items/handler.mjs','apps/gateway/sources/memory-proposals/handler.mjs','apps/gateway/sources/research-portfolio-evidence/handler.mjs','apps/gateway/sources/dataset-metadata/handler.mjs','apps/control/task-lookup/postgres-results.mjs','apps/control/action-host/application-adapters/README.md','apps/gateway/index.mjs'],
    ['apps/gateway/test/action-items-source-independent.test.mjs','apps/gateway/test/research-evidence-independent.test.mjs','apps/gateway/test/memory-context-independent.test.mjs','apps/gateway/test/mail-context-independent.test.mjs','apps/control/task-lookup/test/store-independent.test.mjs'],
    'Old71 unavailable-read description understates typed/source progress; no production handler becomes available from private source tests.')
C['W05'] = criterion(
    ['Persisted admitted-run current-state reader, canonical durable grant/invocation/budget records, action lookup/proposal/command journals and schedule lifecycle source exist.',
     'SDK SessionStore/file/checkpoint and Temporal recovery admission source preserve one writer/fence and original deadlines; typed document completion replay rechecks durable current admission without another effect.'],
    ['General product conversation/run/event/approval lifecycle and globally reserved stream event allocator are not supplied by action-only applications or qualification registry.',
     'Durable restart reconciliation for ambiguous Temporal replacement/retirement and qualified physical task-retirement provider remain absent.'],
    ['Actual SDK A/B SessionStore/workspace restore, Temporal persistence/history/cancel/replacement/current-authority replay and live worker fence admission.'],
    ['apps/gateway/budget/admitted-run-owner.mjs','apps/gateway/budget/tool-invocation-owner.mjs','apps/control/admitted-runs/mount.mjs','apps/control/qualification-sdk-fixture/state/registry.mjs','apps/control/qualification-sdk-fixture/service/checkpoint-store.mjs','apps/worker/qualification/checkpoint/bound-session-store.mjs','apps/control/qualification-temporal/recovery-activities.mjs','apps/control/schedules/schedule-lifecycle.mjs','apps/artifacts/recovery.mjs'],
    ['apps/control/admitted-runs/independent/owner-independent.test.mjs','apps/control/admitted-runs/independent/mount-independent.test.mjs','apps/artifacts/independent/document-replay-independent.test.mjs','apps/control/schedules/test/lifecycle-independent.test.mjs'],
    'Do not describe all durable handlers as missing: actual owners exist, but qualification persistence is not general product run lifecycle.')
C['W06'] = criterion(
    ['Frozen public contracts, browser-safe UI-stream protocol and trusted ordered event projector exist; frontend source/qualification is separately owned.'],
    ['Remaining full Meri screens/controls/state mappings and general live streaming/history/stop/steer/resume/fork/approval/files/evidence/schedule integration remain open in frontend/backend owners.',
     'No full selected-skill transport/resolver/completion integration is established by this repository or one Bill Watch artifact recipe.'],
    ['Separate capiro-frontend exact source/UI evidence, actual same-origin identity/service wiring and accepted W05 services; no apps/web implementation resides in this tree.'],
    ['docs/UI-SPEC.md','docs/UI-COVERAGE.md','packages/ui-stream/README.md','packages/ui-stream/src/protocol.ts','packages/ui-stream/src/producer.ts','packages/contracts/document-application/boundary.mjs','apps/control/document-application/index.mjs','apps/control/action-host/session/http.mjs'],
    ['packages/contracts/test/document-application-public.test.mjs'],
    'Historical frontend nine-repair/18finding notes require its current owner pin; unrelated Portfolio337 rows cannot become Meri completion. No Quicklog UI allocation.')
C['W07'] = criterion(
    ['Actual local typed DOCX/TXT/XLSX/PPTX generation, PDF conversion/Office transform and analysis admission source, immutable library versions/objects and inspect/revise/download owner exist.',
     'Editable workbook full replacement and native retained-base DOCX replacement preserve originals; reviewed N209 cited DOCX facts/proposed language/coverage appendix exists.',
     'Completed Word/Excel delivery replay returns exact immutable retained version under fresh session/resource/durable-grant checks, with no second reservation/generation/write.',
     'Published local synthetic DOCX original/revision4+4pages and rendered pages have separate independent artifact evidence; editable XLSX render/recalc evidence exists.'],
    ['Qualified production object/version/inspection/publication adapters and admitted general-program sandbox execution are not supplied by the local executor.',
     'Public browser product integration and individually governed authenticated action/session/profile/download/upload workflow remain missing beyond qualification probes.'],
    ['Supported runtime/parser/font/Office/browser/egress sandbox admission; real authorized SDK/UI integration and separately qualified native artifact rendering.'],
    ['apps/artifacts/service.mjs','apps/artifacts/postgres-service.mjs','apps/artifacts/local-store.mjs','apps/artifacts/local-replay.mjs','apps/artifacts/local-executor.mjs','apps/artifacts/office-transform.mjs','apps/artifacts/python/office.py','apps/artifacts/presentation.mjs','apps/artifacts/sandbox-analysis.mjs','apps/artifacts/postgres-analysis.mjs','apps/control/document-application/index.mjs','apps/control/document-application/research-brief/compose.mjs','apps/worker/qualification/probes/browser.mjs'],
    ['apps/artifacts/independent/document-replay-independent.test.mjs','apps/artifacts/test/artifact-service-independent.test.mjs','apps/artifacts/test/workbook-columns-independent.test.mjs','apps/artifacts/test/test_word_revision.py','apps/control/document-application/independent/research-brief-independent.test.mjs','apps/control/document-application/independent/workbook-independent.test.mjs'],
    'Old scaffold/all native formats missing claim is stale. Real local bytes and visual acceptance are bounded artifact evidence, not native production/runtime gate.')
C['W08'] = criterion(
    ['Immutable task-create/update, memory proposal and artifact-filing contracts; canonical approval metadata persistence; fixed-route guarded HTTP source and durable command journal/budget composition exist.',
     'Source replay retains outcome uncertainty and refuses duplicate source dispatch; action followthrough draft→immutable pending proposal stays separate from explicit approval/execution.'],
    ['Personal-memory pending-only producer is absent; current legacy source auto-commits personal memory, so owner returns PENDING_PRODUCER_UNAVAILABLE with no fallback.',
     'Product approval decision/expiry/current-rights brokers, attachment version/bytes/destination identity and general governed filing integration remain to implement/qualify.'],
    ['Actual restricted source credentials, real transaction/concurrency/crash/source effects, current backend approval/right/expiry/revocation and canonical ordinary-task policy qualification.'],
    ['apps/control/commands/executor.mjs','apps/control/commands/durable-executor.mjs','apps/control/commands/postgres-command-journal.mjs','apps/control/commands/source-http.mjs','apps/control/commands/source-projection.mjs','apps/control/commands/approval-metadata/owner.mjs','apps/control/commands/approval-metadata/postgres-store.mjs','apps/control/action-followthrough/index.mjs','apps/control/commands/README.md'],
    ['apps/control/test/commands-durable-budget.test.mjs','apps/control/test/commands-execution.test.mjs','apps/control/test/commands-artifact-compatibility.test.mjs','apps/control/commands/approval-metadata/owner-independent.test.mjs'],
    'Old implement execution adapters note is partly stale: concrete executor/journal/HTTP/budget exist. Administrator review exception remains unchanged.')
C['W09'] = criterion(
    ['Independent source/adversarial reviews and exact raw failure/repair evidence; local application HTTP tests and independent document/workbook native-byte/render evidence; benchmark protocol exists.'],
    ['Frozen labelled real-request corpus/splits/oracles, complete original60task/100isolation/coreRG suites and full UI/browser/recovery/load qualification case execution/evidence remain missing.',
     'Release-grade retention/deletion/rollback/restore/history-compatibility acceptance evidence not supplied by source unit tests.'],
    ['Approved75 real-request source and qualified baseline; supported SDK/browser/Office/native environment; separately owned frontend and protected native receipts.',
     'Producer Library401 currently blocks approved native archive/receipt transfer.'],
    ['docs/ROUTING-EVALUATION.md','evals/retrieval-r2/manifest.json','docs/plans/MERI-DEPLOYMENT.md','docs/qualification/candidates/document-replay-20261013/integration/final-integrated-acceptance.json','docs/qualification/candidates/document-replay-20261013/source-review/recheck-source-audit.json','docs/qualification/candidates/n209-research-brief-20261013/source-review/n209-acceptance-report.md'],
    ['apps/artifacts/independent/document-replay-independent.test.mjs','apps/control/document-application/independent/research-brief-independent.test.mjs','apps/control/action-host/session/owner-independent.test.mjs'],
    'No new test run in this read-only source audit; referenced existing receipts keep their own pins and counts. Synthetic requests cannot fill75real minimum.')
C['W10'] = criterion(
    ['Recoverable reviewed feature publications, exact source/production blob audits, candidate receipt boundaries and gated deployment sequence exist.'],
    ['Final source-to-image/configuration/migration/Temporal/manifest/corpus matrix and full rollback/retention/restore release qualification remain to assemble after accepted dependencies.'],
    ['W03–W09/G2–G5 acceptance, admitted immutable image and exact configuration, separately authorized staging deployment and complete release evidence.'],
    ['docs/plans/MERI-DEPLOYMENT.md','docs/qualification/candidates/document-replay-20261013/integration/final-integrated-acceptance.json','infra/qualification/host-assets.buildspec.json'], [],
    'Open draft PR/source publication is not staging. No active-build success or deployed product candidate inferred.')
C['W11'] = criterion(
    ['Original named internal/tenant allowlist, independent feature gates, rollback and observation criteria remain in the plan.'],
    ['Executable finite rollout/kill-switch/rollback owner packet and measured quality/latency/cost/error observations remain to prepare against the accepted candidate.'],
    ['W10/G6 acceptance then explicit owner release authorization for exact immutable candidate; production merge/deploy remains outside current authority.'],
    ['docs/plans/MERI-DEPLOYMENT.md','docs/CAPABILITY-SCOPE.md'], [],
    'Required release remains open, not genuinely deferred; no blanket canary authorization inferred.')
C['G0'] = criterion(
    C['W00']['implementedButUnqualified'], [], [], C['W00']['canonicalOwnerPaths'], [],
    'Accepted documentary discovery only; preserve completed-source status. No runtime/source-access authority follows.')
C['G1'] = criterion(
    ['Exact SDK/runtime/browser/Office/proxy/Temporal component and contract pins, native preparation and current budget/fence/checkpoint source exist.'],
    ['Measured cohort budget freeze and qualified physical retirement/recovery provider still not present as accepted runtime implementation.'],
    C['W02']['externalRuntimeDependency'] + ['Temporal TLS/authentication/persistence/backup/minor-upgrade design must be exercised on actual admitted topology; compile/stub tests are insufficient.'],
    C['W02']['canonicalOwnerPaths'] + ['apps/control/qualification-temporal/component-pins.json','docs/qualification/PROXY-TEMPORAL-DECISIONS.md','packages/contracts/retrieval-0.2/catalog.json'],
    C['W02']['existingTestPaths'], 'G1 stays OPEN; laterG2–G7 gates remain UNENTERED.')
C['G2'] = criterion(
    ['Isolated qualification CDK definitions, source-disabled gateway/mount and synthetic identity/policy/current-run/admission controls exist.'],
    C['W03']['missingImplementation'] + ['Product conversation ownership plus actual restricted IAM/current membership/wall fixture wiring is not implemented by synthetic local identity.'],
    ['G1 acceptance; actual reviewed isolated development deployment with source connections disabled and current identity/encryption/network permissions verified.'],
    C['W03']['canonicalOwnerPaths'] + ['apps/gateway/index.mjs','apps/control/admitted-runs/mount.mjs','apps/control/qualified-application/application.mjs'],
    ['apps/control/admitted-runs/independent/mount-independent.test.mjs','apps/control/qualified-application/independent/lifecycle-independent.test.mjs'],
    'Native local engine prep/client-crash qualification does not admit a live worker or deploy product foundation.')
C['G3'] = criterion(
    C['W04']['implementedButUnqualified'] + ['DOCX/replay source checks reject revoked session/source/resource and durable grant; original legislation/FY/stage/version context is preserved.'],
    C['W04']['missingImplementation'],
    C['W04']['externalRuntimeDependency'] + ['Agree numeric revocation propagation bound before gate (target<=30seconds); actual all-source tenant/within-tenant/stored-context revocation checks remain unrun.'],
    C['W04']['canonicalOwnerPaths'] + ['apps/control/document-application/research-brief/input.mjs','apps/artifacts/recovery.mjs'],
    C['W04']['existingTestPaths'] + ['apps/artifacts/independent/document-replay-independent.test.mjs'],
    'Source refusal controls do not prove a measured numeric propagation deadline across live stored context.')
C['G4'] = criterion(
    C['W05']['implementedButUnqualified'] + C['W07']['implementedButUnqualified'],
    ['Full selected skill invocation/resolution/evidence completion, general run/UI controls, official browser product integration, recovery reconciliation and qualified retirement provider remain missing.'],
    ['Actual proxy SDK discovery/reconnect/full reads and SDK+file worker-loss restore, approval wait, cancellation/fencing; real frontend/native artifact/browser walkthroughs under current source/identity admission.'],
    C['W05']['canonicalOwnerPaths'] + C['W07']['canonicalOwnerPaths'] + ['packages/ui-stream/src/producer.ts'],
    C['W05']['existingTestPaths'] + C['W07']['existingTestPaths'],
    'Local replay/no-second-effects is a completed source subcriterion; no full execution workspace acceptance.')
C['G5'] = criterion(
    C['W08']['implementedButUnqualified'], C['W08']['missingImplementation'],
    C['W08']['externalRuntimeDependency'] + ['G3/W05 dependencies and separately authorized selected-source command fixtures; durable no-duplicate proof under actual DB/HTTP/approval revocation.'],
    C['W08']['canonicalOwnerPaths'], C['W08']['existingTestPaths'],
    'No automatic source mutation, retry/refund or qualified approval follows from immutable command DTO/fixture controls.')
C['G6'] = criterion(
    ['Reviewed source publications plus bounded contract/application/artifact regression and visual evidence exist for independent subcriteria.'],
    C['W09']['missingImplementation'] + C['W10']['missingImplementation'],
    ['All original/coreRG/UI/native/recovery/retention/restore/history acceptance must target one exact immutable staged candidate afterG2–G5; optionalRG10/11 only when promoted.'],
    C['W09']['canonicalOwnerPaths'] + ['docs/UI-COVERAGE.md'], C['W09']['existingTestPaths'],
    'Optional Decisions/JEV remain disabled by accepted scope, not a reason to defer core gates.',
    ['Only optional Decisions/JEV adoption and their conditionalRG10/RG11 obligations remain disabled/unpromoted; the coreG6 criterion is mandatory.'])
C['G7'] = criterion(
    C['W11']['implementedButUnqualified'], C['W11']['missingImplementation'],
    C['W11']['externalRuntimeDependency'], C['W11']['canonicalOwnerPaths'], [],
    'Internal→boundedtenant release remains required afterG6; no genuine whole-gate deferral.')

git('merge-base', '--is-ancestor', PIN, 'HEAD')
assert git('rev-parse', PIN + '^{tree}').decode().strip() == TREE
ledger_raw = (ROOT / LEDGER).read_bytes()
ledger = json.loads(ledger_raw)
plan_raw = (ROOT / PLAN).read_bytes()
plan_lines = plan_raw.decode().splitlines()
rows = []
checks = []
all_paths = {LEDGER, PLAN, 'AGENTS.md', 'docs/IMPLEMENTATION-STANDARDS.md'}
for previous in ledger['records']:
    name = previous['id']
    if name not in C:
        continue
    g = previous['governingRequirement']
    line = g['originalLocator']['line']
    actual = plan_lines[line - 1]
    matches = actual == g['originalRequirement']
    checks.append({'name': name + ': copied row equals actual plan row/line', 'pass': matches})
    assert matches
    actual_sha = sha(actual.encode())
    item = {'id': name, 'status': g['status'], 'governingRequirement': g,
            'currentPlanLocator': {'commit': PIN, 'path': PLAN, 'line': line,
                'planSha256': sha(plan_raw), 'rowSha256': actual_sha,
                'rowHashEncoding': 'UTF-8 exact row without line terminator',
                'copiedRequirementEqualsCurrentRow': matches},
            'legacyOriginalRecordHash': {'value': g['originalRecordSha256'],
                'verification': 'UNVERIFIED_HISTORICAL_RECORD_HASH',
                'reason': 'Original cbbd source object/path and serialization scheme unavailable locally; not a raw current row hash.'},
            'qualifiedRuntime': False, 'wholeCriterionPromotion': False,
            'wholeStatusChange': False, **C[name]}
    item['dominantOpenDisposition'] = ('accepted-discovery-source' if name in ['W00','G0'] else
        'missing-implementation' if item['missingImplementation'] else 'external-runtime-dependency')
    item['bucketSemantics'] = 'Subcriterion buckets overlap per original whole requirement; an implemented source component is not a whole-criterion acceptance.'
    item['completedSubcriteria'] = [{'description': s,
        'acceptance': 'ACCEPT_DISCOVERY_SOURCE' if name in ['W00','G0'] else 'BOUNDED_IMPLEMENTED_SOURCE_ONLY',
        'closesWholeCriterion':False} for s in item['implementedButUnqualified']]
    rows.append(item)
    all_paths.update(item['canonicalOwnerPaths'])
    all_paths.update(item['existingTestPaths'])
assert len(rows) == 20
bindings = []
for path in sorted(all_paths):
    local = ROOT / path
    if not local.is_file():
        raise ValueError('Missing referenced audit path: ' + path)
    raw = local.read_bytes()
    exact = raw == git('show', PIN + ':' + path)
    checks.append({'name': path + ': reviewed source bytes equal PR59', 'pass': exact})
    assert exact
    bindings.append({'path': path, 'commit': PIN, 'blob': git('rev-parse', PIN + ':' + path).decode().strip(),
                     'bytes': len(raw), 'sha256': sha(raw)})
catalog = json.loads((ROOT / 'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
counts = {'descriptors': len(catalog['operations']),
          'unimplemented': sum(r['availability'] == 'unimplemented' for r in catalog['operations']),
          'qualificationPending': sum(r['qualification'] == 'pending' for r in catalog['operations']),
          'nullHandlers': sum(r['handler'] is None for r in catalog['operations'])}
assert counts == {'descriptors':97, 'unimplemented':97, 'qualificationPending':97, 'nullHandlers':97}
checks.append({'name': 'Production catalog97 descriptors remain unavailable/pending/null handlers', 'pass':True})
check_paths = {'apps/web': (ROOT/'apps/web').exists(), 'packages/skills':(ROOT/'packages/skills').exists(), '.github':(ROOT/'.github').exists()}
assert not any(check_paths.values())
checks.append({'name': 'No local apps/web, packages/skills or .github OIDC/product owner at PR59', 'pass':True})
old = subprocess.run(['git','-C',str(ROOT),'cat-file','-e',ledger['governingSource']['commit']],capture_output=True,timeout=30)
old_path = (ROOT / ledger['governingSource']['path']).exists()
assert old.returncode != 0 and not old_path
write('source-bindings.json', {'sourceCommit':PIN,'sourceTree':TREE,'bindings':bindings})
write('requirements-audit.json', {
    'schema':'meri-whole-plan-source-audit/1', 'reviewer':'independent source reviewer',
    'sourceCommit':PIN,'sourceTree':TREE,'scope':['W00-W11','G0-G7'],
    'originalWholeLedger':{'path':LEDGER,'sha256':sha(ledger_raw),'governingSource':ledger['governingSource'],
        'originalSourceObjectAvailable':False,'originalSourcePathAvailable':False,
        'oldObjectCheckExitCode':old.returncode,'inheritedRecordCount':len(ledger['records']),
        'auditedRecordsOnly':20},
    'currentPlan':{'path':PLAN,'sha256':sha(plan_raw),'commit':PIN,'copiedRowsMatched':20},
    'inheritedGlobalCounts':ledger['counts'],
    'auditCounts':{'records':20,'acceptedDiscoverySource':2,'wholePending':18,'newWholeClosures':0,
        'runtimeQualifiedByAudit':0,'wholeGenuinelyDeferred':0},
    'catalog':{'version':catalog['catalogVersion'],**counts},
    'gateState':ledger['gateState'],
    'authorityAndNativeCorrection':{
        'archiveReceiptTransfer':'Neo approved native archive/receipt transfer at10:16UTC; producer Library401 remains a technical delivery blocker.',
        'otherUploads':'No authorization for any other private source/artifact uploads inferred.',
        'privateSourceAttachment':'Separate explicit private source attachment approval remains pending.',
        'nativeLatest':'Parent-reported PR57 local installation/preparation/client-crash passed only; live-worker/identity/activation blocked.',
        'nativeReceiptJoined':False,'privatePacketRead':False},
    'records':rows,
    'criticalPath':[
        'PreserveW00/G0 discovery and frozenW01 contracts; finish unblocked skill/adapter/general lifecycle source whileG1native admission is blocked.',
        'G1: exact supported SDK/proxy/browser/Office/Temporal image/task and native worker/identity/activation admission; approve/receive exact bounded native evidence through supported transfer.',
        'W03/G2: complete product foundation/OIDC/current restricted identity/network/storage composition, then separately authorized isolated deployment with sources off.',
        'W04/G3: all selected exact/search/decisive reads and memory, current two-tenant/client-wall/stored-context revocation and numeric bound.',
        'W05-W08/G4-G5: general durable SDK/UI/skill/browser/artifact execution, actual worker-loss/cancel/approval/schedule recovery and selected-command zero duplicate/current-rights evidence.',
        'W09-W10/G6: frozen75real-request/200case coreRG and original full suites plus UI/artifact/recovery/load/retention/rollback/restore against one exact staging candidate.',
        'W11/G7: explicit exact-candidate release approval, finite internal/tenant allowlist and measured observations/rollback.'],
    'topUnblockedMissingImplementation':{
        'candidate':'General conversation/run/event lifecycle, explicitly prioritized by Neo through root during this audit',
        'rationale':'Action-only applications and qualification admission are implemented; durable product conversation/run ownership and globally reserved ordered event publication remain missing. Implement the canonical lifecycle source with independent synthetic persistence ports while native admission proceeds under its separate owner.',
        'requiredBehavior':['Reuse public Conversation/RunBinding/event/checkpoint contracts; bind actor/tenant/conversation/current run/fence server-side, preserve immutable original deadlines and selected skill pins.',
            'Give product conversation/run/event persistence one canonical owner and atomic sequence/ownership/current-fence guards; no general service monolith or parallel orchestrator.',
            'Produce authoritative status/events and bounded reconnect/history under current authorization; distinguish subscription completion from run completion.',
            'Preserve Claude Agent SDK sole model loop, Temporal durability and existing approval/budget/source/artifact owners; no cloud/source activation or native-runtime acceptance inferred.'],
        'dependencies':['packages/contracts/meri.schema.json','packages/ui-stream/src/producer.ts','apps/gateway/budget/admitted-run-owner.mjs','apps/control/task-lookup/index.mjs','apps/control/qualification-temporal/recovery-workflow.ts'],
        'parallelSourceWork':'Original selected skill manifests/completion and selected-domain read adapters can proceed after explicit nonoverlapping path allocations; commitments_audit is a further concrete product slice.',
        'remainingAfterBoundedSource':'Actual SDK/Temporal workers, current authenticated identity/policy, real product database concurrency/crash/history, frontend integration and wholeG4/release acceptance remain open.'},
    'auditOutcome':'ACCEPT_BOUNDED_SOURCE_RECONCILIATION',
    'limits':['This audit verifies20original plan rows and current source ownership; it does not independently audit the other33whole records.',
        'No product executable tests rerun in this audit. Existing test files and receipts are source evidence with their original pins, not new runtime acceptance.',
        'No DB/native/private packet/provider/credentials/model/cloud/production work or external transfer/publication performed.',
        'Inherited whole ledger retains53requirements:2discovery-source completions and51pending. No new whole acceptance or genuine core deferral.']})
write('verification.json', {'sourceCommit':PIN,'sourceTree':TREE,'checks':checks,
    'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),
    'commands':[{'argv':['git','cat-file','-e',ledger['governingSource']['commit']],
        'exitCode':old.returncode,'stdout':old.stdout.decode(),'stderr':old.stderr.decode(),
        'expected':'unavailable original object; no fetch attempted'}],
    'referencedPathCount':len(bindings),'runtimeQualified':False})
print(json.dumps({'sourceCommit':PIN,'records':len(rows),'referencedPaths':len(bindings),
    'checksPassed':sum(c['pass'] for c in checks),'productTestsRerun':0,'newWholeClosures':0}))
