"""Offline packet verification; no database, dependency import or process launch."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
manifest=json.loads((evidence/'manifest.json').read_text())
checks=0
for member in manifest['members']:
    path=root/member['path']
    raw=path.read_bytes()
    assert len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'],member['path']
    checks+=1
source=json.loads((evidence/'final-source-audit.json').read_text())
assert source['changedOriginalEntries']==[] and source['actualNativeCases']=='UNRUN' and not source['realDurabilityClaim']
checks+=1
for row in source['source']:
    assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['sha256'],row['path']
    checks+=1
for path in sorted(evidence.glob('offline-*.json')):
    receipt=json.loads(path.read_text())
    assert receipt['exitCode']==0 and not receipt['timedOut'] and receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent']
    assert not receipt['ownedGroupKillRequired']
    for row in receipt['streams']:
        raw=(root/row['path']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==row['sha256'] and len(raw)==row['bytes']
        checks+=1
    checks+=1
cleanup=json.loads((evidence/'cleanup.json').read_text())
assert cleanup['databaseConnections']==0 and not cleanup['SQLExecuted'] and not cleanup['otherOwnersTouched']
assert len(cleanup['ownedDependencyCopies'])==7 and all(x['removedOwnedCopy'] and not x['donorTouched'] for x in cleanup['ownedDependencyCopies'])
checks+=2
print(json.dumps({'status':'PASS','checks':checks,'native':'UNRUN','SQL':'UNRUN'}))
