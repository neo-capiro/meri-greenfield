import json,subprocess
from pathlib import Path
task=Path(__file__).parent;root=task/'meri-qualification'
def raw(*a):return subprocess.check_output(['git',*a],cwd=root)
def git(*a):return raw(*a).decode().strip()
def blob(ref,p):
 line=git('ls-tree',ref,'--',p)
 return line.split()[2] if line else None
start='abdf84df18012fc2f1750bba12e8cf722b8792e7';assert git('rev-parse','HEAD')==start
assert not git('diff','--cached','--name-only')
assert git('diff','--name-only')=='docs/coordination/reports/DOT-PACKAGE4-REVIEWED-INTEGRATION-20261016.md'
groups=[
 ('canonical original input claim store and centrally reserved0016','a54239c5f252667b3aaaaa588ef1776219816075','55c20109ff4bb840088b1372a7fe04669041803a','apps',6),
 ('bill-text required current source exposure ledger dependency','074937e9a7d38825f2fae2ca6c2c2e2ca714774f','fb708d231c7273f86b1462c72a72e70ccc36a3d6',None,8),
 ('source-accepted bill-text flat native routes and canonical worker schemas','fb708d231c7273f86b1462c72a72e70ccc36a3d6','674460a57ad8f334f1b6acacaea4702ea3130791',None,21)]
plans=[];virtual={};mismatches=[]
for label,base,source,scope,count in groups:
 args=['diff','--name-only',base,source]
 if scope:args+=['--',scope]
 paths=git(*args).splitlines();assert len(paths)==count,(label,len(paths))
 for p in paths:
  current=virtual.get(p,blob('HEAD',p));expected=blob(base,p)
  if current!=expected:mismatches.append({'path':p,'expectedPredecessor':expected,'currentBlob':current,'group':label})
  virtual[p]=blob(source,p)
 plans.append((label,base,source,paths))
(task/'input-bill-predecessor-preflight.json').write_text(json.dumps({'before':start,'mismatches':mismatches,'groups':[{'label':x[0],'paths':x[3]}for x in plans]},indent=2)+'\n',newline='\n')
assert not mismatches,mismatches
report=root/'docs/coordination/reports/DOT-PACKAGE4-REVIEWED-INTEGRATION-20261016.md'
report.write_text(report.read_text()+'''\n\n## Newly accepted claim and bill-text integration outline\n\nParent scoped ACCEPT41c authorizes the six canonical store/facts/test/0016 paths only; the public0.1.8 service/receiver/mount implementation is still in progress with Input/Startup and is not claimed enforced by every route. Preserve the same canonical transaction, original expiry and prepared-window digest. Parent source-accepted bill e431 contributes its exact21 tested code/test/current-ledger paths (publication adds only its report) plus the eight current source-ledger dependency paths from fb708, never unrelated ancestors. It adds only two fixed flat routes and canonical schema conversions; genuine current native credentials/context/installation remain unavailable. Preserve historical ledger rows/exclusions, old public artifacts and all locks; record each predecessor and focused exact-source check.\n''',newline='\n')
receipts=[]
for label,base,source,paths in plans:
 before=git('rev-parse','HEAD')
 subprocess.run(['git','restore','--source',source,'--staged','--worktree','--',*paths],cwd=root,check=True)
 assert set(git('diff','--cached','--name-only').splitlines())==set(paths)
 subprocess.run(['git','diff','--cached','--check'],cwd=root,check=True)
 subprocess.run(['git','commit','-m','Integrate '+label,'-m','Exact accepted source dependency selection after every predecessor blob check. No whole lane merge, old artifact generation, lock/image repin, SQL execution, credential creation or live activation.'],cwd=root,check=True)
 head,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}')
 rows=[]
 for p in paths:
  assert blob(head,p)==blob(source,p),p
  rows.append({'path':p,'acceptedBlob':blob(source,p),'integratedBlob':blob(head,p)})
 receipts.append({'label':label,'predecessor':base,'reviewedSource':source,'before':before,'integratedCommit':head,'integratedTree':tree,'files':rows})
(task/'input-bill-integration-source.json').write_text(json.dumps({'groups':receipts,'source':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'checks':'PENDING focused coherent exact-source checks'},indent=2)+'\n',newline='\n')
print(json.dumps({'source':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'groups':[{'label':x['label'],'commit':x['integratedCommit'],'paths':len(x['files'])}for x in receipts]}))
