#!/usr/bin/env python3
"""Offline exact-tree and source-preservation evidence; no candidate execution."""
import hashlib, json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
BASE='67ccac716bd6cbce4ee04e439a085bab75ae21a5'
SOURCE='fa3f06cc8f23a822a8fc74662187e7d3a7a8144b'
MAPPED='ac9d7cdb1fb870619148a81adb69ab6b7409636d'
PKT=Path(__file__).resolve().parent
checks=[]
def git(*args):return subprocess.check_output(['git','-c','gc.auto=0',*args],cwd=ROOT)
def blob(ref,path):return git('show',ref+':'+path)
def check(name,ok):checks.append({'name':name,'passed':bool(ok)})
def tree(ref):
 result={}
 for entry in git('ls-tree','-r','-z',ref).split(b'\0'):
  if entry:
   meta,path=entry.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
def digest(data):return hashlib.sha256(data).hexdigest()
def after(text,start):return text[text.index(start):]
def between(text,a,b):return text[text.index(a):text.index(b)]
paths=['packages/contracts/retrieval-0.2/operation-contracts.mjs','apps/control/qualified-application/schema-contract.mjs','apps/control/qualified-application/schema-preservation.mjs']
bt,st,mt=tree(BASE),tree(SOURCE),tree(MAPPED)
changed=[p for p in bt if st.get(p)!=bt[p]]
check('all original entries retained',all(p in st for p in bt))
check('only three allocated originals change at source freeze',set(changed)==set(paths))
check('source adds only allocated author control and report',set(st)-set(bt)=={'apps/control/qualified-application/schema-structure.test.mjs','docs/coordination/reports/CODEX-NATIVE-STRUCTURE-20261013.md'})
sources=[]
for p in paths:
 raw=blob(SOURCE,p);sources.append({'path':p,'bytes':len(raw),'sha256':digest(raw),'gitBlob':st[p].split()[-1]})
 check('reviewed source exact '+p,(ROOT/p).read_bytes()==raw)
 check('mapped test commit preserves source '+p,blob(MAPPED,p)==raw)
