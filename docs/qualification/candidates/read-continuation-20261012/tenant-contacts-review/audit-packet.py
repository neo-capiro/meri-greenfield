"""Independent immutable source/manifest/receipt audit; no target imports."""
from pathlib import Path
from functools import lru_cache
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='a3e946c1fa264ae7b33205f5b87804ee1ef75773';SOURCE='0aba55ef096a68a3cfd92f770783dec3fddfea22'
INITIAL='15969416f8ba0b6f4cc9b6bb44237946a3a38ab7';PACKET='62aafb3ad8bef0bc6520c82ed3bb6ff2a75a630c'
PREFIX='docs/qualification/candidates/read-continuation-20261012/tenant-contacts-author/';REPORT='docs/coordination/reports/CODEX-TENANT-CONTACTS-AUTHOR-20261012.md'
checks=[]
def check(name,ok):checks.append({'name':name,'pass':bool(ok)})
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(c,p):return git('show',c+':'+p)
def data(c,p):return json.loads(blob(c,p))
@lru_cache(maxsize=None)
def tree(c):return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',c).decode().splitlines()}
files=['packages/contracts/retrieval-0.2/tenant-contacts.schema.json','packages/contracts/retrieval-0.2/tenant-contacts-validation.mjs','packages/contracts/test/retrieval-tenant-contacts.test.mjs']
a,b=tree(BASE),tree(SOURCE)
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='2a84b8964b23b4ebd178bfe619376680b9a21f6f')
check('all6110 original blobs unchanged',len(a)==6110 and all(b.get(p)==v for p,v in a.items()))
check('only three new product paths and author report',set(b)-set(a)==set(files+[REPORT]))
check('review working source matches candidate',all((ROOT/p).read_bytes()==blob(SOURCE,p) for p in files))
for c in [INITIAL,PACKET]:check('packet product source unchanged:'+c,all(tree(c)[p]==b[p] for p in files) and all(tree(c).get(p)==v for p,v in a.items()))
changed=set(git('diff','--name-only',INITIAL,PACKET).decode().splitlines());check('clarification report/manifest only',changed=={REPORT,PREFIX+'manifest.json'})
identities=[]
for p in files:
 bs=blob(SOURCE,p);identities.append({'path':p,'blob':b[p],'bytes':len(bs),'sha256':sha(bs)})
manifest_identities=[]
for commit in [INITIAL,PACKET]:
 mb=blob(commit,PREFIX+'manifest.json');manifest=json.loads(mb);members=manifest['files'];manifest_identities.append({'commit':commit,'bytes':len(mb),'sha256':sha(mb),'members':len(members)})
 check('14 safe unique author members:'+commit,len(members)==14 and len({r['path'] for r in members})==14 and all(not Path(r['path']).is_absolute() and '..' not in Path(r['path']).parts for r in members))
 for member in members:
  value=blob(commit,member['path']);check('author member:'+commit[:8]+':'+member['path'],len(value)==member['bytes'] and sha(value)==member['sha256'])
 actual={p for p in tree(commit) if p.startswith(PREFIX) and p!=PREFIX+'manifest.json'}|{REPORT}
 check('exact packet membership:'+commit,actual=={r['path'] for r in members})
check('latest manifest preserves initial packet identity',data(PACKET,PREFIX+'manifest.json')['preservedInitialPacket']==INITIAL)
tested=data(INITIAL,PREFIX+'initial-tested-source.json')
check('initial untracked test source identities cover exact three files',{r['path'] for r in tested['files']}==set(files))
for member in tested['files']:
 bs=blob(SOURCE,member['path']);check('explicit initially tested identity:'+member['path'],len(bs)==member['bytes'] and sha(bs)==member['sha256'])
for name in ['initial-focused','metadata-audit']:
 receipt=data(INITIAL,PREFIX+name+'.json')
 check('author bounded exit:'+name,receipt['exitCode']==0 and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'] and receipt['durationSeconds']<120)
 check('author capture source state:'+name,receipt['sourceHead']==BASE and receipt['sourceDiffBytes']==0 and receipt['sourceDiffSha256']==sha(b''))
 check('author same subreaper:'+name,receipt['captureSha256']==sha(blob(INITIAL,PREFIX+'capture-reaped.py'))==sha((HERE/'capture-reaped.py').read_bytes()))
 for stream in receipt['streams']:
  bs=blob(INITIAL,stream['path']);check('author raw stream:'+stream['path'],len(bs)==stream['bytes'] and sha(bs)==stream['sha256'])
stdout=blob(INITIAL,PREFIX+'initial-focused.stdout.bin').decode();check('author actual26/26','ℹ tests 26\n' in stdout and 'ℹ pass 26\n' in stdout and 'ℹ fail 0\n' in stdout)
ref=json.loads((HERE/'reference-audit-with-notes.json').read_text());check('independent33 metadata assertions pass',ref['checks']==ref['passed']==33 and ref['failed']==0)
author_refs=data(INITIAL,PREFIX+'reference-identities.json')['references'];by_path={r['path']:r for r in ref['references']}
for item in author_refs:
 check('author reference independently pinned:'+item['path'],all(by_path[item['path']]['frozen'][k]==item['pinned'][k] and by_path[item['path']]['observed'][k]==item['observed'][k] for k in ['blob','bytes','sha256']))
for label,count in [('independent-first',33),('independent-date-boundary',34)]:
 r=json.loads((HERE/(label+'.json')).read_text())
 check('independent exact product source:'+label,all(tree(r['sourceHead'])[p]==b[p] for p in files) and r['sourceDiffBytes']==0 and r['sourceDiffSha256']==sha(b''))
 check('independent bounded owned exit:'+label,r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and r['durationSeconds']<120)
 for stream in r['streams']:
  bs=(ROOT/stream['path']).read_bytes();check('independent raw stream:'+stream['path'],len(bs)==stream['bytes'] and sha(bs)==stream['sha256'])
 out=(ROOT/r['streams'][0]['path']).read_text();check('independent actual count:'+label,f'ℹ tests {count}\n' in out and f'ℹ pass {count}\n' in out and 'ℹ fail 0\n' in out)
code=blob(SOURCE,files[1]).decode();check('sole canonical JSON import',[l for l in code.splitlines() if l.startswith('import ')]==["import {snapshotOperationData} from './operation-contracts.mjs';"])
check('no network/native/dynamic module owner in family',not any(x in code for x in ['fetch(', 'require(', 'import(', 'process.', 'child_process', 'readFile', 'writeFile']))
result={'source':SOURCE,'sourceTree':'2a84b8964b23b4ebd178bfe619376680b9a21f6f','base':BASE,'initialPacket':INITIAL,'finalPacket':PACKET,'sourceIdentities':identities,'manifestIdentities':manifest_identities,'originalBlobsPreserved':6110,'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks,'scope':'SOURCE_ONLY_NOT_CURRENT_AUTHORITY_OR_RUNTIME'}
print(json.dumps(result,indent=2));raise SystemExit(1 if result['failed'] else 0)
