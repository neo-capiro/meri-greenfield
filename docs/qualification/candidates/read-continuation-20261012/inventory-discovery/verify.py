"""Verify discovery metadata against local Git objects; execute no product code."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[5]
lane = Path(__file__).resolve().parent
repo = Path(sys.argv[1]) if len(sys.argv) == 2 else Path('/workspace/capirov2')
metadata = json.loads((lane/'reference-identities.json').read_bytes())
proposals = json.loads((lane/'slices.json').read_bytes())
checks = []
def check(name, ok):
    checks.append({'name':name,'passed':bool(ok)})
def git(where, *args):
    return subprocess.check_output(['git',*args],cwd=where)
for row in metadata['references']:
    raw = git(repo,'show',f'{metadata["sourceCommit"]}:{row["path"]}')
    old = git(repo,'rev-parse',f'{metadata["sourceCommit"]}:{row["path"]}').decode().strip()
    observed = git(repo,'rev-parse',f'{metadata["observedCommit"]}:{row["path"]}').decode().strip()
    check(f'raw identity: {row["path"]}',len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
    check(f'Git identity: {row["path"]}',old==row['blob'])
    check(f'observed no drift: {row["path"]}',observed==row['observedBlob']==old and row['unchanged'] is True)
path='packages/contracts/retrieval-0.2/catalog.json'
base=git(root,'show',f'{metadata["meriBase"]}:{path}')
check('canonical catalog unchanged',(root/path).read_bytes()==base)
catalog=json.loads(base)
check('139 originals retained',len(catalog['originals'])==139)
check('96 selected retained',sum(r['disposition']=='selected' for r in catalog['originals'])==96)
check('43 deferred retained',sum(r['disposition']=='deferred' for r in catalog['originals'])==43)
check('20 mappings retained',sum(r['state']=='mapped' for r in catalog['originals'])==20)
check('76 pending selected retained',sum(r['disposition']=='selected' and r['state']=='pending' for r in catalog['originals'])==76)
check('21 typed unavailable retained',len(catalog['operations'])==21 and all(r['handler'] is None and r['qualification']=='pending' and r['availability']=='unimplemented' for r in catalog['operations']))
selected = [id for group in proposals['readySlices'] for id in group['operationIds']]
check('seven distinct proposals, no alternate mapping',len(selected)==7==len(set(selected)) and proposals['isRegistry'] is False and proposals['changesMappings'] is False)
for id in selected:
    row=next(r for r in catalog['originals'] if r['id']==id)
    check(f'selected pending source candidate: {id}',row['disposition']=='selected' and row['state']=='pending' and row['replacement'] is None)
    check(f'no current bound operation: {id}',all(r['operation']['id']!=id for r in catalog['operations']))
for id in proposals['additionalEffectBoundary']['operationIds']:
    row=next(r for r in catalog['originals'] if r['id']==id)
    check(f'state effect-boundary remains pending: {id}',row['disposition']=='selected' and row['replacement'] is None)
failed=[c for c in checks if not c['passed']]
print(json.dumps({'scope':'READ_ONLY_GIT_METADATA','passed':len(checks)-len(failed),'failed':len(failed),
 'sourceCommit':metadata['sourceCommit'],'observedCommit':metadata['observedCommit'],'meriBase':metadata['meriBase'],
 'catalogSha256':hashlib.sha256(base).hexdigest(),'checks':checks},indent=2))
raise SystemExit(1 if failed else 0)
