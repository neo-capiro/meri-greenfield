"""Metadata-only exact Git packet audit; never imports a candidate/private module."""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[5]
REF=sys.argv[1];PREFIX='docs/qualification/candidates/read-continuation-20261012/intelligence-summary-author/'
def blob(p):return subprocess.check_output(['git','-C',str(ROOT),'show',REF+':'+p])
checks=[]
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
m=json.loads(blob(PREFIX+'manifest.json'));paths=[r['path'] for r in m['files']]
check('Unique bounded relative membership',len(paths)==len(set(paths))==23 and all(not p.startswith('/') and '..' not in pathlib.PurePosixPath(p).parts for p in paths))
for r in m['files']:
 b=blob(r['path']);check('Exact packet member '+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
for r in m['files']:
 if r['path'].startswith('packages/'):
  expected=subprocess.check_output(['git','-C',str(ROOT),'show','d48c9620e30c3686217095cb45b24f1b0c8218a2:'+r['path']]);check('Source freeze retained '+r['path'],expected==blob(r['path']))
first=json.loads(blob(PREFIX+'metadata-audit.stdout.bin'));last=json.loads(blob(PREFIX+'metadata-audit-repaired.stdout.bin'))
check('Original metadata failure preserved',first['passed']==46 and first['failed']==1)
check('Collector repair passes unchanged assertion names',[r['name'] for r in first['results']]==[r['name'] for r in last['results']] and last['passed']==47 and last['failed']==0)
check('Original preservation count retained',first['originalBlobsPreserved']==last['originalBlobsPreserved']==6528)
for label in ['focused','metadata-audit','metadata-audit-repaired']:
 r=json.loads(blob(PREFIX+label+'.json'))
 check('Owned group absent '+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=blob(stream['path']);check('Raw captured bytes '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
verification=json.loads(blob(PREFIX+'verification.json'));check('Declared manifest verifier34 pass',verification['checks']==verification['passed']==34 and verification['failed']==0)
findings=json.loads(blob(PREFIX+'source-findings.json'));check('Source-only truth limits retained',findings['runtimeAccepted'] is False and findings['sourceExecuted'] is False and findings['privateBodiesPublished'] is False and findings['countScope']['absenceEvidence'] is False)
report=blob('docs/coordination/reports/CODEX-INTELLIGENCE-SUMMARY-AUTHOR-20261012.md').decode();check('Configured lobby branch clarified','configur' in report.lower() and 'openlobby' in report.lower())
out={'authorPacket':REF,'source':m['source'],'manifestSha256':hashlib.sha256(blob(PREFIX+'manifest.json')).hexdigest(),'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
print(json.dumps(out,indent=2));sys.exit(bool(out['failed']))
