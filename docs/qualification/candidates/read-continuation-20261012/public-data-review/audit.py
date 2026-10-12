"""Read-only source/reference audit; private reference bodies never emitted."""
from pathlib import Path
import hashlib,json,re,subprocess
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
private_repo=root.parent/'capirov2'
source='31093cd5b6aaaf246a870eb4f473a6639cc2a7df'
base='e94865529c5a1e97c79893527895f0b4b73be35f'
checks=[]
def check(name, condition):
 checks.append({'name':name,'passed':bool(condition)})
def git(*args, cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
refs=json.loads((evidence/'reference-identities.json').read_bytes())
for entry in refs['references']:
 locator=refs['frozenCommit']+':'+entry['path']
 body=git('show',locator,cwd=private_repo)
 check(entry['path']+' size',len(body)==entry['bytes'])
 check(entry['path']+' SHA256',hashlib.sha256(body).hexdigest()==entry['sha256'])
 check(entry['path']+' pinned blob',git('rev-parse',locator,cwd=private_repo).decode().strip()==entry['blob'])
 check(entry['path']+' observed unchanged',git('rev-parse',refs['observedCommit']+':'+entry['path'],cwd=private_repo).decode().strip()==entry['blob'])
paths=['packages/contracts/retrieval-0.2/public-data.schema.json','packages/contracts/retrieval-0.2/public-data-validation.mjs','packages/contracts/retrieval-0.2/public-data-deadlines.mjs','packages/contracts/test/retrieval-public-data.test.mjs']
source_bindings=[]
for p in paths:
 b=git('show',source+':'+p)
 check(p+' matches candidate',(root/p).read_bytes()==b)
 source_bindings.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':git('rev-parse',source+':'+p).decode().strip()})
changes=git('diff','--name-status',base,source,'--','packages','apps','scripts','package.json','package-lock.json').decode().splitlines()
check('production changes are exactly four allocated additions',sorted(changes)==sorted('A\t'+p for p in paths))
check('original tracked source preserved',all(line.startswith('A\t') for line in changes))
check('private candidate tree exact',git('rev-parse',source+'^{tree}').decode().strip()=='d3e75ff6046a0e1b51aeb4c3644c7670b94f1d22')
prisma=git('show',refs['frozenCommit']+':apps/api/prisma/schema.prisma',cwd=private_repo).decode()
attributes=[]
for model,field,annotation in [('FederalGrant','openDate','@db.Date'),('FederalGrant','closeDate','@db.Date'),('FederalAward','id','@db.Uuid'),('FederalAward','peCode','@db.VarChar(16)')]:
 modelbody=re.search(r'^model '+model+r' \{(.*?)^\}',prisma,re.M|re.S)[1]
 row=re.search(r'^\s*'+field+r'\s+([^\n]*)',modelbody,re.M)[1]
 check(model+'.'+field+' storage annotation',annotation in row)
 attributes.append({'model':model,'field':field,'annotation':annotation})
census=re.search(r'^model CensusDistrict \{(.*?)^\}',prisma,re.M|re.S)[1]
check('Census state has no db length annotation','@db.' not in re.search(r'^\s*state\s+([^\n]*)',census,re.M)[1])
schema=json.loads((root/paths[0]).read_bytes())
check('schema private id','0.2' in schema['$id'])
check('economic policy not model key','evidenceAccuracyMode' not in schema['$defs']['PublicEconomicRequest']['properties'])
for family in ['PublicGrant','PublicAward']:
 check(family+' policy not model key','evidenceAccuracyMode' not in schema['$defs'][family+'Request']['properties'])
check('trusted policy exact modes',schema['$defs']['PublicDataPolicyContext']['properties']['evidenceAccuracyMode']['enum']==['off','shadow','enforce'])
check('no source output runtime claims',all(not {'sourceEnabled','approved','authorized','complete','fresh'}&set(v.get('properties',{})) for v in schema['$defs'].values()))
# Source-author receipt is a read-only verification target, not imported code.
author=root.parent/'meri-read-continuation-20261012'/'docs/qualification/candidates/read-continuation-20261012/public-data-author'
author_receipt=json.loads((author/'focused-first.json').read_bytes())
check('author receipt source freeze',author_receipt['sourceHead']==source)
check('author receipt source clean',author_receipt['sourceDiffBytes']==0)
check('author receipt normal completion',author_receipt['exitCode']==0 and not author_receipt['timedOut'])
check('author owned process group absent',author_receipt['ownedProcessGroupAbsent'])
for item in author_receipt['streams']:
 b=(author/Path(item['path']).name).read_bytes()
 check('author stream '+Path(item['path']).name,len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256'])
check('author 27 tests pass',bool(re.search(r'(?:#|ℹ) pass 27\b',(author/'focused-first.stdout.bin').read_text())))
for label,exitcode in [('independent-first',1),('independent-admission',0)]:
 r=json.loads((evidence/(label+'.json')).read_bytes())
 check(label+' preserved result',r['exitCode']==exitcode and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for item in r['streams']:
  b=(root/item['path']).read_bytes()
  check(label+' raw '+Path(item['path']).name,len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256'])
decision=json.loads((evidence/'compatibility-decision.json').read_bytes()); b=(evidence/decision['originalTest']['path']).read_bytes()
check('first failing test unchanged',len(b)==decision['originalTest']['bytes'] and hashlib.sha256(b).hexdigest()==decision['originalTest']['sha256'])
report={'sourceCommit':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'sourceBindings':source_bindings,'storageAnnotations':attributes,'authorReceiptSha256':hashlib.sha256((author/'focused-first.json').read_bytes()).hexdigest(),'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'scope':'READ_ONLY_SOURCE_AND_DATA_NOT_NATIVE_OR_RUNTIME'}
(evidence/'audit-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'failures':[c for c in checks if not c['passed']]}))
raise SystemExit(0 if not report['failed'] else 1)
