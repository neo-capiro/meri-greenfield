"""Verify exact retained author evidence from Git without importing author code."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];out=Path(__file__).resolve().parent
ref='fe81f220d3415c6934333b584f2b625f891a8378';prefix='docs/qualification/candidates/workbook-drafting-20261013/author/'
def blob(path):return subprocess.check_output(['git','-c','gc.auto=0','show',ref+':'+path],cwd=root)
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
manifest=blob(prefix+'manifest.json');m=json.loads(manifest)
check('exact author manifest',hashlib.sha256(manifest).hexdigest()=='3806b48ea897234777a3c67b1ab26e5d34663138aeb712c9c494d43814c78a74')
for r in m['members']+m['sourceFiles']:
 b=blob(r['path']);check(r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
for label,passed,failed in [('workbook-initial',27,2),('workbook-fixture-corrected',29,0),('workbook-frozen',66,0)]:
 r=json.loads(blob(prefix+label+'.json'));check(label+' outcome',r['exitCode']==(1 if failed else 0) and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 for s in r['streams']:
  b=blob(s['path']);check(label+' '+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
 text=blob(prefix+label+'.stdout.bin').decode();check(label+' counts',f'pass {passed}' in text and f'fail {failed}' in text)
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check(label+' group absent',absent)
check('initial test preimage exact independent fixture correction retained',b'create_word' in blob(prefix+'workbook-initial-test.mjs.txt'))
for label in ['first','cli']:
 r=json.loads((out/(label+'.json')).read_text());check('own '+label+' clean and absent',r['exitCode']==0 and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for s in r['streams']:
  b=(root/s['path']).read_bytes();check('own '+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
r={'authorPacket':ref,'authorSource':m['source'],'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeQualified':False}
(out/'author-packet-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'passed':r['passed'],'failed':r['failed']}));raise SystemExit(bool(r['failed']))
