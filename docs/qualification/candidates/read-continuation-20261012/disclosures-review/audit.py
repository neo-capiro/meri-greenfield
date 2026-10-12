"""Offline disclosure source/evidence audit. Private object reads emit metadata only."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='283c30f2b0d9e990caa5d680843a19281318df9c';SOURCE='88c9257e10822396c30cc99fb277ab145aac7218'
AUTHOR=sys.argv[1]
checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
def git(*a,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*a])
def blob(ref,p,repo=ROOT):return git('show',ref+':'+p,repo=repo)
def entries(ref):
    rows={}
    for line in git('ls-tree','-r',ref).decode().splitlines():
        m,p=line.split('\t',1);rows[p]=m.split()[2]
    return rows
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
for title,tree in [('source',source),('author',author),('review',review)]:check('originals preserved '+title,all(tree.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/disclosures-validation.mjs','packages/contracts/retrieval-0.2/disclosures.schema.json','packages/contracts/test/retrieval-disclosures.test.mjs'];identities=[]
for p in paths:
    b=blob(SOURCE,p);check('exact frozen bytes '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-READ-CONTINUATION-DISCLOSURES-AUTHOR-20261012.md'
check('only allocated source additions',set(source)-set(old)=={*paths,report})
check('metadata only after source',all(p==report or p.startswith('docs/qualification/candidates/read-continuation-20261012/disclosures-author/') for p in set(author)|set(source) if author.get(p)!=source.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
    p=r['path'];b=blob(refs['sourceCommit'],p,Path('/workspace/capirov2'));private[p]=b
    check('private pinned hash '+p,len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'] and git('rev-parse',refs['sourceCommit']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==r['blob'])
    check('private observed hash '+p,b==blob(refs['observedCommit'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[0]).read_text();defs=json.loads((ROOT/paths[1]).read_text())['$defs'];prisma=private['apps/api/prisma/schema.prisma'].decode()
models={n:re.search(r'model '+n+r'\s*\{([\s\S]*?)\n\}',prisma).group(1) for n in ['SecFiling','FaraRegistration','LdaFiling']}
for n,model,keys in [('Sec','SecFiling',['id','accessionNumber']),('Fara','FaraRegistration',['id','registrationNumber']),('Lda','LdaFiling',['filingUuid'])]:
    for key in keys:check('pinned unique identity '+model+'.'+key,bool(re.search(r'^\s*'+key+r'\s+[^\n]*@(?:id|unique)',models[model],re.M)))
for n,model,key in [('Sec','SecFiling','filingDate'),('Fara','FaraRegistration','registrationDate')]:check('pinned date-only '+model,bool(re.search(r'^\s*'+key+r'\s+[^\n]*@db.Date\b',models[model],re.M)))
rowfields={'Sec':['id','cik','companyName','formType','accessionNumber','filingDate','description','url'],'Fara':['id','registrationNumber','registrantName','foreignPrincipal','country','status','registrationDate','description'],'Lda':['filingUuid','filingType','filingYear','filingPeriod','income','expenses','dtPosted','registrantId','registrantName','clientId','clientName','clientState','issueCodes']}
for n,keys in rowfields.items():
    d=defs['Disclosures'+n+'Row'];check('projected row exact fields '+n,set(d['properties'])==set(keys) and set(d['required'])==set(keys) and d['additionalProperties'] is False)
    o=defs['Disclosures'+n+'Output'];expected={'tool','generatedAt','total','data'}|({'page','limit'} if n=='Lda' else set());check('projected envelope fields '+n,set(o['properties'])==expected)
    check('fifty row transport cap '+n,o['properties']['data']['maxItems']==50)
check('empty global options context',defs['DisclosuresContext']['properties']=={} and defs['DisclosuresContext']['additionalProperties'] is False)
check('single canonical snapshot import',re.findall(r"import .* from '([^']+)'",module)==['./operation-contracts.mjs'])
check('only factory exported',re.findall(r'export function (\w+)',module)==['createDisclosuresValidators'])
check('no effects in pure family',all(s not in module for s in ['fetch(', 'process.', 'setTimeout(', 'node:','PrismaClient','openai','@temporal']))
# Metadata-only static policy characterization of actual owners; no source execution.
meri=private['apps/api/src/meri/meri-tools.service.ts'].decode();lda=private['apps/api/src/lda-intel/lda-intel.service.ts'].decode()
for text,name in [(meri,'searchSecFilings'),(meri,'searchFaraRegistrations'),(lda,'getFilings')]:
    start=re.search(r'(?:private\s+)?async\s+'+name+r'\(',text).start();next_method=re.search(r'\n\s*(?:private\s+)?async\s+\w+\(',text[start+10:]);chunk=text[start:start+10+next_method.start()] if next_method else text[start:]
    check('separate row/count '+name,'Promise.all' in chunk and '.count(' in chunk and '.findMany(' in chunk)
    check('no mutation/provider call in inspected method '+name,not re.search(r'\.(?:create|update|delete|send|fetch|upsert)\(',chunk))
for p in ['apps/api/src/meri/meri.controller.ts','apps/api/src/lda-intel/lda-intel.controller.ts']:
    text=private[p].decode();check('controller role metadata '+p,'standard_user' in text and 'RolesGuard' in text)
check('conditional secret guard present','ToolServiceSecretGuard' in private['apps/api/src/meri/meri.controller.ts'].decode() and 'canActivate' in private['apps/api/src/meri/tool-service-secret.guard.ts'].decode())
check('role rank owner exists','ROLE_RANK' in private['apps/api/src/auth/roles.guard.ts'].decode())
check('LDA storage client identity is Int nullable',bool(re.search(r'^\s*clientId\s+Int\?',models['LdaFiling'],re.M)))
check('LDA no tenant field',not re.search(r'^\s*tenantId\b',models['LdaFiling'],re.M))
for field in ['income','expenses']:check('LDA stored nullable Decimal '+field,bool(re.search(r'^\s*'+field+r'\s+Decimal\?',models['LdaFiling'],re.M)))
for label in ['prefreeze-independent','operation-coercion','exact-source-tests']:
    receipt=json.loads((E/(label+'.json')).read_text());check('owned group absent '+label,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    for stream in receipt['streams']:
        b=(ROOT/stream['path']).read_bytes();check('raw stream identity '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
    check('stderr empty '+label,not (E/(label+'.stderr.bin')).read_bytes())
for f in json.loads((E/'operation-coercion-source.json').read_text())['files']:
    b=(E/'operation-coercion-source'/f['path']).read_bytes();check('negative preimage retained '+f['path'],len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'])
new=set(review)-set(old);check('no entire private bodies copied',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in new if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
record={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'author':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':identities,'privateBodiesPublished':False,'privateSourceExecuted':False,'runtime':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(x['pass'] for x in checks),'originalsPreserved':len(old),'source':SOURCE}))
