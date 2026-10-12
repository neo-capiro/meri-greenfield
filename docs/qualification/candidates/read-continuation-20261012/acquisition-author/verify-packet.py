"""Offline source/packet verification; no external or native execution."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent
checks=[]
def check(ok,name):checks.append({'name':name,'ok':bool(ok)})
def digest(raw):return hashlib.sha256(raw).hexdigest()
manifest=json.loads((ev/'manifest.json').read_text())
for item in manifest['members']:
 raw=(root/item['path']).read_bytes();check(len(raw)==item['bytes'] and digest(raw)==item['sha256'],item['path'])
preservation=json.loads((ev/'source-preservation.json').read_text());base=preservation['base'];freeze=preservation['sourceFreeze'];initial=preservation['initialSourceFreeze']
def tree(ref):return {line.split('\t',1)[1]:line.split()[2] for line in subprocess.check_output(['git','ls-tree','-r',ref],cwd=root,text=True).splitlines()}
a,b=tree(base),tree(freeze)
check(len(a)==preservation['originalFiles'],'original count')
check(all(b.get(p)==oid for p,oid in a.items()),'all original blobs unchanged')
check(preservation['originalChangedOrDeleted']==[],'no original mutation declared')
check(set(b)-set(a)=={s['path'] for s in preservation['added']},'exact new allocated source paths')
check(len(preservation['added'])==3,'three source additions')
for item in preservation['added']:
 raw=subprocess.check_output(['git','show',f"{freeze}:{item['path']}"],cwd=root)
 check(digest(raw)==item['sha256'] and len(raw)==item['bytes'],'frozen source '+item['path'])
 check((root/item['path']).read_bytes()==raw,'working source '+item['path'])
refs=json.loads((ev/'reference-identities.json').read_text())['references']
check(len(refs)==8,'eight source references')
check(sum(not r['unchanged'] for r in refs)==3,'three current drift references')
for ref in refs:
 check(ref['frozenBlob']==ref['blob'] and ref['currentBlob']==ref['observedBlob'] and ref['frozenSha256']==ref['sha256'],'reference '+ref['path'])
 check(ref['unchanged']==(ref['frozenBlob']==ref['currentBlob']),'drift flag '+ref['path'])
revision=json.loads((ev/'scope-revision-current-policy.json').read_text())
check(all(keys==['actorRole'] for keys in revision['contextKeys'].values()),'both contexts current role')
check(revision['producerPolicyPin']=='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace','current policy pin')
check(revision['inventoryPin']=='fd8765ec01d292013758606204f2c9d886cd31c1','historical inventory pin')
for label in ['focused-initial','root-source-check','public-distribution','alias-repair-focused','repaired-root-check']:
 r=json.loads((ev/f'{label}.json').read_text());check(r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'],'owned capture '+label)
 for item in r['streams']:
  raw=(root/item['path']).read_bytes();check(digest(raw)==item['sha256'] and len(raw)==item['bytes'],'raw '+item['path'])
 check(r['captureSha256']==digest((ev/'capture-reaped.py').read_bytes()),'capture identity '+label)
 if label in ['focused-initial','alias-repair-focused']:
  patch=ev/('focused-initial-source.patch' if label=='focused-initial' else 'alias-repair-source.patch');raw=patch.read_bytes();check(digest(raw)==r['sourceDiffSha256'] and len(raw)==r['sourceDiffBytes'],'staged patch '+label)
 else:check(r['sourceDiffBytes']==0 and r['sourceHead']==(freeze if label=='repaired-root-check' else initial),'clean capture '+label)
repair=json.loads((ev/'alias-repair.json').read_text());check(repair['initialSourceFreeze']==initial and repair['repairFreeze']==freeze,'repair/failure lineage')
result={'scope':'OFFLINE_SOURCE_PACKET_ONLY','passed':sum(c['ok'] for c in checks),'failed':sum(not c['ok'] for c in checks),'checks':checks}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['failed']==0 else 1)
