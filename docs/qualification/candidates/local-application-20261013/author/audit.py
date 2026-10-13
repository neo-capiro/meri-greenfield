import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];out=Path(__file__).resolve().parent
base='334890d930fbdb209044c30ff552409bcb86240e';source='fc76ac68f8e2b2b0de6f214326a7f67b9a7ef661'
def tree(ref):
 result={}
 for raw in subprocess.check_output(['git','ls-tree','-rz',ref],cwd=root).split(b'\0'):
  if raw:
   metadata,path=raw.split(b'\t',1);result[path.decode()]=metadata.decode()
 return result
old=tree(base);new=tree(source);changed=[p for p,v in old.items() if new.get(p)!=v]
assert set(changed)=={'apps/gateway/local-action/gateway.mjs','apps/control/action-host/local/recovery.mjs'}
receipts=[]
for label in ['initial-shared','public-entry-repaired','coherent-shared','seed-uncertain']:
 r=json.loads((out/(label+'.json')).read_text())
 for stream in r['streams']:
  content=(root/stream['path']).read_bytes();assert len(content)==stream['bytes'] and hashlib.sha256(content).hexdigest()==stream['sha256']
 assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 else:absent=False
 assert absent
 receipts.append({'label':label,'exitCode':r['exitCode'],'pgid':r['ownedPidAndPgid'],'freshAbsent':absent})
assert [r['exitCode'] for r in receipts]==[1,1,0,0]
# Bind the final successful precommit check to the committed source/test diff.
r=json.loads((out/'seed-uncertain.json').read_text());diff=subprocess.check_output(['git','diff',r['sourceHead'],source,'--','apps','packages','scripts','package.json','package-lock.json'],cwd=root)
assert len(diff)==r['sourceDiffBytes'] and hashlib.sha256(diff).hexdigest()==r['sourceDiffSha256']
receipt={'status':'PASS','base':base,'source':source,'originalEntries':len(old),'unchangedOriginalEntries':len(old)-len(changed),'changedOriginals':changed,'captures':receipts,'finalPrecommitDiffExact':True,'poolEvidence':'scripted-shared-state','nativeExecution':False}
(out/'audit.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
