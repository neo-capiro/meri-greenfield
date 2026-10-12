"""Bounded source/metadata audit; private Git blobs are read as inert data only."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='2aa0a33bdaf36af1224cfdb840bc493e53cea9f3';SOURCE,AUTHOR=sys.argv[1:3];checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
def blob(ref,p,repo=ROOT):return git('show',ref+':'+p,repo=repo)
def entries(ref):
    result={}
    for line in git('ls-tree','-r',ref).decode().splitlines():meta,p=line.split('\t',1);result[p]=meta.split()[2]
    return result
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
for name,tree in [('source',source),('author',author),('review',review)]:check('all original bytes '+name,all(tree.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/'+p for p in ['pe-references-validation.mjs','pe-contractors-validation.mjs','pe-references.schema.json']]+['packages/contracts/test/retrieval-pe-references.test.mjs'];ids=[]
for p in paths:
    b=blob(SOURCE,p);check('exact source '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());ids.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-PE-REFERENCES-AUTHOR-20261012.md';prefix='docs/qualification/candidates/read-continuation-20261012/pe-references-author/'
check('source adds only allocated paths',all(p in {*paths,report} or p.startswith(prefix) for p in set(source)-set(old)))
check('author followup metadata only',all(p==report or p.startswith(prefix) for p in set(source)|set(author) if source.get(p)!=author.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
    p=r['path'];b=blob(refs['sourceCommit'],p,Path('/workspace/capirov2'));private[p]=b
    check('pinned '+p,len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'] and git('rev-parse',refs['sourceCommit']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==r['blob'])
    check('unchanged '+p,b==blob(refs['observedCommit'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[0]).read_text();helper=(ROOT/paths[1]).read_text();defs=json.loads((ROOT/paths[2]).read_text())['$defs']
check('only canonical inert and cohesive helper imports',set(re.findall(r"import .* from '([^']+)'",module))=={'./operation-contracts.mjs','./pe-contractors-validation.mjs'})
check('internal helper no imports',not re.search(r'\bimport\b',helper))
check('no source or runtime effects',all(x not in module+helper for x in ['Date.now','fetch(','setTimeout(','process.','PrismaClient','node:','@temporal','createPool']))
check('closed empty context',defs['PeReferenceContext']['properties']=={} and defs['PeReferenceContext']['additionalProperties'] is False)
check('three exact operations',all(x in module for x in ['get_pe_contractors','get_pe_bills','get_pe_report_language']))
check('no PE echo invented for bills','peCode' not in defs['PeBillsOutput']['properties'])
check('no PE echo invented for contractors',all('peCode' not in defs[n]['properties'] for n in ['PeContractorsMissingTable','PeContractorsAvailable']))
check('report PE echo required','peCode' in defs['PeReportLanguageOutput']['required'])
check('only100 stored bills',defs['PeBillsOutput']['properties']['bills']['maxItems']==100)
check('only50 stored provisions',defs['PeReportLanguageOutput']['properties']['provisions']['maxItems']==50)
check('only10 award groups25 named rows',defs['PeContractorsAvailable']['properties']['data']['maxItems']==10 and defs['PeContractorsAvailable']['properties']['namedPrimes']['maxItems']==25)
check('link evidence nonnull string',defs['PeBillLink']['properties']['evidence']['type']=='string')
check('bill link excludes rejected only',defs['PeBillLink']['properties']['status']['not']=={'const':'rejected'} and 'enum' not in defs['PeBillLink']['properties']['status'])
check('provisions accepted/candidate',defs['PeProvision']['properties']['reviewStatus']['enum']==['accepted','candidate'])
check('unrestricted finite projection confidence',defs['PeProvision']['properties']['confidence']=={'type':'number'} and defs['PeBillLink']['properties']['confidence']=={'type':'number'})
check('award rows remain Int32',defs['PeContractorRow']['properties']['awards']['maximum']==2147483647)
check('aggregate counts safe integers',defs['PeFederalAwards']['properties']['count']['maximum']==9007199254740991 and all(s['properties']['count']['maximum']==9007199254740991 for s in defs['PeAwardBuckets']['prefixItems']))
check('fixed24-month provenance',defs['PeFederalAwards']['properties']['provenance']['properties']['windowMonths']=={'const':24})
check('money provenance classes separated',defs['PeGovernmentExhibit']['properties']['provenance']['properties']['kind']['const']=='legacy_compatibility' and defs['PeFederalAwards']['properties']['provenance']['properties']['kind']['const']=='live_external')
check('fixed bucket classes', [s['properties']['evidenceClass']['const'] for s in defs['PeAwardBuckets']['prefixItems']]==['accepted_direct','candidate','unmatched_dollars'])
check('unmatched coverage caveat retained','not inventoried' in defs['PeContractorEvidenceNote']['const'])
check('loaded report coverage caveat retained','not proof' in defs['PeNoReportNote']['const'] and 'loaded' in defs['PeNoReportNote']['const'])
prisma=private['apps/api/prisma/schema.prisma'].decode();owner=private['apps/api/src/program-element/program-element-read.service.ts'].decode();wrapper=private['apps/api/src/meri/meri-tools.service.ts'].decode()
models={n:re.search(r'model '+n+r'\s*\{([\s\S]*?)\n\}',prisma).group(1) for n in ['BillBudgetLineLink','FederalEvidenceMention','CongressBill','ProvisionPeLink']}
for n in ['BillBudgetLineLink','FederalEvidenceMention']:check('native evidence String '+n,bool(re.search(r'^\s*evidence\s+String\s',models[n],re.M)))
check('bill native date-only',bool(re.search(r'^\s*latestActionDate\s+DateTime\?[^\n]*@db.Date',models['CongressBill'],re.M)))
check('provision confidence Float not auth',bool(re.search(r'^\s*confidence\s+Float\s',models['ProvisionPeLink'],re.M)))
for symbol in ['getBills','getContractors','getProvisionsForPe']:
    start=re.search(r'async\s+'+symbol+r'\(',owner).start();nextm=re.search(r'\n\s*(?:private\s+)?async\s+\w+\(',owner[start+10:]);chunk=owner[start:start+10+nextm.start()] if nextm else owner[start:]
    check('owner no actor/tenant proof '+symbol,'this.ctx.' not in chunk and 'actorId' not in chunk and 'tenantId' not in chunk)
    check('owner no selected producer mutation '+symbol,not re.search(r'this\.prisma\.[\w.]+\.(?:create|update|delete|upsert)\(',chunk))
    if symbol=='getContractors':
        check('stored award window24months','24 months' in chunk)
        check('source group mixed direct evidence','bool_or' in chunk.lower() and 'GROUP BY contractor_name' in chunk)
        check('source top10 and25 returned named','LIMIT 10' in chunk and '.slice(0, 25)' in chunk)
    if symbol=='getBills':check('source excludes rejected',"not: 'rejected'" in chunk)
for label in ['prefreeze-independent','initial-negative-replay','repaired-prefreeze-independent','exact-source-tests']:
    r=json.loads((E/(label+'.json')).read_text());check('owned group absent '+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    for f in r['streams']:
        b=(ROOT/f['path']).read_bytes();check('raw stream '+f['path'],len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'])
    check('empty stderr '+label,not(E/(label+'.stderr.bin')).read_bytes())
for r in json.loads((E/'prefreeze-source-before.json').read_text()):
    b=(E/'initial-source'/r['path']).read_bytes();check('retained exact initial '+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
check('no entire private body in new tracked files',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in set(review)-set(old) if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'authorMetadata':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':ids,'privateSourceExecuted':False,'native':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(x['pass'] for x in checks),'originalsPreserved':len(old)}))
