#!/usr/bin/env python3
"""Inspect exact public schemas and private source identities only; no private execution."""
import hashlib,json,subprocess
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[4]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def at(ref,path):return git('show',ref+':'+path)
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';initial='2584818a24dd60fb63ac9e613d48a0c34e8542ba';source=git('rev-parse','d8eaa037').decode().strip()
checks=[]
def check(name,value):checks.append({'name':name,'pass':bool(value)})
def tree(ref):
 result={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   v,p=row.split(b'\t',1);result[p.decode()]=v.decode()
 return result
old,current=tree(base),tree(source);check('all PR35 original mode/blob entries preserved',all(current.get(k)==v for k,v in old.items()))
files=['packages/contracts/retrieval-0.2/research-legal-legislation.schema.json','packages/contracts/retrieval-0.2/research-legal-legislation-validation.mjs','packages/contracts/test/retrieval-research-legal-legislation.test.mjs']
for p in files:check('exact exercised '+p,(ROOT/p).read_bytes()==at(source,p))
check('only three legal files added at first legal candidate',set(git('diff','--name-only','0463c80a',initial,'--','apps','packages','scripts').decode().splitlines())==set(files))
check('repair does not alter validator',at(initial,files[1])==at(source,files[1]))
a=json.loads(at(initial,files[0]));b=json.loads(at(source,files[0]));
a['$defs']['ResearchLegalQueryAst']['oneOf'][-1]['properties']['children']['minItems']=2
check('exact sole schema semantic change is logical minItems2',a==b)
check('author original tests retained as complete prefix',at(source,files[2]).startswith(at(initial,files[2])))
d=b['$defs'];check('canonical client-resolution shape reused',d['ResearchLegalLegislationContext']['properties']['clientResolution']=={'$ref':'urn:meri:retrieval:outreach-query:0.2.0#/$defs/OutreachQueryContext/properties/clientResolution'})
check('closed context with exactly two facts',d['ResearchLegalLegislationContext']['additionalProperties'] is False and set(d['ResearchLegalLegislationContext']['required'])=={'clientResolution','citationResolution'})
expected={
'ResearchLegalVersion':'id billId jurisdiction sessionKey revision contentHash extractorVersion sourceUrl kind publishedDate observedAt complete title isCurrent',
'ResearchLegalSearchItem':'id billId jurisdiction sessionKey revision contentHash extractorVersion sourceUrl kind publishedDate observedAt complete title billTitle billIdentifier sponsor chamber lastAction versionType isCurrent excerpt evaluation',
'ResearchLegalReferenceRow':'id jurisdiction code_kind reference_kind chapter section subdivisions identity created_at revision_id edition title source_url content_hash extraction_hash parser_version sections history_text complete coverage observed_at',
'ResearchLegalOccurrence':'id document_id bill_id jurisdiction session_key document_revision reference_id locator quote basis parser_version start_offset end_offset relation observed_at source_url document_kind is_current',
'ResearchLegalSearchResult':'scope items interpretedQuery versionPolicy searchedKinds scanned cursor coverage message',
'ResearchLegalVersionsResult':'scope versions complete order',
'ResearchLegalReferencesResult':'scope referenceId edition rows related coverage',
'ResearchLegalRulesResult':'scope rows adopted coverage'}
for name,keys in expected.items():check('complete exact projection '+name,set(d[name]['required'])==set(d[name]['properties'])==set(keys.split()) and d[name]['additionalProperties'] is False)
for name in ['ResearchLegalVersion','ResearchLegalSearchItem']:check(name+' nullable actual view kind/title',d[name]['properties']['kind']=={'type':['string','null']} and d[name]['properties']['title']=={'type':['string','null']})
for key in ['subdivisions','identity','sections','coverage']:check('raw inert JSON preserved '+key,d['ResearchLegalReferenceRow']['properties'][key]=={})
check('occurrence exact DB relation enum',d['ResearchLegalOccurrence']['properties']['relation']['enum']==['cites','proposes_amend','proposes_repeal','proposes_create','proposes_renumber','reenacts','unresolved'])
code=at(source,files[1]).decode();check('canonical inert/date helpers reused',"from './operation-contracts.mjs'" in code and "from './public-data-deadlines.mjs'" in code)
check('no private producer imports or live interfaces',all(x not in code for x in ['fetch(', '$queryRaw', 'process.env', 'new Date()', 'compileKeywordQuery(', 'evaluateKeywordQuery(', 'capirov2']))
ref='fd8765ec01d292013758606204f2c9d886cd31c1';observed=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse','4be13b0b'],text=True).strip()
paths=['apps/api/src/meri/meri-tools.service.ts','apps/api/prisma/schema.prisma','apps/api/src/engagement/engagement-access.helpers.ts','apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts','apps/intel-api/src/tracker/keywords/internal-workflow.controller.ts','apps/intel-api/src/tracker/research/research.service.ts','apps/intel-api/src/tracker/reports/report.service.ts','apps/intel-api/src/tracker/keywords/keyword-rule.service.ts','apps/intel-api/src/tracker/folders/folder-tracker.service.ts','apps/intel-api/src/sourcedata/folder-source-data.repository.ts','apps/intel-api/src/feature-flags/feature-flag.service.ts','packages/shared/src/legislative-research.ts','packages/shared/src/legiwatch-query.ts','apps/api/prisma/migrations/20280913030000_legiwatch_research_evidence/migration.sql']
refs=[]
for path in paths:
 versions=[]
 for commit in [ref,observed]:
  raw=subprocess.check_output(['git','-C','/workspace/capirov2','show',commit+':'+path]);versions.append({'commit':commit,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'blob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()})
 refs.append({'path':path,'versions':versions});check('frozen/current source pin agrees '+path,versions[0]['sha256']==versions[1]['sha256'])
for label,exitcode in [('legal-first',1),('legal-corrected',0),('legal-arity-before',1),('legal-arity-repaired',0)]:
 receipt=json.loads((P/(label+'.json')).read_text());check(label+' exact raw result/cleanup',receipt['exitCode']==exitcode and receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
 for stream in receipt['streams']:
  raw=(ROOT/stream['path']).read_bytes();check(label+' '+Path(stream['path']).name,stream['bytes']==len(raw) and stream['sha256']==hashlib.sha256(raw).hexdigest())
for label,count,failed in [('legal-first',85,8),('legal-corrected',85,0),('legal-arity-before',91,2),('legal-arity-repaired',92,0)]:
 text=(P/(label+'.stdout.bin')).read_text();check(label+' actual test totals',f'tests {count}' in text and f'fail {failed}' in text)
result={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','passed':sum(x['pass'] for x in checks),'total':len(checks),'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'originalCandidate':initial,'base':base,'baseEntries':len(old),'references':refs,'checks':checks,'limits':'Only search_legislative_research/get_legal_reference DTO branches. Unreviewed news in repair ancestry is excluded. No current authority, parser/evaluation/cursor/inventory truth or native/runtime acceptance.'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
