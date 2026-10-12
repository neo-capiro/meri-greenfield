"""Offline metadata/byte verification only; no source execution or host probes."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
checks=[]
def check(ok,name):
    checks.append({'name':name,'ok':bool(ok)})
def digest(data):return hashlib.sha256(data).hexdigest()
manifest=json.loads((evidence/'manifest.json').read_text())
for member in manifest['members']:
    path=root/member['path']; raw=path.read_bytes()
    check(len(raw)==member['bytes'] and digest(raw)==member['sha256'],member['path'])
receipt=json.loads((evidence/'source-preservation.json').read_text())
base,freeze=receipt['base'],receipt['sourceFreeze']
def tree(ref):
    return {line.split('\t',1)[1]:line.split()[2] for line in subprocess.check_output(['git','ls-tree','-r',ref],cwd=root,text=True).splitlines()}
a,b=tree(base),tree(freeze)
check(len(a)==receipt['originalFiles'],'original count')
check(all(b.get(p)==oid for p,oid in a.items()),'all original Git objects unchanged')
check(receipt['originalChangedOrDeleted']==[],'no original mutation recorded')
check(set(b)-set(a)=={s['path'] for s in receipt['added']},'only allocated three source additions')
check(len(receipt['added'])==3,'source addition count')
for member in receipt['added']:
    raw=subprocess.check_output(['git','show',f"{freeze}:{member['path']}"],cwd=root)
    check(digest(raw)==member['sha256'] and len(raw)==member['bytes'],'source freeze '+member['path'])
    check((root/member['path']).read_bytes()==raw,'working source '+member['path'])
refs=json.loads((evidence/'reference-identities.json').read_text())['references']
check(len(refs)==3,'three directly relevant references')
for ref in refs:
    check(ref['unchanged'] and ref['pinnedBlob']==ref['observedBlob'] and len(ref['sha256'])==64,'reference identity '+ref['path'])
for label in ['focused-initial','root-source-check','public-distribution']:
    r=json.loads((evidence/f'{label}.json').read_text())
    check(r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'],'owned command '+label)
    for stream in r['streams']:
        raw=(root/stream['path']).read_bytes();check(len(raw)==stream['bytes'] and digest(raw)==stream['sha256'],'raw stream '+stream['path'])
    check(r['captureSha256']==digest((evidence/'capture-reaped.py').read_bytes()),'capture identity '+label)
    if label=='focused-initial':
        raw=(evidence/'focused-initial-source.patch').read_bytes();check(digest(raw)==r['sourceDiffSha256'] and len(raw)==r['sourceDiffBytes'],'initial staged source bytes')
    else:check(r['sourceHead']==freeze and r['sourceDiffBytes']==0,'clean exact source '+label)
result={'scope':'OFFLINE_SOURCE_PACKET_ONLY','passed':sum(c['ok'] for c in checks),'failed':sum(not c['ok'] for c in checks),'checks':checks}
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['failed']==0 else 1)
