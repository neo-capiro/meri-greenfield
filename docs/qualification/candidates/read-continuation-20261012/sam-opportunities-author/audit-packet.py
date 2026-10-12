"""Source/metadata/receipt audit only. No private module import or execution."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';FIRST='ac1c8d86cbef293d1afb82268ce755be975b8e49';SOURCE='02bac2139b13dec288b5ca2c19edc3be85e2c6b2'
files=['packages/contracts/retrieval-0.2/sam-opportunities.schema.json','packages/contracts/retrieval-0.2/sam-opportunities-validation.mjs','packages/contracts/test/retrieval-sam-opportunities.test.mjs']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(c,p):return git('show',c+':'+p)
def sha(v):return hashlib.sha256(v).hexdigest()
def tree(c):return {r.split('\t',1)[1]:r.split()[2] for r in git('ls-tree','-r',c).decode().splitlines()}
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
a,b=tree(BASE),tree(SOURCE);check('6528 originals preserved',len(a)==6528 and all(b.get(p)==v for p,v in a.items()))
check('only three source additions and outline',set(b)-set(a)==set(files+[str((HERE/'outline.md').relative_to(ROOT))]))
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='e38ab9d7dd189d7ea23deaeb4adb40bc7b5627ed')
for p in files:check('exact current source:'+p,(ROOT/p).read_bytes()==blob(SOURCE,p))
for p in ['packages/contracts/retrieval-0.2/operation-contracts.mjs','packages/contracts/retrieval-0.2/funding-envelope-validation.mjs','packages/contracts/retrieval-0.2/funding-opportunities.schema.json']:
 check('unchanged canonical owner:'+p,blob(BASE,p)==blob(SOURCE,p)==(ROOT/p).read_bytes())
old=json.loads(blob(FIRST,files[0]));new=json.loads(blob(SOURCE,files[0]));oldnotes=old['$defs']['SamOpportunitiesOutput']['properties']['notes'];noteliterals=[r['const'] for r in oldnotes['prefixItems']];old['$defs']['SamOpportunitiesOutput']['properties']['notes']={'type':'array','enum':[[noteliterals[0]],noteliterals]};check('schema repair equivalent exact note arrays only',old==new)
test_before=blob(FIRST,files[2]).decode();check('all author assertions unchanged across schema repair',test_before.replace('schema.$defs.SamOpportunitiesOutput.properties.notes.prefixItems.map(item=>item.const)','schema.$defs.SamOpportunitiesOutput.properties.notes.enum[1]')==blob(SOURCE,files[2]).decode())
check('validator unchanged since first source',blob(FIRST,files[1])==blob(SOURCE,files[1]))
refs=json.loads((HERE/'reference-identities.json').read_bytes());check('nine reference pairs',len(refs['references'])==9)
for r in refs['references']:
 for version in r['versions']:
  value=subprocess.check_output(['git','show',version['commit']+':'+r['path']],cwd='/workspace/capirov2');check('source pin:'+version['commit'][:8]+':'+r['path'],len(value)==version['bytes'] and sha(value)==version['sha256'])
 check('no reference drift:'+r['path'],r['unchanged'] and r['versions'][0]['blob']==r['versions'][1]['blob'])
model=json.loads((HERE/'selected-model-fields.json').read_bytes());fields={r['name']:r for r in model['fields']};check('fourteen model fields',len(fields)==14)
check('exact selected projection',set(new['$defs']['SamOpportunity']['required'])==set(fields) and set(new['$defs']['SamOpportunity']['properties'])==set(fields)|{'deadline'})
check('UUID and unique notice storage',fields['id']['uuidStorage'] and fields['noticeId']['unique'])
for key,cap in [('noticeType',32),('pscCode',8),('naicsCode',8)]:check('varchar codepoint cap:'+key,fields[key]['varchar']==cap and new['$defs']['SamOpportunity']['properties'][key]['maxLength']==cap)
read=json.loads((HERE/'read-metadata.jsonl').read_text().splitlines()[0]);selection=[s for s in read['shapes'] if set(x['name'] for x in s['fields'])==set(fields)];check('actual source selects same fourteen',len(selection)==1)
wrapper=json.loads((HERE/'wrapper-metadata.jsonl').read_text().splitlines()[0]);check('actual wrapper selector helpers',wrapper['selectors']==[{'helper':'optionalString','args':['input','query',240]},{'helper':'optionalString','args':['input','naics',12]},{'helper':'optionalBoolean','args':['input','includeInactive']},{'helper':'clampInt','args':['input.limit',1,50,20]}])
check('separate count and row read',all(c in read['calls'] for c in ['this.prisma.samOpportunity.findMany','this.prisma.samOpportunity.count']))
notes=json.loads((HERE/'note-identities.json').read_bytes());check('exact note contract hashes',all(len(s)==row['characters'] and sha(s.encode())==row['sha256'] for s,row in zip(noteliterals,notes['noteContractLiterals'])) and len(noteliterals)==2)
for label,head,passed,failed in [('focused',FIRST,0,1),('focused-notes-repaired',SOURCE,35,0)]:
 r=json.loads((HERE/(label+'.json')).read_bytes());check('exact tested source:'+label,r['sourceHead']==head and r['sourceDiffBytes']==0)
 check('owned exit:'+label,r['exitCode']==int(failed>0) and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for row in r['streams']:
  value=(ROOT/row['path']).read_bytes();check('raw stream:'+row['path'],len(value)==row['bytes'] and sha(value)==row['sha256'])
 out=(ROOT/r['streams'][0]['path']).read_text();check('actual focused counts:'+label,f'ℹ pass {passed}\n' in out and f'ℹ fail {failed}\n' in out)
code=blob(SOURCE,files[1]).decode();check('canonical module imports only',[l for l in code.splitlines() if l.startswith('import ')]==["import {snapshotOperationData} from './operation-contracts.mjs';","import {fundingInstant, assertFundingBrief} from './funding-envelope-validation.mjs';"])
check('no ambient clock provider or persistence',not any(s in code for s in ['Date.now','fetch(', '$queryRaw','require(', 'import(', 'process.', 'child_process']))
result={'source':SOURCE,'sourceTree':'e38ab9d7dd189d7ea23deaeb4adb40bc7b5627ed','preservedFirstSource':FIRST,'originalBlobsPreserved':6528,'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'results':checks,'sourceIdentities':[{'path':p,'bytes':len(blob(SOURCE,p)),'sha256':sha(blob(SOURCE,p))} for p in files]}
print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
