"""Exact source pins for a read-only prerequisite audit, never live qualification."""
import hashlib,json,pathlib,subprocess,os
HERE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(os.environ.get('MERI_REVIEW_SOURCE_ROOT',HERE.parents[4])).resolve()
BASE='66818b539b9910d9081fb19b2713b5713daefc81'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(raw):return hashlib.sha256(raw).hexdigest()
paths=[
 'AGENTS.md','docs/IMPLEMENTATION-STANDARDS.md','docs/coordination/tasks/CODEX-ORIGINAL-RUNTIME-20261013.md',
 'packages/skills/assets.json','packages/skills/index.mjs','packages/contracts/retrieval-0.2/catalog.json',
 'packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/validate.mjs',
 'apps/gateway/catalog/runtime-catalog.mjs','apps/gateway/index.mjs','apps/control/conversations/service.mjs',
 'apps/worker/conversation/activity.mjs','apps/worker/conversation/options.mjs',
 'apps/gateway/authorization/current-tool-authority.mjs','apps/gateway/budget/admitted-run-owner.mjs',
 'apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/budget/tool-budget-binding.mjs',
 'apps/gateway/budget/tool-invocation-owner.mjs','apps/gateway/budget/tool-invocation-record.mjs',
 'apps/gateway/budget/tool-budget-execution.mjs','apps/control/tool-invocations.mjs',
 'apps/control/admitted-runs/mount-core.mjs','apps/control/qualified-application/mount.mjs',
 'packages/skills/evidence/typed-reads.mjs','packages/skills/evidence/material-records.mjs',
 'apps/control/document-application/commitments-audit/source.mjs','apps/control/document-application/commitments-audit/compose.mjs',
 'apps/control/document-application/relationship-brief/reads.mjs','apps/control/document-application/relationship-brief/collect.mjs',
 'apps/control/document-application/relationship-brief/compose.mjs','packages/contracts/package.json',
 'packages/contracts/dist/conversation-application.mjs','apps/control/conversations/http.mjs','apps/control/conversations/events.mjs',
]
assets=json.loads((ROOT/'packages/skills/assets.json').read_text())
for asset in assets['assets']:
 for key in ['manifestPath','prosePath']:
  paths.append(str((ROOT/'packages/skills'/asset[key]).resolve().relative_to(ROOT)))
records=[]
for path in dict.fromkeys(paths):
 current=(ROOT/path).read_bytes();original=git('show',BASE+':'+path)
 records.append({'path':path,'bytes':len(current),'sha256':sha(current),'exactBase':current==original})
changes=git('diff','--name-only',BASE,'--','apps','packages','infra','qualification').decode().splitlines()
record={'decision':'BASE_AUDIT_COMPLETE_IMPLEMENTATION_PENDING','reviewedCommit':BASE,'reviewedTree':git('rev-parse',BASE+'^{tree}').decode().strip(),
 'allPinnedPathsExact':all(r['exactBase'] for r in records),'pinnedPaths':records,'productionChangesFromBase':changes,
 'originalAssetCount':len(assets['assets']),'immutableCatalogSha256':assets['catalogSha256'],
 'publicPackageVersion':json.loads((ROOT/'packages/contracts/package.json').read_text())['version'],
 'nativeDbCalls':0,'modelCalls':0,'networkCalls':0,'sourceActivation':False,'productEdits':False,
 'limits':['No candidate implementation reviewed yet.','No genuine install/admission/source qualification provenance inspected.','No live database/provider/native worker or private packet reads.','No artifact output created or visual acceptance performed in this read-only phase.']}
target=HERE/'base-audit-details.json'
if target.exists():raise SystemExit('immutable details already exist')
target.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
if changes or not record['allPinnedPathsExact']:raise SystemExit(1)
