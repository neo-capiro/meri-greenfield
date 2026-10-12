"""Independent source/reference audit; only data reads and Git object access."""
import pathlib,json,hashlib,subprocess,re
root=pathlib.Path(__file__).resolve().parents[5];d=pathlib.Path(__file__).resolve().parent;author=d.parent/'legislative-directory-author'
BASE='2aa0a33bdaf36af1224cfdb840bc493e53cea9f3';SOURCE='c511b4bf6ee3f30674f3bd7badae79df82a61aab';PACKET='62a9f7e3c71d12a2e9e6e3ad4b9d361f3be9d257';checks=[]
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
def check(name,ok):
 checks.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
originals=set(git('ls-tree','-r','--name-only',BASE).decode().splitlines());changed=set(git('diff','--name-only',BASE).decode().splitlines());check('all original files preserved',not(originals&changed))
sourcefiles=['packages/contracts/retrieval-0.2/legislative-directory.schema.json','packages/contracts/retrieval-0.2/legislative-directory-validation.mjs','packages/contracts/test/retrieval-legislative-directory.test.mjs'];identities=[]
for p in sourcefiles:
 raw=(root/p).read_bytes();check(p+' exact source freeze',raw==git('show',f'{SOURCE}:{p}'));check(p+' packet has unchanged source',raw==git('show',f'{PACKET}:{p}'));identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
oldtest=git('show','04a93406727998e2eda945ff2223b38f881ea4ef:'+sourcefiles[2]);check('original author test prefix untouched', (root/sourcefiles[2]).read_bytes().startswith(oldtest))
refs=json.loads((author/'reference-identities.json').read_text())['references'];source_repo='/workspace/capirov2'
for row in refs:
 for v in row['versions']:
  raw=git('show',f'{v["commit"]}:{row["path"]}',cwd=source_repo);blob=git('rev-parse',f'{v["commit"]}:{row["path"]}',cwd=source_repo).decode().strip()
  check(row['path']+':'+v['commit'][:7],len(raw)==v['bytes'] and hashlib.sha256(raw).hexdigest()==v['sha256'] and blob==v['blob'])
 check(row['path']+' no drift',row['versions'][0]['blob']==row['versions'][1]['blob'] and row['unchanged'])
schema=json.loads((root/sourcefiles[0]).read_text());raw=git('show','fd8765ec01d292013758606204f2c9d886cd31c1:packages/shared/src/us-states.ts',cwd=source_repo).decode();pairs=dict(re.findall(r"\b([A-Z]{2}):\s*['\"]([^'\"]+)['\"]",raw));check('exact56 state vocabulary values',len(pairs)==56 and pairs==schema['$defs']['DirectoryStateNames']['const'])
prior_defs=set()
for p in (root/'packages/contracts/retrieval-0.2').glob('*.schema.json'):
 if p.name!='legislative-directory.schema.json':prior_defs.update(json.loads(p.read_text()).get('$defs',{}))
check('new schema definitions do not collide',not(prior_defs&set(schema['$defs'])))
manifest=json.loads((author/'manifest.json').read_text());check('author manifest declares23 members',len(manifest['members'])==manifest['memberCount']==23)
for row in manifest['members']:
 b=(root/row['path']).read_bytes();check('author manifest '+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
for label in ['independent-first','independent-corrected','full-root','public-distribution','public-distribution-corrected']:
 receipt=json.loads((d/(label+'.json')).read_text());check(label+' owned group absent',receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
 for row in receipt['streams']:
  b=(root/row['path']).read_bytes();check(row['path']+' exact stream',len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
check('source module has one shared inert admission owner', "import {snapshotOperationData} from './operation-contracts.mjs'" in (root/sourcefiles[1]).read_text())
check('public/canonical registry/locks unchanged',not git('diff',BASE,'--','packages/contracts/meri.schema.json','packages/contracts/dist','packages/contracts/generate.mjs','packages/contracts/package.json','packages/contracts/package-lock.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/operation-registry.mjs','package.json','package-lock.json'))
print(json.dumps({'verdict':'PASS_SOURCE_AUDIT_ONLY','base':BASE,'source':SOURCE,'packet':PACKET,'passed':len(checks),'failed':0,'originalsPreserved':len(originals),'referenceFiles':len(refs),'authorManifestMembers':len(manifest['members']),'sourceFiles':identities,'checks':checks,'runtimeAccepted':False},indent=2))
