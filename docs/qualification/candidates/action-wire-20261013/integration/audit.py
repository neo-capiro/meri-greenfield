"""Read-only source and retained-evidence audit; writes only its own receipt."""
from pathlib import Path
import hashlib, json, os, subprocess, tarfile

root = Path(__file__).resolve().parents[5]
packet = Path(__file__).resolve().parent
def git(*args): return subprocess.check_output(['git', *args], cwd=root)
def tree(ref):
    return {p.decode(): m.decode() for item in git('ls-tree', '-rz', ref).split(b'\0') if item for m,p in [item.split(b'\t',1)]}
checks = []
def check(name, ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok: raise AssertionError(name)
base='f1df1bc20b8f5ef06495c50d885b18ce2af73eb1'
original, current = tree(base), tree('HEAD')
changed=[p for p,v in original.items() if current.get(p)!=v]
allowed=['packages/contracts/README.md','packages/contracts/package.json','packages/contracts/package-lock.json']
check('only three approved existing package files changed',sorted(changed)==sorted(allowed))
for lane in ['author','review']:
    manifest=json.loads((packet.parent/lane/'manifest.json').read_text())
    for member in manifest['members']:
        raw=(root/member['path']).read_bytes()
        check('retained '+member['path'],len(raw)==member['bytes'] and hashlib.sha256(raw).hexdigest()==member['sha256'])
source='3a6e3391b8fb3bb8113496c897f997683a27da2d'
for p in git('diff','--name-only',base,source,'--','packages/contracts').decode().splitlines():
    check('exact reviewed package '+p,git('show',source+':'+p)==(root/p).read_bytes())
groups=[]
for label in ['integrated-check','public-pack']:
    receipt=json.loads((packet/(label+'.json')).read_text())
    check('bounded success '+label,receipt['exitCode']==0 and not receipt['timedOut'] and receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'])
    for s in receipt['streams']:
        raw=(root/s['path']).read_bytes()
        check('raw '+s['path'],len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256'])
    try: os.killpg(receipt['ownedPidAndPgid'],0); absent=False
    except ProcessLookupError: absent=True
    check('fresh process group absence '+label,absent);groups.append(receipt['ownedPidAndPgid'])
archive=packet/'capiro-meri-contracts-0.1.1.tgz'
raw=archive.read_bytes();sha=hashlib.sha256(raw).hexdigest()
check('exact independently installed tarball',len(raw)==175627 and sha=='0ca8d0552a2960157ebdf7b8cecf6cacdcda48ef91c475060a54f15192535651')
with tarfile.open(archive) as tar: names=tar.getnames()
check('15 public files only',len(names)==15 and all(n.startswith('package/') and not any(p in n for p in ['commands-0.2','retrieval-0.2','apps/','test/']) for n in names))
result={'source':source,'testedIntegratedHead':'2077d0177a81caae213a6bb7a434cc00008a5c77','base':base,'originalEntries':len(original),'unchangedOriginalEntries':len(original)-len(changed),'authorizedExistingChanges':changed,'tarball':{'path':str(archive.relative_to(root)),'bytes':len(raw),'sha256':sha,'files':names},'ownedGroupsAbsent':groups,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['checks','tarball']}))
