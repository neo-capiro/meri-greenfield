"""Independently bind accepted review packets without repeating their behavioral suites."""
from pathlib import Path
import hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[5];O=Path(__file__).resolve().parent
candidate=sys.argv[1]; general=sys.argv[2] if len(sys.argv)>2 else None
packets=[('d19f73649bec835da360265f603c87ef170efb92','test-continuation-review'),('7f29b527','artifact-budget-review'),('64f5a56c50c048a700481d28914db9d2c219cb8d','command-tool-review')]
if general:packets.append((general,'general-analysis-budget-review'))
def git(*args):return subprocess.check_output(['git','-C',str(R),*args])
def blob(ref,p):return git('show',ref+':'+p)
checks=[];records=[]
def ck(n,v):checks.append({'name':n,'passed':bool(v)})
for revision,lane in packets:
 ref=git('rev-parse',revision).decode().strip()
 # Only a tracked explicit review manifest, never a guessed filename.
 paths=git('ls-tree','-r','--name-only',ref,'docs/qualification/candidates/vertical-source-20261012').decode().splitlines()
 matches=[p for p in paths if p.endswith('/'+lane+'/manifest.json')]
 ck('one manifest '+lane,len(matches)==1)
 if len(matches)!=1:continue
 p=matches[0];raw=blob(ref,p);m=json.loads(raw)
 ck('explicit source acceptance '+lane,m.get('verdict') in ['ACCEPT_SOURCE','ACCEPT_SOURCE_TEST_ONLY'])
 ck('exact accepted manifest integrated '+lane,blob(candidate,p)==raw)
 for row in m['members']:
  b=blob(ref,row['path']);ck('frozen member '+lane+' '+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
  ck('integrated member '+lane+' '+row['path'],blob(candidate,row['path'])==b)
 records.append({'review':ref,'manifest':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'members':len(m['members']),'source':m.get('source') or m.get('applicationSource'),'runtimeAccepted':False})
result={'candidate':candidate,'packets':records,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'runtimeAccepted':False}
(O/'accepted-packet-audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['candidate','passed','failed']}));print(json.dumps([x for x in checks if not x['passed']]))
raise SystemExit(bool(result['failed']))
