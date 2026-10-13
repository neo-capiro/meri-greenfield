"""Offline immutable source/receipt audit; never contacts a service."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[5]
EVIDENCE=Path(__file__).resolve().parent
BASE='3d34bf42983824327c63f96419abcfea8a587407'
SOURCE='d560cf999d4e6d03a0cc66ded8a52387776fb48c'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref):
    result={}
    for entry in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
        if entry:
            identity,path=entry.split(b'\t',1)
            result[path.decode()]=identity.decode()
    return result
base,head=tree(BASE),tree('HEAD')
checks=[]
def check(name,truth):
    checks.append({'name':name,'passed':bool(truth)})
    if not truth:raise AssertionError(name)
check('every base Git entry remains byte/mode identical',all(head.get(p)==v for p,v in base.items()))
allowed={'apps/control/qualified-application/schema.mjs','apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema.test.mjs','apps/control/qualified-application/schema.fixture.mjs','apps/control/qualified-application/README-schema.md','docs/coordination/tasks/CODEX-QUALIFIED-SCHEMA-20261013.md','docs/coordination/reports/CODEX-QUALIFIED-SCHEMA-20261013.md'}
prefix='docs/qualification/candidates/qualified-application-20261013/schema-author/'
check('new paths confined to allocation',all(p in allowed or p.startswith(prefix) for p in head.keys()-base.keys()))
pins={
'apps/proxy/qualification/state/migrations/0001_qualification_state.sql':'fa33f51c492361c280c4847ea08629f0c777cb6b0e9652f1e67f95543bda0dfc',
'apps/proxy/qualification/state/migrations/0002_tool_budget.sql':'53d3933a440ed0801411d3ed544f4c554f397b3338acaad1ce1addcce4ef5809',
'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql':'8d0c6ab5e3027b637f7905bd19ac1d830095f1565f745d4e2954294b115137e5',
'apps/control/task-lookup/migrations/0001_task_lookup.sql':'ae3197c4f898c5a8a493b2bee4cd6c5da16c62730ad3447e4f07ebfeaf1c100f',
'apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql':'3270e42c779bbe5a367506142a45b31ed3d9ccbe90b88658d52ba3bcf5543e3b',
'apps/control/commands/migrations/0001_commands.sql':'252683e2db8ffd36dbc7b3cfdada9a28f59a0f192522253a852686369560704b',
}
references=[]
for path,digest in pins.items():
    raw=git('show',f'{BASE}:{path}')
    check('migration SHA256 '+path,hashlib.sha256(raw).hexdigest()==digest)
    check('working migration unchanged '+path,(ROOT/path).read_bytes()==raw)
    references.append({'path':path,'blob':git('rev-parse',f'{BASE}:{path}').decode().strip(),'bytes':len(raw),'sha256':digest})
for path in ['apps/control/qualified-application/schema.mjs','apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema.test.mjs','apps/control/qualified-application/schema.fixture.mjs']:
    check('exact final source '+path,(ROOT/path).read_bytes()==git('show',f'{SOURCE}:{path}'))
for label,code,passed,failed in [('initial',1,32,1),('corrected',0,33,0),('receipt',0,34,0),('namespace-before',1,34,1),('namespace-repaired',0,36,0)]:
    receipt=json.loads((EVIDENCE/f'{label}.json').read_bytes())
    check(label+' exit/group',receipt['exitCode']==code and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    if label=='namespace-before':
        diff=(EVIDENCE/'namespace-before.diff.patch').read_bytes()
        check(label+' exact preserved test-only source diff',receipt['sourceHead']=='97197d84b72f090cd5a87aaf0de4e5421c0a6f45' and len(diff)==receipt['sourceDiffBytes'] and hashlib.sha256(diff).hexdigest()==receipt['sourceDiffSha256'])
    else:check(label+' exact source diff',receipt['sourceDiffBytes']==0)
    for member in receipt['streams']:
        raw=(ROOT/member['path']).read_bytes()
        check(label+' raw '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
    output=(EVIDENCE/f'{label}.stdout.bin').read_text()
    check(label+' actual test totals',f'pass {passed}' in output and f'fail {failed}' in output)
check('no dependency installation or borrowed root link',(ROOT/'node_modules').exists() is False)
original=git('show','20b47403:apps/control/qualified-application/schema.test.mjs').decode()
current=(ROOT/'apps/control/qualified-application/schema.test.mjs').read_text()
check('every original author assertion preserved byte-for-byte',current[current.index('const ddls=s=>'):].startswith(original[original.index('const ddls=s=>'):]))
helpers=original[original.index("const root=new URL('../../../',import.meta.url);"):original.index('const ddls=s=>')]
shared=(ROOT/'apps/control/qualified-application/schema.fixture.mjs').read_text()
check('fixture extraction exact except explicit descriptor override',shared[shared.index("const root=new URL('../../../',import.meta.url);"):shared.index('\nexport {')]==helpers.replace('const f=fixture(),log=[]','const f=fixture(options.fixture),log=[]'))
production=(ROOT/'apps/control/qualified-application/schema.mjs').read_text()
check('inverse namespace patch exactly recovers original production',production.replace("left(nspname,3)<>'pg_'","nspname NOT LIKE 'pg_%'")==git('show','20b47403:apps/control/qualified-application/schema.mjs').decode())
check('sealed initial manifest preserved',(EVIDENCE/'manifest-initial.json').read_bytes()==git('show','97197d84:docs/qualification/candidates/qualified-application-20261013/schema-author/manifest.json'))
print(json.dumps({'status':'PASS','base':BASE,'source':SOURCE,'head':git('rev-parse','HEAD').decode().strip(),'originalEntriesPreserved':len(base),'checksPassed':len(checks),'checks':checks,'migrationReferences':references,'scope':'OFFLINE_SOURCE_AND_RECEIPT_ONLY'},indent=2))
