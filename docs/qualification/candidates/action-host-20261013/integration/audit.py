"""Verify exact accepted source, all original entries and retained lane evidence."""
from pathlib import Path
import hashlib,json,os,subprocess
root=Path(__file__).resolve().parents[5]; packet=Path(__file__).resolve().parent
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):return {p.decode():m.decode() for item in git('ls-tree','-rz',ref).split(b'\0') if item for m,p in [item.split(b'\t',1)]}
checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
base='f1df1bc20b8f5ef06495c50d885b18ce2af73eb1'; original=tree(base);current=tree('HEAD')
check('every PR42 original tree entry unchanged',all(current.get(p)==v for p,v in original.items()))
counts={}
for manifest in sorted(packet.parent.glob('*/manifest.json')):
    if manifest.parent==packet:continue
    members=json.loads(manifest.read_text())['members'];counts[manifest.parent.name]=len(members)
    for m in members:
        raw=(root/m['path']).read_bytes();check('retained '+m['path'],len(raw)==m['bytes'] and hashlib.sha256(raw).hexdigest()==m['sha256'])
sources={
'7c67345398aa5422f6c760f009b729d082cfeaea':['apps/control/action-host/index.mjs','apps/control/action-host/current.mjs','apps/control/action-host/resolver.mjs'],
'c581c63764f67a9a7a5ee9090cba9e103aa486d7':['apps/control/action-host/durable/index.mjs'],
'8a3643e3564f676b66edc6b4cc220fb1c4193098':['apps/control/action-host/local/fixture.mjs','apps/control/action-host/local/recovery.mjs','scripts/local-followthrough/host-run.mjs']}
for ref,paths in sources.items():
    for p in paths:check('exact accepted source '+p,git('show',ref+':'+p)==(root/p).read_bytes())
check('final pilot merges are documentation only',not git('diff','1972ef9df1eb78050154896cc1da251185b4df0a','HEAD','--','apps','packages','scripts'))
groups=[]
for label,expected in [('host-cli-first',1),('host-integrated-final',0),('host-cli-final',0)]:
    r=json.loads((packet/(label+'.json')).read_text());check('bounded retained result '+label,r['exitCode']==expected and not r['timedOut'] and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
    for s in r['streams']:
        raw=(root/s['path']).read_bytes();check('raw '+s['path'],len(raw)==s['bytes'] and hashlib.sha256(raw).hexdigest()==s['sha256'])
    try:os.killpg(r['ownedPidAndPgid'],0);absent=False
    except ProcessLookupError:absent=True
    check('fresh owned group absence '+label,absent);groups.append(r['ownedPidAndPgid'])
result={'base':base,'testedHead':'1972ef9df1eb78050154896cc1da251185b4df0a','cliHead':'aa8ed6d633a7fa969d36a392470bc0875d90e2da','originalEntriesUnchanged':len(original),'laneManifestMembers':counts,'acceptedSources':sources,'ownedGroupsAbsent':groups,'passed':len(checks),'failed':0,'checks':checks}
(packet/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['checks','acceptedSources']}))
