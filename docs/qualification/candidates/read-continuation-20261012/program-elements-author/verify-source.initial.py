"""Source-only pin/shape audit. Reads immutable Git data; never imports private modules."""
from pathlib import Path
import subprocess,hashlib,json,re
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
pin='fd8765ec01d292013758606204f2c9d886cd31c1';observed='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace';base='ede7b56845816d38d0bbffab5a657aaa4f978739'
def git(*args,cwd=root):return subprocess.check_output(['git','-C',str(cwd),*args],stderr=subprocess.PIPE)
def read(path,rev=pin):return git('show',rev+':'+path,cwd='/workspace/capirov2')
checks=[]
def check(name,value):checks.append({'name':name,'passed':bool(value)})
paths={
'apps/api/src/meri/meri-tools.service.ts':'236;5027-5233;5252-5257;9948-9960;10044-10048',
'apps/api/src/program-element/program-element-read.service.ts':'60-89;268-320;450-547;950-1074;1100-1318',
'packages/shared/src/funding-claim.ts':'16-117;130-131;300-333;489-501',
'packages/shared/src/index.ts':'2034-2055;2195-2214;2246-2432;2436-2506',
'packages/shared/src/defense-budget-line.ts':'8-107',
'apps/api/src/meri/meri-defense-budget-tool.helpers.ts':'27-208',
'apps/api/src/program-element/funding-claim.helpers.ts':'26-118',
'apps/api/src/program-element/budget-line-lineage.ts':'3-49',
'apps/api/prisma/schema.prisma':'ProgramElement;ProgramElementYear;ProgramElementMilestone',
'apps/api/src/common/meri-evidence-accuracy-flags.ts':'mode vocabulary and default',
'apps/api/src/program-element/models/conference-probability.service.ts':'cached versus fresh prediction and persistence flag',
'apps/api/src/program-element/program-element.controller.ts':'controller guard/delegation metadata; no execution',
'apps/api/src/meri/meri-defense-budget-tool.helpers.spec.ts':'assertion metadata only; no private tests executed',
'apps/api/src/meri/meri-tools.defense-budget.spec.ts':'assertion metadata only; no private tests executed',
'apps/api/src/program-element/funding-claim.spec.ts':'claim/missing-mark assertion metadata only',
'apps/api/package.json':'@prisma/client dependency range only; does not prove installed serializer'}
refs=[]
for p,loc in paths.items():
 rec={'path':p,'inspectedMetadata':loc}
 for tag,rev in [('pinned',pin),('observed',observed)]:
  b=read(p,rev);rec[tag]={'commit':rev,'blob':git('rev-parse',rev+':'+p,cwd='/workspace/capirov2').decode().strip(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 rec['unchanged']=rec['pinned']['blob']==rec['observed']['blob'];check(p+':unchanged',rec['unchanged']);refs.append(rec)
(e/'reference-identities.json').write_text(json.dumps({'references':refs,'privateBodiesPublished':False},indent=2)+'\n')
schema=json.loads((root/'packages/contracts/retrieval-0.2/program-elements.schema.json').read_text());d=schema['$defs'];prisma=read('apps/api/prisma/schema.prisma').decode();inventory={}
for model,definition,extras in [('ProgramElement','ProgramElementStored',['years','fundingSummary','billCount','projectCount','sourceCount','currentCycleFy','currentUserIsWatching']),('ProgramElementYear','ProgramElementYear',['fundingClaim']),('ProgramElementMilestone','ProgramElementMilestone',[])]:
 text=re.search(r'model '+model+r'\s*\{([\s\S]*?)\n\}',prisma)[1];fields=[]
 for line in text.splitlines():
  m=re.match(r'\s*(\w+)\s+(String|Int|Float|Boolean|Json|Decimal|DateTime)(\?)?(?=\s)',line)
  if not m:continue
  name,typ,optional=m.groups();fields.append({'name':name,'type':typ,'nullable':bool(optional),'sqlDate':'@db.Date' in line and '@db.DateTime' not in line,'decimal14_2':'@db.Decimal(14, 2)' in line})
  check(model+'.'+name+':required',name in d[definition]['required']);shape=d[definition]['properties'].get(name,{})
  check(model+'.'+name+':nullability',bool(optional)==('anyOf' in shape and {'type':'null'} in shape.get('anyOf',[])))
  if typ=='Decimal':check(model+'.'+name+':lossless private wire',{'$ref':'#/$defs/ProgramElementDecimal'} in shape.get('anyOf',[]))
 check(model+':all-and-only-scalars-plus-projection',set(d[definition]['properties'])=={x['name'] for x in fields}|set(extras));inventory[model]=fields
(e/'scalar-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
check('private URN',schema['$id']=='urn:meri:retrieval:program-elements:0.2.0')
check('mode-only trusted context',set(d['ProgramElementContext']['properties'])=={'evidenceAccuracyMode'})
check('no detail years cap','maxItems' not in d['ProgramElementStored']['properties']['years'])
check('no timeline years/milestone cap',all('maxItems' not in d['ProgramElementTimelineOutput']['properties'][k] for k in ['years','milestones']))
check('raw Decimal positive/negative precision pattern',d['ProgramElementDecimal']['pattern']==r'^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$')
check('forecast confidence has no fabricated probability cap','maximum' not in d['ProgramElementTimelineYear']['properties']['predictedConferenceConfidence'])
wrapper=read('apps/api/src/meri/meri-tools.service.ts').decode();helper=read('apps/api/src/meri/meri-defense-budget-tool.helpers.ts').decode();owner=read('apps/api/src/program-element/program-element-read.service.ts').decode()
check('lineage note literal pinned',d['ProgramElementLineage']['properties']['note']['const'] in wrapper)
check('source timeline null conflicts','requestConflictValuesM: requestConflicts.get(year.fy) ?? null' in owner)
check('source statistical predictor persist=false','.predict(peCode, year.fy, false)' in owner)
check('source cache case normalization','peCode.toUpperCase()' in owner)
check('source legacy output field stripping',all(re.search(k+r'\s*:',helper) for k in ['enactmentStatus','vehicleType','originalUnit','originalValue','source']))
allowed=['packages/contracts/retrieval-0.2/program-elements.schema.json','packages/contracts/retrieval-0.2/program-elements-validation.mjs','packages/contracts/test/retrieval-program-elements.test.mjs']
identities=[]
for p in allowed:
 b=(root/p).read_bytes();identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
module=(root/allowed[1]).read_text();check('canonical inert reuse',"import {snapshotOperationData} from './operation-contracts.mjs'" in module);check('no effect port',not re.search(r'\b(fetch|connect|spawn|createServer|writeFile)\s*\(',module));check('no private import','@capiro' not in module and 'apps/api/' not in module)
old={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r',base).decode().splitlines()};new={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r','HEAD').decode().splitlines()}
check('original Git entries exact',all(new.get(k)==v for k,v in old.items()));check('original working files unchanged',not git('diff',base,'--',*old.keys()));check('only three source additions',set(git('diff','--name-only',base,'--','packages').decode().splitlines())==set(allowed))
record={'base':base,'head':git('rev-parse','HEAD').decode().strip(),'scope':'LOCAL_SOURCE_ONLY_NO_RUNTIME','originalEntries':len(old),'identities':identities,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
(e/'source-checks.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({k:record[k] for k in ['head','originalEntries','passed','failed']}))
for c in checks:
 if not c['passed']:print('FAILED: '+c['name'])
raise SystemExit(bool(record['failed']))
