"""Offline packet verification; no product/runtime/renderer execution."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];H=pathlib.Path(__file__).parent
m=json.loads((H/'manifest.json').read_text());checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
for row in m['members']:
 raw=(R/row['path']).read_bytes();check(row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
a=json.loads((H/'audit.json').read_text());check('96 audit checks passed',a['passed']==96 and a['failed']==0 and a['verdict']=='ACCEPT_SOURCE')
receipt=json.loads((H/'source-checks.json').read_text());check('focused group clean and no source diff',receipt['exitCode']==0 and receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
for row in receipt['streams']:
 raw=(R/row['path']).read_bytes();check('raw '+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
check('11 controls no skips','tests 11' in (H/'source-checks.stdout.bin').read_text() and 'fail 0' in (H/'source-checks.stdout.bin').read_text() and 'skipped 0' in (H/'source-checks.stdout.bin').read_text())
for row in a['sourceIdentities']:
 raw=subprocess.check_output(['git','show',a['source']+':'+row['path']],cwd=R);check('frozen source '+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
for row in a['evidenceIdentities']:
 raw=subprocess.check_output(['git','show',a['rootEvidence']+':'+row['path']],cwd=R);check('frozen evidence '+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
result={'passed':sum(x['pass'] for x in checks),'total':len(checks),'failed':sum(not x['pass'] for x in checks),'checks':checks};(H/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}));raise SystemExit(bool(result['failed']))
