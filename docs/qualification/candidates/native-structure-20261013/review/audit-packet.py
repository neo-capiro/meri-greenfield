#!/usr/bin/env python3
"""Verify retained author artifacts from immutable Git objects, without executing them."""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];OUT=Path(__file__).resolve().parent
PIN='9b67f63e1820a4fb9ad8a66d1f927655cdfe63ba';SOURCE='fa3f06cc8f23a822a8fc74662187e7d3a7a8144b';BASE='67ccac716bd6cbce4ee04e439a085bab75ae21a5';MAPPED='ac9d7cdb1fb870619148a81adb69ab6b7409636d'
P='docs/qualification/candidates/native-structure-20261013/author/'
checks=[]
def git(*a):return subprocess.check_output(['git','-c','gc.auto=0',*a],cwd=ROOT)
def blob(path,pin=PIN):return git('show',pin+':'+path)
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
def sha(b):return hashlib.sha256(b).hexdigest()
mraw=blob(P+'manifest.json');m=json.loads(mraw)
check('manifest exact supplied identity',sha(mraw)=='38ea1c596ea266943a37a76fc9d32ca903843a2d11cc3cf581fd1bccd0a676f1')
check('manifest exact member and source counts',len(m['members'])==19 and len(m['sourceFiles'])==7)
for f in m['members']+m['sourceFiles']:
 b=blob(f['path']);check('member '+f['path'],len(b)==f['bytes'] and sha(b)==f['sha256'])
 if f in m['sourceFiles']:check('source exact mapped freeze '+f['path'],b==blob(f['path'],MAPPED))
for label,passes,fails in [('before',5,5),('repaired',48,3),('final',65,0)]:
 r=json.loads(blob(P+'structure-'+label+'.json'));o=blob(P+'structure-'+label+'.stdout.bin').decode()
 check(label+' counts retained',bool(re.search(r'pass '+str(passes)+r'\b',o)) and bool(re.search(r'fail '+str(fails)+r'\b',o)))
 check(label+' raw identities and cleanup',all(len(blob(s['path']))==s['bytes'] and sha(blob(s['path']))==s['sha256'] for s in r['streams']) and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and not r['timedOut'])
 check(label+' source capture exact',r['sourceDiffBytes']==0)
for p in ['schema-size.test.mjs','schema-size-independent.test.mjs','schema-size-inventory.test.mjs']:
 check('original expectation preimage '+p,blob(P+p+'.before.txt')==blob('apps/control/qualified-application/'+p,BASE))
patch=git('diff',SOURCE,MAPPED,'--','apps/control/qualified-application')
check('exact three-file test patch retained',patch==blob(P+'test-expectation-map.patch'))
a=json.loads(blob(P+'source-audit.json'));check('author audit retained52 all true',len(a['checks'])==52 and all(c['passed'] for c in a['checks']))
paths=[f['path'] for f in m['members']]+[P+'manifest.json']+[f['path'] for f in m['sourceFiles']]
check('manifest has no duplicate member paths',len(paths)==len(set(paths)))
report={'authorPacket':PIN,'authorTree':git('rev-parse',PIN+'^{tree}').decode().strip(),'source':SOURCE,'mappedTests':MAPPED,'manifestSha256':sha(mraw),'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'nativeExecution':False}
(OUT/'packet-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'failed':report['failed']}));raise SystemExit(bool(report['failed']))
