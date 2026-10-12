"""Audit public source identity, preserved base and review captures; no target execution."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path.cwd(); evidence=Path(__file__).resolve().parent
source=sys.argv[1];base='01c75641b62bb586d130feda3468c0ddb4286e8f'
checks=[]
def check(name,ok): checks.append({'name':name,'passed':bool(ok)})
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
check('exact source pin',len(source)==40 and all(x in '0123456789abcdef' for x in source))
source_paths=['packages/contracts/retrieval-0.2/'+x for x in ['bill-text.schema.json','bill-text-validation.mjs','bill-text-cursor.mjs','congressional-identity.mjs']]+['packages/contracts/test/retrieval-bill-text.test.mjs']
changed=git('diff','--name-only',base,source).decode().splitlines()
check('only five allocated additive source files',set(changed)==set(source_paths))
check('every original tracked file preserved',not git('diff','--name-only','--diff-filter=MDRCTU',base,source))
for path in source_paths:check(path+': exact reviewed bytes',(root/path).read_bytes()==git('show',source+':'+path))
check('canonical shared helper dependency unchanged',git('show',source+':'+source_paths[3])==git('show','621346846:'+source_paths[3]))
schema=json.loads((root/source_paths[0]).read_text());check('private schema namespace',schema['$id']=='urn:meri:retrieval:bill-text:0.2.0')
check('schemas use closed envelopes',all(d.get('additionalProperties') is False for n,d in schema['$defs'].items() if d.get('type')=='object'))
for name in ['CongressBillSearchInput','BillTextReadInput']:
 check(name+': no model authority fields',not {'tenantId','actorId','defaultCongress','currentPointer'}.intersection(schema['$defs'][name]['properties']))
validator=(root/source_paths[1]).read_text();cursor=(root/source_paths[2]).read_text()
check('single canonical resolver imported',"from './congressional-identity.mjs'" in validator)
check('canonical JSON snapshot imported in both modules',all("from './operation-contracts.mjs'" in s for s in [validator,cursor]))
for text,name in [(validator,'validator'),(cursor,'cursor')]:
 check(name+': no I/O or SDK imports',not any(x in text for x in ['node:fs','node:child_process','@anthropic-ai','@capiro','node:http','node:net','pg\'','fetch(']))
for flag in ['sourceConnected:false','producerQualified:false','absenceEvidence:false','currentPointerQualified:false']:
 check('unavailable metadata '+flag,flag in validator)
receipt_count=0
for p in sorted(evidence.glob('*.json')):
 j=json.loads(p.read_text())
 if not isinstance(j,dict) or 'streams' not in j:continue
 receipt_count+=1
 check(p.name+': bounded clean source-only process',j['ownedProcessGroupAbsent'] and not j['timedOut'] and j['scope']=='LOCAL_SOURCE_ONLY_NOT_RUNTIME_ADMISSION')
 for stream in j['streams']:
  data=(root/stream['path']).read_bytes();check(p.name+': '+stream['path'].split('.')[-2]+' byte identity',len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
result={'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'scope':'SOURCE_AND_EVIDENCE_ONLY','receiptCount':receipt_count,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks}
print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
