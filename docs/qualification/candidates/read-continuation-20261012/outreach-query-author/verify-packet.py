"""Offline integrity verification of the author packet; no producer execution."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
manifest=json.loads((E/'manifest.json').read_text());checks=[]
def check(name,ok):checks.append({'name':name,'pass':bool(ok)})
for row in manifest['members']:
 p=ROOT/row['path'];data=p.read_bytes();check(row['path'],len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'])
audit=json.loads((E/'source-audit-data.json').read_text());check('source audit passed',audit['failed']==0 and audit['passed']==7229)
check('original preservation',audit['originalEntries']==audit['originalEntriesPreserved']==7161)
check('first failure preserved',json.loads((E/'focused-first.json').read_text())['exitCode']==1)
check('frozen source passed',json.loads((E/'focused-freeze.json').read_text())['exitCode']==0)
for label in ['focused-first','focused-corrected','focused-freeze','source-audit','source-audit-final']:
 receipt=json.loads((E/(label+'.json')).read_text());check('owned cleanup:'+label,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
 for stream in receipt['streams']:
  data=(ROOT/stream['path']).read_bytes();check('raw:'+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
for row in audit['sourceFiles']:
 data=subprocess.check_output(['git','-C',str(ROOT),'show',manifest['source']+':'+row['path']]);check('Git source:'+row['path'],hashlib.sha256(data).hexdigest()==row['sha256'])
result={'source':manifest['source'],'manifestSha256':hashlib.sha256((E/'manifest.json').read_bytes()).hexdigest(),'members':len(manifest['members']),'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
