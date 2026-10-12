"""Read-only exact source/reference audit; no private implementation execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='4566cef6417428d46274a14f7937ca11df66ae9d';SOURCE,AUTHOR=sys.argv[1:3];checks=[]
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
paths=['packages/contracts/retrieval-0.2/certification-status-validation.mjs','packages/contracts/retrieval-0.2/certification-status.schema.json','packages/contracts/test/retrieval-certification-status.test.mjs'];ids=[]
for p in paths:
    b=blob(SOURCE,p);check('exact source '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());ids.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-CERTIFICATION-STATUS-AUTHOR-20261012.md';prefix='docs/qualification/candidates/read-continuation-20261012/certification-status-author/'
check('source adds only allocated files',all(p in {*paths,report} or p.startswith(prefix) for p in set(source)-set(old)))
check('closeout metadata only',all(p==report or p.startswith(prefix) for p in set(source)|set(author) if source.get(p)!=author.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
    p=r['path'];b=blob(refs['sourceCommit'],p,Path('/workspace/capirov2'));private[p]=b
    check('pinned '+p,len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'] and git('rev-parse',refs['sourceCommit']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==r['blob'])
    check('observed unchanged '+p,b==blob(refs['observedCommit'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[0]).read_text();defs=json.loads((ROOT/paths[1]).read_text())['$defs'];client=private['apps/api/src/external/fedramp/fedramp.client.ts'].decode();provenance=private['packages/meriv2-core/src/grounding/status-provenance.ts'].decode();wrapper=private['apps/api/src/meri/meri-tools.service.ts'].decode();method='\n'.join(wrapper.splitlines()[3848:3901])
check('only canonical inert import',re.findall(r"import .* from '([^']+)'",module)==['./operation-contracts.mjs'])
check('only factory export',re.findall(r'export function (\w+)',module)==['createCertificationStatusValidators'])
check('no provider runtime clock effects',all(x not in module for x in ['Date.now','fetch(','setTimeout(','process.','node:','PrismaClient','@temporal','Worker(']))
check('no private source package import','@capiro' not in module)
check('closed explicit locale only',set(defs['CertificationStatusContext']['properties'])=={'comparisonLocale'} and defs['CertificationStatusContext']['required']==['comparisonLocale'] and defs['CertificationStatusContext']['additionalProperties'] is False)
check('locale canonical and supported admission','Intl.getCanonicalLocales' in module and "Intl.Collator.supportedLocalesOf(canonical,{localeMatcher:'lookup'})" in module)
check('casing takes explicit context','toLocaleLowerCase(selected.comparisonLocale)' in module and 'toLocaleLowerCase()' not in module)
check('exact request fields',set(defs['CertificationStatusRequest']['properties'])=={'program','query'})
check('only fedramp',defs['CertificationStatusRequest']['properties']['program']=={'const':'fedramp'})
check('query is not silently truncated','.slice(' not in module and 'query:raw.query.trim()' in module)
for name in ['CertificationStatusAbsent','CertificationStatusAmbiguous','CertificationStatusSingle']:
    p=defs[name]['properties'];check('no fabricated echo '+name,not {'query','generatedAt','authorized','authoritative','coverage','verified'}&set(p))
    check('snapshot assertion '+name,p['searchedEntireDataset']=={'const':True})
check('three output variants',len(defs['CertificationStatusOutput']['oneOf'])==3)
check('absence provenance optional','sourceUrl' not in defs['CertificationStatusAbsent']['required'] and 'observedAt' not in defs['CertificationStatusAbsent']['required'])
check('absence assertion exact',defs['CertificationStatusAbsent']['properties']['evidenceOfAbsence']=={'const':True})
check('record contains program and all9 source fields',set(defs['CertificationStatusRecord']['required'])=={'program','productId','cspName','csoName','status','impactLevel','authorizationDate','sponsoringAgencies','sourceUrl','observedAt'})
check('record agencies no unique guarantee',not defs['CertificationStatusRecord']['properties']['sponsoringAgencies'].get('uniqueItems',False))
check('candidate count safe full count',defs['CertificationStatusAmbiguous']['properties']['candidateCount']=={'type':'integer','minimum':2,'maximum':9007199254740991})
check('candidate window2..10',defs['CertificationStatusAmbiguous']['properties']['candidates']['minItems']==2 and defs['CertificationStatusAmbiguous']['properties']['candidates']['maxItems']==10)
check('no candidate uniqueness guarantee',not defs['CertificationStatusAmbiguous']['properties']['candidates'].get('uniqueItems',False) and 'new Set' not in module)
for symbol,definition in [('FEDRAMP_STATUS_VOCABULARY','CertificationStatusVocabulary'),('FEDRAMP_IMPACT_LEVEL_VOCABULARY','CertificationImpactVocabulary')]:
    values=re.findall(r"['\"]([^'\"]+)['\"]",re.search(r'(?:export )?const '+symbol+r'\s*=\s*\[([\s\S]*?)\]',provenance).group(1));check('pinned exact vocabulary '+symbol,values==defs[definition]['enum'])
url=re.search(r'FEDRAMP_MARKETPLACE_URL\s*=\s*[\'"]([^\'\"]+)',client).group(1);check('pinned source URL',url==defs['CertificationMarketplaceUrl']['const'])
check('original wrapper locale is ambient','toLocaleLowerCase()' in method)
check('original exact ID before name branch',method.index('records.find')<method.index('records.filter') and 'exactId' in method)
check('original first10 and full count',bool(re.search(r'matches\.slice\(0,\s*10\)',method)) and 'candidateCount: matches.length' in method)
check('original optional first record provenance','records[0]?.sourceUrl' in method and 'records[0]?.observedAt' in method)
check('no original query or generation echo',not re.search(r'^\s*(?:query|generatedAt):',method,re.M))
check('source15s per fetch','TIMEOUT_MS = 15_000' in client or 'TIMEOUT_MS = 15000' in client)
check('source8MiB data bound',bool(re.search(r'MAX_RESPONSE_BYTES\s*=\s*8\s*\*\s*1024\s*\*\s*1024',client)))
check('body fully read before postread check',client.index('response.arrayBuffer()')<client.index('bytes.byteLength'))
check('source retry remains actual external call',client.count('await fetchOnce(')==2)
check('selected wrapper no actor tenant proof','actorId' not in method and 'tenantId' not in method)
check('provenance engine treats verification separately','evidenceSupportsNegativeClaim' in provenance and 'evidence.authoritative' in provenance and 'evidence.primary' in provenance)
for label in ['initial-independent','identity-independent','exact-source-tests']:
    r=json.loads((E/(label+'.json')).read_text());check('owned group absent '+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    for f in r['streams']:
        b=(ROOT/f['path']).read_bytes();check('raw '+f['path'],len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'])
    check('stderr empty '+label,not(E/(label+'.stderr.bin')).read_bytes())
for file,directory in [('initial-source-identities.json','initial-source'),('identity-negative-source-before.json','identity-negative-source')]:
    for r in json.loads((E/file).read_text()):
        b=(E/directory/r['path']).read_bytes();check('preimage '+directory+'/'+r['path'],len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'])
check('behavioral replay stable before after',(E/'identity-negative-source-before.json').read_bytes()==(E/'identity-negative-source-after.json').read_bytes())
check('no private bodies in new tracked files',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in set(review)-set(old) if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
result={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'authorMetadata':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':ids,'privateSourceExecuted':False,'runtime':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'originalsPreserved':len(old)}))
