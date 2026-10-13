"""Read-only Git/source/packet audit; no target imports, SQL, or services."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[5]
out=Path(__file__).resolve().parent
base='3d34bf42983824327c63f96419abcfea8a587407'
initial='20b474036039ec8c15f983d0d6e01d064aef2448'
source,packet=sys.argv[1:]
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def blob(rev,path):return git('show',f'{rev}:{path}')
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(rev):
 return {entry.split(b'\t',1)[1].decode():entry.split(b'\t',1)[0].decode() for entry in git('ls-tree','-rz',rev).split(b'\0') if entry}
checks=[]
def check(name,condition):checks.append({'name':name,'passed':bool(condition)})
bt,st,pt=tree(base),tree(source),tree(packet)
changed=[p for p,v in bt.items() if st.get(p)!=v]
check('all base entries unchanged at source',not changed)
check('all base entries unchanged at packet',all(pt.get(p)==v for p,v in bt.items()))
files=['apps/control/qualified-application/'+n for n in ['schema.mjs','schema-contract.mjs','schema.test.mjs','schema.fixture.mjs']]
for p in files:
 check('source equals packet '+p,blob(source,p)==blob(packet,p))
 check('source equals review checkout '+p,blob(source,p)==(root/p).read_bytes())
contract=blob(source,files[1]).decode()
migrations=re.findall(r"\['([^']+)','([^']+\.sql)','([a-f0-9]{64})'\]",contract)
check('exact six pinned migration declarations',len(migrations)==6)
for name,p,h in migrations:
 check('unchanged migration '+name,blob(base,p)==blob(source,p)==blob(packet,p))
 check('migration digest '+name,sha(blob(source,p))==h)
a=blob(initial,files[0]);b=blob(source,files[0]);old=b"nspname NOT LIKE 'pg_%'";new=b"left(nspname,3)<>'pg_'"
check('namespace repair is only installer production delta',old in a and b==a.replace(old,new))
check('schema contract unchanged',blob(initial,files[1])==blob(source,files[1]))
old_tests=blob(initial,files[2]);new_tests=blob(source,files[2]);marker=b'const ddls='
check('all original author assertion section preserved byte-for-byte',new_tests[new_tests.index(marker):].startswith(old_tests[old_tests.index(marker):]))
old_fixture=old_tests[old_tests.index(b'const root='):old_tests.index(marker)]
new_fixture=blob(source,files[3]);new_fixture=new_fixture[new_fixture.index(b'const root='):new_fixture.index(b'\nexport {')].rstrip()+b'\n'
check('fixture extraction only approved descriptor override',new_fixture==old_fixture.replace(b'const f=fixture(),',b'const f=fixture(options.fixture),'))
check('product schema does not import scripted fixture',b'schema.fixture' not in b)
text=b.decode()
check('canonical transaction owner reused',"new PostgresBudgetStore(pool)" in text and "from '../../gateway/budget/postgres-budget-store.mjs'" in text)
check('canonical lifetime owner reused',"from '../../../packages/runtime/operation-lifetime.mjs'" in text)
check('explicit catalog namespace queries',all(x in text for x in ['pg_catalog.pg_namespace','pg_catalog.pg_class','pg_catalog.pg_constraint','pg_catalog.pg_attribute','pg_catalog.pg_index']))
check('fixed qualified accounting query',"FROM meri_qualification.budget" in text)
check('retained full definition digest comparison',"schemaSha256===f.schemaSha256" in text and "JSON.stringify({migrationSha256,catalog})" in text)
check('receipt labels source observation not qualification',"runtimeQualified:false,poolClosed:false" in text and "evidenceKind:'borrowed-pool-catalog-observation'" in text)
check('no reset retry or borrowed shutdown',not re.search(r'\b(?:DROP|TRUNCATE)\b|pool\.end\s*\(|\bretry\s*\(',text))
prefix='docs/qualification/candidates/qualified-application-20261013/schema-author/'
manifest_path=prefix+'manifest.json'
manifest_bytes=blob(packet,manifest_path);manifest=json.loads(manifest_bytes)
check('author manifest binds exact source',manifest['source']==source)
for member in manifest['members']:
 data=blob(packet,member['path']);check('author manifest '+member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
check('author manifest unique members',len({m['path'] for m in manifest['members']})==len(manifest['members']))
listed={m['path'] for m in manifest['members']}
check('author evidence fully manifested',all(p in listed for p in pt if p.startswith(prefix) and p!=manifest_path))
source_ids={p:{'bytes':len(blob(source,p)),'sha256':sha(blob(source,p))} for p in files}
for capture in sorted(out.glob('*.json')):
 if capture.name in ['audit.json','manifest.json']:continue
 try:r=json.loads(capture.read_text())
 except (ValueError,UnicodeError):continue
 if 'ownedPidAndPgid' not in r:continue
 check('capture empty source diff '+capture.name,r['sourceDiffBytes']==0)
 check('capture owned group absent '+capture.name,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  data=(root/stream['path']).read_bytes();check('capture stream '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
result={'schema':'meri.qualification-schema-independent-audit/1','base':base,'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'authorPacket':packet,'authorPacketTree':git('rev-parse',packet+'^{tree}').decode().strip(),'authorManifestSha256':sha(manifest_bytes),'originalEntries':len(bt),'changedOriginalEntries':changed,'sourceIdentities':source_ids,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'runtime':'UNRUN; scripted ports are not a database or native qualification'}
(out/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(bool(result['failed']))
