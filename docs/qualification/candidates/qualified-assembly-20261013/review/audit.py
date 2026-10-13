"""Read-only exact-source/preservation/owned-process audit. No native dependencies."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
BASE='3d34bf42983824327c63f96419abcfea8a587407'
ROOT_PIN='e2d27150169bb4d9c07bd07152d2c922e2b163c3'
LIFECYCLE='3253960035dbfd8cce4dd1b20925f4f4c7f152ae'
SCHEMA='d560cf999d4e6d03a0cc66ded8a52387776fb48c'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref):
 out={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
before,current=tree(BASE),tree('HEAD')
allow={
 'apps/control/admitted-runs/mount.mjs',
 'apps/control/commands/approval-metadata/postgres-store.mjs',
 'apps/control/commands/approval-metadata/test/fixture.mjs',
 'apps/control/commands/postgres-command-journal.mjs',
 'apps/gateway/budget/admitted-run-binding.mjs',
 'apps/gateway/budget/postgres-tool-budget.mjs',
 'apps/gateway/index.mjs',
 'apps/gateway/local-action/gateway.mjs',
}
changed={p for p,v in before.items() if current.get(p)!=v}
assert changed==allow,(changed^allow)
assert all(p in current for p in before)
public=[p for p in before if p.startswith('packages/contracts/') or p.endswith('.test.mjs') or p.startswith('infra/native-worker/')]
assert all(before[p]==current[p] for p in public)
pins={}
for ref,predicate in [
 (ROOT_PIN,lambda p:p.startswith(('apps/','packages/','infra/','scripts/'))),
 (LIFECYCLE,lambda p:p.startswith(('apps/proxy/qualification/assembly/','infra/native-enforcement/worker-observer','apps/control/qualified-application/lifecycle-bridge','packages/contracts/qualification-assembly-0.2/'))),
 (SCHEMA,lambda p:p.startswith('apps/control/qualified-application/schema') or p=='apps/control/qualified-application/README-schema.md'),
]:
 expected=tree(ref)
 for p in expected:
  if predicate(p) and before.get(p)!=expected[p]:
   assert current.get(p)==expected[p],(ref,p)
   blob=git('show',f'{ref}:{p}')
   pins[p]={'source':ref,'gitEntry':expected[p],'sha256':hashlib.sha256(blob).hexdigest()}
assert 'apps/control/qualified-application/pool.mjs' not in current
catalog=json.loads(git('show','HEAD:packages/contracts/retrieval-0.2/catalog.json'))
assert all(op['handler'] is None for op in catalog['operations'])
captures=[]
for path in sorted(HERE.glob('*.json')):
 receipt=json.loads(path.read_text())
 if not isinstance(receipt,dict) or 'ownedPidAndPgid' not in receipt:continue
 for stream in receipt['streams']:
  body=(ROOT/stream['path']).read_bytes()
  assert len(body)==stream['bytes'] and hashlib.sha256(body).hexdigest()==stream['sha256']
 group=receipt['ownedPidAndPgid']
 try:os.killpg(group,0)
 except ProcessLookupError:pass
 else:raise AssertionError(f'owned group remains: {group}')
 assert receipt['ownedProcessGroupAbsent'] and not receipt['timedOut']
 captures.append({'receipt':path.name,'exitCode':receipt['exitCode'],'group':group,'groupAbsentNow':True})
result={'verdict':'PASS','base':BASE,'reviewHead':git('rev-parse','HEAD').decode().strip(),'retainedOriginalEntries':len(before),'unchangedOriginalEntries':len(before)-len(changed),'exactOriginalChanges':sorted(changed),'originalPublicTestWorkerEntriesUnchanged':len(public),'exactPinnedFiles':len(pins),'pins':pins,'capturedGroups':captures,'productionCatalogOperations':len(catalog['operations']),'productionHandlersAllNull':True,'scope':'source-only; no real engine, AWS worker, native authority or runtime qualification'}
(HERE/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('pins','capturedGroups')},indent=2))
