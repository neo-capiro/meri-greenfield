"""Immutable author-packet audit. Git and JSON only; no target import/execution."""
import hashlib,json,os,subprocess
from pathlib import Path
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
PACKET='b97fb68c336da35874923c3f5e83a73e870d6f95';SOURCE='47aef9f9a58d14a932ddc0b8cfdaf1475a5cb1ae';BASE='e5fb3963de787bbd7b7663316c368f15814897da';prefix='docs/qualification/candidates/vertical-source-20261012/artifact-author/'
def git(*args):return subprocess.check_output(['git',*args],cwd=r)
def blob(path):return git('show',PACKET+':'+path)
def tree(ref):
 out={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
checks=[]
def check(name,value):checks.append({'name':name,'pass':bool(value)})
manifest=blob(prefix+'manifest.json');m=json.loads(manifest);a,b,c=tree(BASE),tree(SOURCE),tree(PACKET)
check('exact supplied manifest SHA',hashlib.sha256(manifest).hexdigest()=='36d982f082873e401a91d6b111865a607a6b4aa6d9ef7d5bf86af6c5fb7d964d')
check('46 unique manifest members',len(m['members'])==len({x['path'] for x in m['members']})==46)
check('final source binding',m['source']==SOURCE)
check('all8678 originals unchanged',len(a)==8678 and all(c.get(p)==v for p,v in a.items()))
check('all reviewed source entries unchanged',all(c.get(p)==v for p,v in b.items()))
for row in m['members']:
 data=blob(row['path']);check('manifest '+row['path'],len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'])
excluded={prefix+'manifest.json',prefix+'verify.stdout.json',prefix+'verify.stderr.txt'};memberSet={x['path'] for x in m['members']}
check('complete added-file coverage',set(c)-set(a)==memberSet|excluded)
check('no hidden production additions',all(p in b or p.startswith(prefix) or p=='docs/coordination/reports/CODEX-ARTIFACT-EXECUTION-20261012.md' for p in c))
for stem,passed,failed in [('focused-first',19,0),('focused-second',26,1),('focused-repaired',30,0),('focused-overflow-image-repaired',32,0),('focused-canonical',34,0)]:
 capture=json.loads(blob(prefix+stem+'.json'));out=blob(prefix+stem+'.stdout.txt');err=blob(prefix+stem+'.stderr.txt')
 check(stem+' stream hashes',hashlib.sha256(out).hexdigest()==capture['stdoutSha256'] and hashlib.sha256(err).hexdigest()==capture['stderrSha256'])
 text=out.decode();check(stem+' exact test totals',f'pass {passed}' in text and f'fail {failed}' in text)
 check(stem+' exact source/no dirty implementation',capture['sourceDiff']=='' and not capture['timeout'])
 check(stem+' owned group closed',capture['groupAbsent'])
 try:os.killpg(capture['group'],0);absent=False
 except ProcessLookupError:absent=True
 check(stem+' group absent now',absent)
coverage=json.loads(blob(prefix+'coverage.json'));check('four obligations retained',{x['operation'] for x in coverage['obligations']}=={'create_word','create_excel','create_powerpoint','run_analysis'})
check('native receipt explicitly unverified',coverage['nativePortableEvidence']['verifiedHere'] is False)
check('native general execution not claimed',any('general program execution' in x.lower() for row in coverage['obligations'] if row['operation']=='run_analysis' for x in row['unrun']))
result={'packet':PACKET,'source':SOURCE,'manifestSha256':hashlib.sha256(manifest).hexdigest(),'manifestMembers':len(m['members']),'checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'scope':'METADATA_ONLY_NO_PRODUCT_RERUN'}
(e/'author-packet-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['packet','manifestMembers','passed','failed']}));raise SystemExit(bool(result['failed']))