old=blob(BASE,paths[0]).decode();new=blob(SOURCE,paths[0]).decode()
oldwalker=between(old,'function copyData(value) {','// Private domain validators')
newwalker=between(new,'function copyDataWithLimits(value, limits) {','// Private domain validators')
check('canonical walker exact after private parameter substitution',oldwalker==newwalker.replace('function copyDataWithLimits(value, limits) {','function copyData(value) {').replace('limits.','JSON_LIMITS.'))
check('ordinary fixed wrapper refuses caller-controlled profile','function copyData(value) {\n  return copyDataWithLimits(value, JSON_LIMITS);\n}' in new)
check('ordinary profile unchanged',between(old,'const JSON_LIMITS','function copyData')==between(new,'const JSON_LIMITS','function copyData'))
check('freezeData and operation resolver exact',after(old,'function freezeData(value)')==after(new,'function freezeData(value)'))
check('dedicated profile is fixed 250000 with inherited 64 and 16MiB',"const PRESERVATION_LIMITS = Object.freeze({...JSON_LIMITS, nodes: 250000});" in new)
check('dedicated serialized bound exact 4MiB UTF8',"Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 4 * 1024 * 1024" in new)
check('private configurable walker is not exported',not re.search(r'export[^\n]*(?:copyDataWithLimits|PRESERVATION_LIMITS)',new))
oldc=blob(BASE,paths[1]).decode();newc=blob(SOURCE,paths[1]).decode()
check('migration identities and all admission before boundedRows exact',between(oldc,'export const migrations','function boundedRows')==between(newc,'export const migrations','function boundedRows'))
check('ordinary rows remains 1MiB 1024 through default ordinary snapshot','export function rows(result){return boundedRows(result,1048576,false);}' in newc and 'function boundedRows(result,maxBytes,oneRow,snapshot=data)' in newc and 'r.length<=1024' in newc)
check('preservation decoder exclusively uses fixed profile and one row','return boundedRows(result,4194304,true,snapshotPreservationData)' in newc)
check('catalog admission exact',after(oldc,'export function assertCatalog')==after(newc,'export function assertCatalog'))
oldp=blob(BASE,paths[2]).decode();newp=blob(SOURCE,paths[2]).decode()
expected=oldp.replace("{requireSchema,sha256}","{requireSchema,sha256,preservationData}").replace('const metadata=data(own(r.metadata,metadataFields))','const metadata=preservationData(own(r.metadata,metadataFields))')
check('preservation SQL and complete digest logic exact except fixed snapshot call',newp==expected)
check('all twelve metadata fields retained',"const metadataFields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];" in newp)
# Everything outside the three changed files is established by full tree identities.
protected=[p for p in bt if (p.endswith('.sql') and '/migrations/' in p) or p.startswith('packages/contracts/0.1/') or p in ['apps/control/qualified-application/schema.mjs','apps/control/qualified-application/lifecycle.mjs','apps/gateway/budget/postgres-budget-store.mjs','packages/runtime/operation-lifetime.mjs']]
check('migration public deadline transaction and lifecycle protected files exact',all(bt[p]==st[p] for p in protected))
migrations=re.findall(r"\['[^']+','([^']+\.sql)','([a-f0-9]{64})'\]",newc)
check('exact six migration digests',len(migrations)==6 and all(digest(blob(SOURCE,p))==h for p,h in migrations))
owner=blob(SOURCE,'apps/control/qualified-application/schema.mjs').decode()
check('exact query identity selects preservation decoder',"(text===preservationSQL?preservationRows:rows)(result)" in owner)
check('large metadata is reduced to digest before ordinary receipt','metadataSha256:sha256(JSON.stringify({namespaces,metadata}))' in newp and 'return data({namespaceCount:' in newp and 'life.check();return data(receipt)' in owner)
expected_tests=['apps/control/qualified-application/schema-size-independent.test.mjs','apps/control/qualified-application/schema-size-inventory.test.mjs','apps/control/qualified-application/schema-size.test.mjs']
check('exact three test-only mappings',set(p for p in st if st[p]!=mt.get(p))==set(expected_tests) and set(st)==set(mt))
for p in expected_tests:
 a=blob(SOURCE,p).decode();b=blob(MAPPED,p).decode()
 if p.endswith('inventory.test.mjs'):
  expected=a.replace('at100000 nodes; next node refuses','at100000 nodes;100001 now passes and250001 refuses').replace(' const denied=scripted(options);'," const accepted=scripted(options);assert.equal((await prepareOwnedApplicationSchema(accepted.args())).status,'PASS');assert.equal(accepted.log.filter(q=>ddl.includes(q.text)).length,6);assert.equal(accepted.state.commits,1);\n tail.structuralOverflow=Array(149999).fill(null);assert.equal(nodes(rows),250001);assert(bytes(rows)<4194304);\n const denied=scripted(options);")
 else:expected=a.replace('length:100001','length:250001').replace('Array(100001)','Array(250001)')
 check('bound-specific mapping keeps all other assertions '+p,b==expected)
for name,passed,failed in [('baseline',0,2),('downstream-before',0,1),('candidate',49,0)]:
 r=json.loads((PKT/(name+'.json')).read_text());output=(PKT/(name+'.stdout.bin')).read_text()
 check(name+' raw stream identities',all((ROOT/s['path']).stat().st_size==s['bytes'] and digest((ROOT/s['path']).read_bytes())==s['sha256'] for s in r['streams']))
 check(name+' expected counts',bool(re.search(r'(?:pass |passed )'+str(passed)+r'\b',output)) and bool(re.search(r'(?:fail |failed )'+str(failed)+r'\b',output)))
 check(name+' exact source capture and physical exit',r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and not r['timedOut'])
report={'schema':'meri.native-structure-independent-source-audit/1','base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'testedHead':json.loads((PKT/'candidate.json').read_text())['sourceHead'],'testedTree':git('rev-parse','7ca187a0^{tree}').decode().strip(),'testMapping':MAPPED,'originalEntries':len(bt),'unchangedOriginalEntries':len(bt)-len(changed),'changedOriginalPaths':changed,'protectedEntries':len(protected),'sources':sources,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'runtimeQualified':False,'nativeExecution':False}
(PKT/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'originals':len(bt),'changed':len(changed),'source':SOURCE}))
raise SystemExit(bool(report['failed']))
