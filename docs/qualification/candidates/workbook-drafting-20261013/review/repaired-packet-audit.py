"""Bind the actual repaired source and historical negative to immutable author data."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5];out=Path(__file__).resolve().parent;prefix='docs/qualification/candidates/workbook-drafting-20261013/author/'
ref='374e2285fd5a544b609161fa4c92e54b82d71627';source='16a4f883962bd72f9421949df95709f65b286555'
def git(*a):return subprocess.check_output(['git','-c','gc.auto=0',*a],cwd=root)
def blob(path,r=ref):return git('show',r+':'+path)
checks=[]
def ck(name,ok):checks.append({'name':name,'passed':bool(ok)})
mraw=blob(prefix+'filename-repair-manifest.json');m=json.loads(mraw)
ck('final manifest hash',hashlib.sha256(mraw).hexdigest()=='d6ef0787c0df17a1aa26b02c0db16aa075658850226a5b0a96de80a1b4954f53')
for row in m['members']+m['sourceFiles']:
 b=blob(row['path']);ck(row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
ck('historical report exact',blob(prefix+'author-report-before-filename.md')==blob('docs/coordination/reports/CODEX-WORKBOOK-DRAFTING-AUTHOR-20261013.md','fe81f220'))
for p in ['apps/control/document-application/index.mjs','apps/control/document-application/current.mjs','apps/control/document-application/format-admission.mjs']:
 ck('reviewed source exact '+p,(root/p).read_bytes()==blob(p,source))
# Existing tests are not weakened; all original author cases are a literal prefix.
p='apps/control/document-application/test/workbook-application.test.mjs';ck('original author controls literal prefix',blob(p,source).startswith(blob(p,'10295f04')))
for label,passes,failures in [('filename-before',1,4),('filename-repaired',15,0)]:
 r=json.loads(blob(prefix+label+'.json'));ck(label+' capture',r['exitCode']==bool(failures) and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 text=blob(prefix+label+'.stdout.bin').decode();ck(label+' counts',f'pass {passes}' in text and f'fail {failures}' in text)
 for s in r['streams']:
  b=blob(s['path']);ck(label+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
for label,passes,failures in [('filename-before',0,1),('filename-repaired',33,0)]:
 r=json.loads((out/(label+'.json')).read_text());ck('independent '+label+' capture',r['exitCode']==bool(failures) and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 text=(out/(label+'.stdout.bin')).read_text();ck('independent '+label+' counts',f'pass {passes}' in text and f'fail {failures}' in text)
 for s in r['streams']:
  b=(root/s['path']).read_bytes();ck('independent '+s['path'],len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'])
 ps=json.loads(next(x.split(' ',1)[1] for x in text.splitlines() if x.startswith('INDEPENDENT_WORKBOOK_PROCESSES ')))
 for v in ps:
  try:os.killpg(v['pid'],0);absent=False
  except ProcessLookupError:absent=True
  ck('child '+str(v['pid']),absent and v['leaderClosed'] and v['groupAbsent'] and v['exitCode']==0)
r={'authorPacket':ref,'source':source,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeQualified':False}
(out/'repaired-packet-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'passed':r['passed'],'failed':r['failed']}));raise SystemExit(bool(r['failed']))
