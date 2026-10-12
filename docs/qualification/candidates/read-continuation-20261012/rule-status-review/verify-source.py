"""Independent source/reference audit; only data reads and Git object access."""
import pathlib,json,hashlib,subprocess,re
root=pathlib.Path(__file__).resolve().parents[5];d=pathlib.Path(__file__).resolve().parent;author=d.parent/'rule-status-author'
BASE='4566cef6417428d46274a14f7937ca11df66ae9d';SOURCE='95442b40d006e48e2215d6acec09fd7f029a2b9b';PACKET='86c701c87f36b4b42d8923a53b190e1a2213ce70';checks=[]
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
def check(name,ok):
 checks.append({'check':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
originals=set(git('ls-tree','-r','--name-only',BASE).decode().splitlines());changed=set(git('diff','--name-only',BASE).decode().splitlines());check('all original files preserved',not(originals&changed))
sourcefiles=['packages/contracts/retrieval-0.2/rule-status.schema.json','packages/contracts/retrieval-0.2/rule-status-validation.mjs','packages/contracts/test/retrieval-rule-status.test.mjs'];identities=[]
for p in sourcefiles:
 raw=(root/p).read_bytes();check(p+' exact source freeze',raw==git('show',f'{SOURCE}:{p}'));check(p+' packet has unchanged source',raw==git('show',f'{PACKET}:{p}'));identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
refs=json.loads((author/'reference-identities.json').read_text())['references'];source_repo='/workspace/capirov2'
for row in refs:
 for v in row['versions']:
  raw=git('show',f'{v["commit"]}:{row["path"]}',cwd=source_repo);blob=git('rev-parse',f'{v["commit"]}:{row["path"]}',cwd=source_repo).decode().strip()
  check(row['path']+':'+v['commit'][:7],len(raw)==v['bytes'] and hashlib.sha256(raw).hexdigest()==v['sha256'] and blob==v['blob'])
 check(row['path']+' no drift',row['versions'][0]['blob']==row['versions'][1]['blob'] and row['unchanged'])
schema=json.loads((root/sourcefiles[0]).read_text());prior_defs=set()
for p in (root/'packages/contracts/retrieval-0.2').glob('*.schema.json'):
 if p.name!='rule-status.schema.json':prior_defs.update(json.loads(p.read_text()).get('$defs',{}))
check('new schema definitions do not collide',not(prior_defs&set(schema['$defs'])))
manifest=json.loads((author/'manifest.json').read_text());check('author manifest declares17 members',len(manifest['members'])==manifest['memberCount']==17)
for row in manifest['members']:
 b=(root/row['path']).read_bytes();check('author manifest '+row['path'],len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
for label in ['independent-first','full-root','public-distribution','policy-audit','policy-audit-corrected']:
 receipt=json.loads((d/(label+'.json')).read_text());check(label+' owned group absent',receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
 for row in receipt['streams']:
  b=(root/row['path']).read_bytes();check(row['path']+' exact stream',len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'])
check('source module has one shared inert admission owner', "import {snapshotOperationData} from './operation-contracts.mjs'" in (root/sourcefiles[1]).read_text())
check('public/canonical registry/locks unchanged',not git('diff',BASE,'--','packages/contracts/meri.schema.json','packages/contracts/dist','packages/contracts/generate.mjs','packages/contracts/package.json','packages/contracts/package-lock.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/operation-registry.mjs','package.json','package-lock.json'))
print(json.dumps({'verdict':'PASS_SOURCE_AUDIT_ONLY','base':BASE,'source':SOURCE,'packet':PACKET,'passed':len(checks),'failed':0,'originalsPreserved':len(originals),'referenceFiles':len(refs),'authorManifestMembers':len(manifest['members']),'sourceFiles':identities,'checks':checks,'runtimeAccepted':False},indent=2))
