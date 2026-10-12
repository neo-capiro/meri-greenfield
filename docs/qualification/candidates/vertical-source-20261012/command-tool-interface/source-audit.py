"""Read-only Git/source and own-capture audit; no native/service ports."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='5a8d11399d8a4b65a5b04d73f9f22e5de54a157f'
source='d0433f7c7e52e6dbc606a9937f92705a42ac863a'
dependency='1625c95d89593f07ec072ad71f9756a41e0c0db1'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
 result={}
 for entry in git('ls-tree','-rz',ref).split(b'\0'):
  if entry:
   identity,path=entry.split(b'\t',1);result[path.decode()]=identity.decode()
 return result
original,final=tree(base),tree(source)
assert all(final.get(p)==value for p,value in original.items()),'Original Git entry changed'
expected_source={'apps/control/commands/tool-interface.mjs','apps/control/test/commands-tool-interface.test.mjs','packages/contracts/commands-0.2/tool-interface-validation.mjs','packages/contracts/commands-0.2/tool-interface.schema.json'}
new=set(final)-set(original)
assert {p for p in new if p.startswith(('apps/','packages/'))}==expected_source
for path in expected_source:
 assert (root/path).read_bytes()==git('show',source+':'+path),'Working source diverged'
for path in sorted(p for p in expected_source if p.startswith('packages/')):
 assert git('show',source+':'+path)==git('show',dependency+':'+path),'Root dependency drift'
receipts=[]
for label in ['initial-connected','canonical-output','late-release-repair','frozen-connected']:
 receipt=json.loads((evidence/(label+'.json')).read_text())
 assert receipt['exitCode']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired']
 for stream in receipt['streams']:
  body=(root/stream['path']).read_bytes()
  assert len(body)==stream['bytes'] and hashlib.sha256(body).hexdigest()==stream['sha256']
 try:os.killpg(receipt['ownedPidAndPgid'],0)
 except ProcessLookupError:pass
 else:raise AssertionError('Owned group still exists')
 receipts.append({'label':label,'sourceHead':receipt['sourceHead'],'sourceDiffSha256':receipt['sourceDiffSha256'],'ownedPidAndPgid':receipt['ownedPidAndPgid'],'freshAbsent':True})
assert receipts[-1]['sourceHead']==source
assert json.loads((evidence/'frozen-connected.json').read_text())['sourceDiffBytes']==0
print(json.dumps({'status':'PASS','source':source,'base':base,'rootDependency':dependency,'originalGitEntriesUnchanged':len(original),'newProductionAndTestPaths':sorted(expected_source),'receipts':receipts,'scope':'SOURCE_ONLY_NO_RUNTIME_ADMISSION'},indent=2))
