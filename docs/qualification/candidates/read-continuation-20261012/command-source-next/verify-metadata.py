"""Read-only pinned-object metadata audit. Never imports or executes private code."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
base = 'c1c9bfde7dd466a0474589a224a99b44277adbc9'
private_repo = '/workspace/capirov2'
pin = 'fd8765ec01d292013758606204f2c9d886cd31c1'
checks = []

def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})

def git(*args, cwd=root):
    return subprocess.check_output(['git', '-C', str(cwd), *args], stderr=subprocess.PIPE)

def source(path):
    return git('show', pin + ':' + path, cwd=private_repo).decode()

refs = json.loads((evidence / 'reference-identities.json').read_text())
for item in refs['references']:
    for variant in ('pinned', 'observed'):
        expected = item[variant]
        raw = git('show', expected['commit'] + ':' + item['path'], cwd=private_repo)
        actual_blob = git('rev-parse', expected['commit'] + ':' + item['path'], cwd=private_repo).decode().strip()
        check(item['path'] + ':' + variant, len(raw) == expected['bytes'] and hashlib.sha256(raw).hexdigest() == expected['sha256'] and actual_blob == expected['blob'])
    check(item['path'] + ':unchanged', item['pinned']['blob'] == item['observed']['blob'] and item['unchanged'])

helpers = source('apps/api/src/meri/meri-docgen.helpers.ts')
for name, value in [('MAX_DOC_TITLE',200),('MAX_SECTIONS',40),('MAX_PARAGRAPHS',60),('MAX_BULLETS',60),('MAX_TABLES',20),('MAX_TABLE_ROWS',500),('MAX_TABLE_COLS',24),('MAX_SHEETS',20),('MAX_SLIDES',60),('MAX_CELL_CHARS',8000),('MAX_IMAGES_PER_BLOCK',4)]:
    check('normalizer constant '+name, bool(re.search(r'\b'+name+r'\s*=\s*'+str(value)+r'\b',helpers)))
check('text bound1MiB', bool(re.search(r'MAX_TEXT_BYTES\s*=\s*1024\s*\*\s*1024',helpers)))
check('image bound3MiB chars', bool(re.search(r'MAX_IMAGE_BASE64_CHARS\s*=\s*3\s*\*\s*1024\s*\*\s*1024',helpers)))
check('text surrogate replacement refused', 'text !== textRaw' in helpers)
check('text fatal UTF8 and BOM preservation', 'fatal: true' in helpers and 'ignoreBOM: true' in helpers)
check('text allowed control exceptions', all(x in helpers for x in ['0x09','0x0a','0x0d']))
check('text C0/C1/DEL exact source range', 'cp < 0x20 || (cp >= 0x7f && cp < 0xa0)' in helpers)
check('final metadata retains C1 boundary', 'C0/C1/DEL' in json.loads((evidence/'artifact-boundaries.json').read_text())['normalization']['text']['exactBytes'])
check('sheet width is max(headers,1)', 'Math.max(headers.length, 1)' in helpers)
check('sheet casefold dedup', 'usedNames.has(unique.toLowerCase())' in helpers)
check('no copied artifact implementation file', not any(p.suffix in {'.ts','.mjs','.js'} for p in evidence.rglob('*') if p.is_file()))

run = source('apps/clio-sandbox/src/run.ts')
for name, value in [('WALL_TIMEOUT_MS',35000),('MAX_CODE_CHARS',40000),('MAX_DATASETS',8),('MAX_DATASET_ROWS',5000),('MAX_STD_CHARS',64000),('MAX_IMAGES',6)]:
    cleaned = run.replace('_','')
    check('sandbox declared '+name, bool(re.search(r'\b'+name.replace('_','')+r'\s*=\s*'+str(value)+r'\b',cleaned)))
check('sandbox ignores caller timeout in normalized request', 'timeoutMs: WALL_TIMEOUT_MS' in run.split('export async function')[0])
check('sandbox outcome warnings declared', 'warnings: string[]' in run)
server = source('apps/clio-sandbox/src/server.ts')
check('sandbox input8MiB', bool(re.search(r'MAX_BODY_BYTES\s*=\s*8\s*\*\s*1024\s*\*\s*1024',server)))
check('sandbox queue20', bool(re.search(r'MAX_QUEUE\s*=\s*20',server)))
check('sandbox overload429', '429' in server)
tools = source('apps/api/src/meri/meri-tools.service.ts')
check('analysis tenant keyed', 'this.analysisRuns.get(ctx.tenantId)' in tools)
check('analysis20 per hour declaration', bool(re.search(r'ANALYSIS_RUNS_PER_HOUR\s*=\s*20',tools)))
check('analysis45s wrapper timeout', 'AbortSignal.timeout(45_000)' in tools)
check('analysis output stdout12000/stderr4000', 'outcome.stdout.slice(0, 12000)' in tools.replace('_','') and 'outcome.stderr.slice(0, 4000)' in tools.replace('_',''))
check('artifact native receipt SHA/length comparison', 'decoded.length !== meta.documentByteLength' in tools and 'sha256Bytes(decoded) !== meta.documentSha256' in tools)
check('artifact current client gate source', 'security.authorizedClientIds.includes(artifact.clientId)' in tools)
check('artifact selected bytes authority enum', all(s in tools for s in ['persisted_at_creation_v1','regenerated_legacy','regenerated_export']))
controller = source('apps/api/src/engagement/engagement.controller.ts')
check('engagement current tenant task routes', all(x in controller for x in ["@Post('tasks')", "@Patch('tasks/:id')",'CreateTaskDto','UpdateTaskDto']))
check('engagement class minimum role', "@Roles('standard_user')" in controller)
module = source('apps/api/src/engagement/engagement.module.ts')
check('actual governed service DI', 'useFactory: createGovernedEngagementService' in module)
factory = source('apps/api/src/engagement/governed-engagement.factory.ts')
check('factory does not add task wrappers', 'createTask' not in factory and 'updateTask' not in factory)
check('runtime guard exists, not presumed absent', 'guardEngagementServiceRuntime' in factory and 'RUNTIME_ACTION_BY_METHOD' in factory)
service = source('apps/api/src/engagement/engagement.service.ts')
check('RP-specific task guard called', 'assertOwnedResearchPortfolioTask(tx,ctx,task)' in service.replace(' ',''))
check('ordinary task owner nullable default', 'ownerUserId: input.ownerUserId ?? null' in service)
check('task creator server actor', 'createdByUserId: ctx.userId' in service)
rp = source('apps/api/src/engagement/research-portfolio-task-access.ts')
check('RP guard early return for other sources', bool(re.search(r'if\s*\(task.sourceType\s*!==\s*RESEARCH_PORTFOLIO_TASK_SOURCE\)\s*return',rp)))
check('RP exact actor checks', 'task.createdByUserId !== ctx.userId' in rp and 'task.ownerUserId !== ctx.userId' in rp)
check('RP artifact authorizer kept', 'authorizeResearchPortfolioArtifact' in rp)

schema = json.loads(git('show','HEAD:packages/contracts/meri.schema.json'))
reuse = json.loads((evidence / 'canonical-reuse.json').read_text())
check('exact public action enumeration', schema['$defs']['Command']['properties']['action']['enum'] == reuse['actionEnum'])
check('all eleven selected operations covered', len(reuse['operations']) == 11 and len({x['operation'] for x in reuse['operations']}) == 11)
for name in ['ObjectReference','ArtifactVersion','Command','ApprovalProposal','ApprovalDecision','CommandExecutionRequest','CommandReceipt','ScheduleProjection']:
    check('reuse canonical '+name, name in schema['$defs'])
check('memory exception not reopened', 'administrator self-approval' in reuse['operations'][0]['disposition'])
check('public schedule is projection not action', not any('schedule' in x for x in reuse['actionEnum']))
base_entries = git('ls-tree','-r',base).decode().splitlines()
# Git handles skip-worktree entries; sparse absent paths are not deletions.
changed = git('diff','--name-only',base,'--').decode().splitlines()
allowed_report='docs/coordination/reports/CODEX-COMMAND-SOURCE-NEXT-20261012.md'
allowed_prefix='docs/qualification/candidates/read-continuation-20261012/command-source-next/'
check('all changed paths exclusively owned', all(p == allowed_report or p.startswith(allowed_prefix) for p in changed))
check('no product diff', not git('diff',base,'--','apps','packages','scripts','package.json','package-lock.json'))
check('no base tracked deletion', not git('ls-files','--deleted'))
result={'scope':'STATIC_METADATA_ONLY; no private module execution, database, renderer or sandbox run','base':base,'references':len(refs['references']),'baseTrackedFiles':len(base_entries),'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
(evidence/'metadata-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['scope','references','baseTrackedFiles','passed','failed']}))
for x in checks:
    if not x['passed']: print('FAILED: '+x['name'])
raise SystemExit(1 if result['failed'] else 0)
