"""Verify immutable root receipts, raw stream hashes and unchanged production bytes."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
PREFIX='docs/qualification/candidates/read-continuation-20261012/civic-integration/'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(ref,path):return git('show',f'{ref}:{path}')
ref=git('rev-parse',sys.argv[1]).decode().strip()
rows=[];checks=[]
for label in sys.argv[2:]:
 path=PREFIX+label+'.json';raw=blob(ref,path);receipt=json.loads(raw)
 row={'path':path,'sha256':hashlib.sha256(raw).hexdigest(),'sourceHead':receipt['sourceHead'],'command':receipt['command'],'exitCode':receipt['exitCode'],'ownedProcessGroupAbsent':receipt['ownedProcessGroupAbsent'],'ownedPidAndPgid':receipt['ownedPidAndPgid'],'timedOut':receipt['timedOut'],'reapedDescendants':receipt['reapedDescendants'],'streams':[]}
 for stream in receipt['streams']:
  data=blob(ref,stream['path']);sha=hashlib.sha256(data).hexdigest();checks.append({'name':label+' '+stream['path'],'passed':sha==stream['sha256'] and len(data)==stream['bytes']})
  row['streams'].append({**stream,'verified':checks[-1]['passed']})
  if stream['path'].endswith('.stdout.bin'):
   text=data.decode(errors='replace');row['testSummaries']=re.findall(r'(?:ℹ |# )(tests|pass|fail) (\d+)',text)
 checks.append({'name':label+' owned group exited/reaped without timeout','passed':receipt['ownedProcessGroupAbsent'] and not receipt['timedOut']})
 changed=git('diff','--name-only','a35a8323024b37ebb245f1a3c67084c19ef2f0c3',receipt['sourceHead'],'--','apps','packages').decode().splitlines()
 product=[p for p in changed if '/test/' not in p]
 checks.append({'name':label+' exact tested production source','passed':not product,'changed':product})
 rows.append(row)
result={'rootPacket':ref,'receipts':rows,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'scope':'READ_ONLY_ROOT_EVIDENCE_VERIFICATION_NOT_RERUN_OR_RUNTIME_ACCEPTANCE'}
(E/'root-receipts-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(result['failed']!=0)
