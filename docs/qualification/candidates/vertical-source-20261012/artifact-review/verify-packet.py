"""Verify the complete reviewer-owned packet; filesystem/Git data only."""
import hashlib,json,subprocess,sys
from pathlib import Path
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
owned=[r/'docs/coordination/tasks/CODEX-ARTIFACT-EXECUTION-REVIEW-20261012.md',r/'docs/coordination/reports/CODEX-ARTIFACT-EXECUTION-REVIEW-20261012.md']
owned+=list((r/'apps/artifacts/test').glob('*-independent*'))+list((r/'packages/contracts/test').glob('artifact-execution-independent*'))+list(e.iterdir())
excluded={e/'manifest.json',e/'verification.json'}
files=sorted({p.relative_to(r).as_posix() for p in owned if p.is_file() and p not in excluded})
source='47aef9f9a58d14a932ddc0b8cfdaf1475a5cb1ae'
if '--build' in sys.argv:
 m={'schema':'meri-artifact-independent-review-manifest/1','verdict':'ACCEPT_SOURCE','source':source,'sourceTree':'2bedef6f8857afd44f57e0925e0183908ce46742','functionalTestSource':'814ecf1baa1b5890545576a0815257199505103a','authorPacket':'b97fb68c336da35874923c3f5e83a73e870d6f95','members':[{'path':p,'bytes':len((r/p).read_bytes()),'sha256':hashlib.sha256((r/p).read_bytes()).hexdigest()} for p in files],'exclusions':['manifest.json: self-reference','verification.json: generated verification receipt']}
 (e/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
m=json.loads((e/'manifest.json').read_text());checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
check('complete unique reviewer membership',set(files)=={x['path'] for x in m['members']} and len(files)==len(m['members']))
for x in m['members']:
 data=(r/x['path']).read_bytes();check(x['path'],len(data)==x['bytes'] and hashlib.sha256(data).hexdigest()==x['sha256'])
for x in json.loads((e/'source-audit-final.json').read_text())['products']:
 data=subprocess.check_output(['git','show',source+':'+x['path']],cwd=r);check('source '+x['path'],len(data)==x['bytes'] and hashlib.sha256(data).hexdigest()==x['sha256'])
check('all author metadata checks passed',json.loads((e/'author-packet-audit.json').read_text())['failed']==0)
check('exact115 final source tests',all(s in (e/'final-focused.stdout.bin').read_text() for s in ['tests 115','pass 115','fail 0','skipped 0']))
check('seven owned links removed',len(json.loads((e/'dependency-closeout.json').read_text())['ownedLinks'])==7 and all(not (r/'node_modules'/x).exists() for x in ['ajv','ajv-formats','canonicalize','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string']))
result={'source':source,'manifestSha256':hashlib.sha256((e/'manifest.json').read_bytes()).hexdigest(),'members':len(m['members']),'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'runtimeAcceptance':False}
(e/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['source','manifestSha256','members','passed','failed']}));raise SystemExit(result['failed']!=0)
