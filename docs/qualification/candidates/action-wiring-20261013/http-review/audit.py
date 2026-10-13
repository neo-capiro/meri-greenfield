"""Read-only source/packet verification, no application or external service import."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
BASE='f1a075e2eb6c63ee8b1785ad9a94f552a98f45f8'
SOURCE='2c8b793569c9a4b19db5a939909fbefdb8ac3ca8'
AUTHOR=sys.argv[1]
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def blob(ref,p):return git('show',f'{ref}:{p}')
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-r','-z',ref).split(b'\0') if r}
checks=[]
def check(label,value):checks.append({'name':label,'pass':bool(value)})
original=tree(BASE)
for ref in [SOURCE,AUTHOR,'HEAD']:
    current=tree(ref);check(f'all original entries identical at {ref}',all(current.get(p)==v for p,v in original.items()))
identities=[]
for p in ['apps/control/action-application/node-http.mjs','scripts/local-followthrough/http-run.mjs']:
    name=p;b=blob(SOURCE,p)
    check('exact tested/author source '+name,b==(ROOT/p).read_bytes()==blob(AUTHOR,p))
    identities.append({'path':p,'bytes':len(b),'sha256':sha(b)})
added=[p for p in tree(AUTHOR) if p not in original and p.startswith(('apps/','packages/','scripts/'))]
check('only allocated bridge/CLI production and author test added',set(added)=={'apps/control/action-application/node-http.mjs','apps/control/action-application/http.test.mjs','scripts/local-followthrough/http-run.mjs'})
catalog=json.loads(blob(SOURCE,'packages/contracts/retrieval-0.2/catalog.json'))
check('all97 remain unavailable',len(catalog['operations'])==97 and all(o['handler'] is None and o['availability']=='unimplemented' and o['qualification']=='pending' for o in catalog['operations']))
check('scope139/96/43 preserved',len(catalog['originals'])==139 and sum(o['disposition']=='selected' for o in catalog['originals'])==96 and sum(o['disposition']=='deferred' for o in catalog['originals'])==43)
manifest_path='docs/qualification/candidates/action-wiring-20261013/http-author/manifest.json'
mb=blob(AUTHOR,manifest_path);manifest=json.loads(mb)
for member in manifest['members']:
    b=blob(AUTHOR,member['path']);check('author member '+member['path'],len(b)==member['bytes'] and sha(b)==member['sha256'])
captures=[]
for name,passed,failed in [('initial',8,2),('header-count-before',1,0),('final',11,0),('cli',1,0)]:
    r=json.loads((HERE/f'{name}.json').read_text())
    for s in r['streams']:
        b=(ROOT/s['path']).read_bytes();check('exact raw stream '+s['path'],len(b)==s['bytes'] and sha(b)==s['sha256'])
    text=(HERE/f'{name}.stdout.bin').read_text();check('counts '+name,f'pass {passed}\n' in text and f'fail {failed}\n' in text)
    check('capture bounds/cleanup '+name,r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    absent=False
    try:os.killpg(r['ownedPidAndPgid'],0)
    except ProcessLookupError:absent=True
    check('fresh owned group absence '+name,absent)
    captures.append({'label':name,'passed':passed,'failed':failed,'pgid':r['ownedPidAndPgid'],'freshlyAbsent':absent})
out={'decision':'PASS' if all(c['pass'] for c in checks) else 'FAIL','base':BASE,'source':SOURCE,'authorPacket':AUTHOR,'originalEntries':len(original),'production':identities,'authorManifestMembers':len(manifest['members']),'authorManifestSha256':sha(mb),'captures':captures,'passed':sum(c['pass'] for c in checks),'total':len(checks),'checks':checks,'runtime':'Real ephemeral loopback HTTP only; SQL/native/provider/deployment UNRUN / HOLD'}
print(json.dumps(out,indent=2));raise SystemExit(0 if out['decision']=='PASS' else 1)
