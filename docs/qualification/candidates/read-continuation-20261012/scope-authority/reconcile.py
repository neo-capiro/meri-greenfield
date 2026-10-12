"""Offline inventory/authority evidence. Read Git objects and OOXML as data only."""
import collections, hashlib, io, json, subprocess, xml.etree.ElementTree as ET, zipfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
BASE='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
PROPOSAL='7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3'
HUMAN_RECORD='3406ed7e01af3aef85aeebc00fc49f6f41002bc5'
G0='c558b1533e88122f2bc4fb4a11c47e2c5c38768b'
R2='e14564e6ca4747fe97cf911ede3c816a295ba59c'
LATEST='753566baf2d230ed241941dcdeca41625277cb1d'
checks=[]; references={}
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def sha(b):return hashlib.sha256(b).hexdigest()
def check(name,result):
 checks.append({'check':name,'pass':bool(result)})
 if not result:raise AssertionError(name)
def write(name,data):(HERE/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
def ref(commit,path):
 key=commit+':'+path
 if key not in references:
  b=git('show',key)
  references[key]={'commit':commit,'path':path,'blob':git('rev-parse',key).decode().strip(),'bytes':len(b),'sha256':sha(b),'url':f'https://github.com/neo-capiro/meri-greenfield/blob/{commit}/{path}'}
 return key
def data(commit,path):ref(commit,path);return git('show',commit+':'+path)
def citation(commit,path,locator):return {'reference':ref(commit,path),'locator':locator}
catalogPath='packages/contracts/retrieval-0.2/catalog.json'
catalog=json.loads(data(LATEST,catalogPath)); baseCatalog=json.loads(data(BASE,catalogPath))
deferred=[r for r in catalog['originals'] if r['disposition']=='deferred']
check('latest139 originals unique',len(catalog['originals'])==len({r['id'] for r in catalog['originals']})==139)
check('96 selected43 deferred',collections.Counter(r['disposition'] for r in catalog['originals'])=={'selected':96,'deferred':43})
check('all43 deferred records exact across base and latest',deferred==[r for r in baseCatalog['originals'] if r['disposition']=='deferred'])
scopePath='docs/CAPABILITY-SCOPE.md'
proposal=data(PROPOSAL,scopePath).decode().splitlines(); accepted=data(G0,scopePath).decode().splitlines()
scopeNow=data(BASE,scopePath).decode().splitlines()
metadata=json.loads(data(BASE,'docs/CAPABILITIES.json')); access={r['name']:r for r in metadata['capabilities']}
r2Path='docs/coordination/r2/capabilities.json'; r2=json.loads(data(R2,r2Path)); byId={r['fields']['ID']:r for r in r2['records']}
wbPath='docs/plans/revisions/20261010-R2/Meri_Capability_Inventory-20261010-R2.xlsx'
archive=zipfile.ZipFile(io.BytesIO(data(R2,wbPath)));ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[]
if 'xl/sharedStrings.xml' in archive.namelist():
 strings=[''.join(x.itertext()) for x in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si',ns)]
cells={}
for c in ET.fromstring(archive.read('xl/worksheets/sheet4.xml')).findall('.//s:c',ns):
 if c.get('t')=='inlineStr':value=''.join(c.find('s:is',ns).itertext())
 else:
  v=c.find('s:v',ns);value='' if v is None else v.text
  if c.get('t')=='s':value=strings[int(value)]
 cells[c.get('r')]=value
check('workbook native ID header',cells['A7']=='ID' and cells['F7']=='Coverage status')
check('workbook139 native IDs',len([k for k in cells if k.startswith('A') and k[1:].isdigit() and 8<=int(k[1:])<=146])==139)
decisionPath='docs/coordination/DECISIONS.md'
humanLines=data(HUMAN_RECORD,decisionPath).decode().splitlines(); g0Lines=data(G0,decisionPath).decode().splitlines()
lineOf=lambda lines,part:next(i for i,s in enumerate(lines,1) if part in s)
humanCitation=citation(HUMAN_RECORD,decisionPath,{'lines':[lineOf(humanLines,'## D011'),lineOf(humanLines,'finalize the documented v1')]})
g0Citation=citation(G0,decisionPath,{'lines':[lineOf(g0Lines,'## D012'),lineOf(g0Lines,'Codex integration owner accepted G0')]})
rows=[]
for originalIndex,row in enumerate(catalog['originals']):
 if row['disposition']!='deferred':continue
 identifier=row['id']; pLine=lineOf(proposal,'| '+identifier+' |'); aLine=lineOf(accepted,'| '+identifier+' |'); currentLine=lineOf(scopeNow,'| '+identifier+' |')
 pCells=[s.strip() for s in proposal[pLine-1].split('|')[1:-1]]; w=byId[identifier]; number=w['row']
 check(identifier+' exact proposal reason',pCells[2]=='proposed deferred' and pCells[-1]==row['boundary'])
 check(identifier+' unchanged accepted row',proposal[pLine-1]==accepted[aLine-1]==scopeNow[currentLine-1])
 check(identifier+' R2 retained disposition/reason',w['acceptedScope']['disposition']=='deferred' and w['acceptedScope']['boundary']==row['boundary'])
 check(identifier+' exact workbook cells',all(cells[col+str(number)]==w['fields'][field] for col,field in [('A','ID'),('B','Category'),('E','New Meri coverage'),('F','Coverage status'),('G','Action to retain parity')]))
 check(identifier+' null replacement and deferred state',row['replacement'] is None and row['state']=='deferred')
 rows.append({'id':identifier,'disposition':'deferred','sourceState':'deferred','replacement':None,'registryReadOnly':access[identifier]['readOnly'],
  'reason':row['boundary'],'reasonMeaning':'Historical proposal rationale, not independently requalified current technical impossibility and not permanent cancellation.',
  'reasonOrigin':{'date':'2026-10-09','kind':'recorded_proposal','citation':citation(PROPOSAL,scopePath,{'line':pLine}),'humanAuthorshipOfReasonProven':False},
  'catalogCitation':citation(LATEST,catalogPath,{'jsonPointer':f'/originals/{originalIndex}'}),
  'acceptedLedgerCitation':citation(G0,scopePath,{'line':aLine,'acceptanceHeaderLines':[3,13,15]}),
  'authority':{'classification':'recorded_human_batch_approval','decision':'D011','recordedDecisionDate':'2026-10-10','citation':humanCitation,
   'independentPrimaryHumanTranscriptLocated':False,'individualHumanReasonOrApprovalLocated':False,
   'scope':'Documented first-release selection/defer decision; not a runtime pass, permanent abandonment or authorization to narrow later full-completion instructions.'},
  'g0Acceptance':{'kind':'Codex discovery acceptance, separate from human scope decision','citation':g0Citation},
  'r2Workbook':{'citation':citation(R2,wbPath,{'sheet':'Current native tools','row':number,'cells':[f'A{number}',f'B{number}',f'E{number}:G{number}']}),
   'category':w['fields']['Category'],'coverageStatus':w['fields']['Coverage status'],'scopeText':w['fields']['New Meri coverage'],'parityAction':w['fields']['Action to retain parity'],
   'dimensionDiffersFromNativeDisposition':w['fields']['Coverage status']!='Deferred by initial command scope'},
  'r2ReconciliationCitation':citation(R2,'docs/coordination/reports/CODEX-R2-ADOPTION.md',{'section':'Scope and discrepancies'}),
  'unprovenEvidence':['Underlying10October chat approval and its exact presented ledger attachment/version','Individual human authorship of this technical rationale','Any later human decision making this deferral permanent or cancelling related required product behavior'],
  'dispositionChangedByThisAudit':False})
write('deferred-ledger.json',{'schema':'meri-scope-authority-ledger/1','base':BASE,'catalogCommit':LATEST,'originalCount':139,'selectedCount':96,'deferredCount':43,'deferredReadOnly':sum(r['registryReadOnly'] for r in rows),'deferredWrites':sum(not r['registryReadOnly'] for r in rows),'authorityBoundary':'Repository records human batch approval; no underlying primary transcript was available in inspected tracked records. Current explicit instructions prevail. No reclassification.', 'entries':rows})
inputs=[]
paths=['docs/plans/Meri_Greenfield_Agent_Plan.docx','docs/handover/20261012/inputs/Meri_Greenfield_Agent_Plan.original.docx','docs/plans/archive/MERI-DEPLOYMENT-20261009-before-figma.md','docs/plans/archive/MERI-DEPLOYMENT-20261010-before-R2.md','docs/handover/20261012/inputs/Meri_Codex_Hermes_Deployment_Plan.original.md','docs/plans/MERI-DEPLOYMENT.md','docs/plans/revisions/20261010-R2/Meri_Codex_Hermes_Deployment_Plan-R2.md',wbPath,'docs/plans/revisions/20261010-R2/manifest.json','docs/handover/20261012/inputs/manifest.json','docs/handover/20261011/Meri_Greenfield_Engineering_Handover_2026-10-11.docx','docs/handover/20261011/Meri_Greenfield_Engineering_Handover_2026-10-11.md']
for path in paths:
 key=ref(BASE,path);introduced=git('log','--format=%H %aI %s','--diff-filter=A',BASE,'--',path).decode().splitlines()
 inputs.append({'reference':key,'available':True,'firstAdditionHistory':introduced})
docx=zipfile.ZipFile(io.BytesIO(data(BASE,paths[0])));dn={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paragraphs=[''.join(t.text or '' for t in p.findall('.//w:t',dn)) for p in ET.fromstring(docx.read('word/document.xml')).findall('.//w:p',dn)]
locators=[]
for number,expected in [(11,'139'),(91,'memory proposals'),(206,'Full parity'),(208,'selected, deferred'),(212,'corrections, review, and lifecycle'),(223,'initial command set')]:
 check('DOCX paragraph'+str(number),expected in paragraphs[number-1]);locators.append({'oneBasedAllParagraphIndex':number,'paragraphSha256':sha(paragraphs[number-1].encode()),'textRetained':False})
check('originalDOCX exact duplicate',data(BASE,paths[0])==data(BASE,paths[1]))
check('originalFigma plan exact duplicate',data(BASE,paths[3])==data(BASE,paths[4]))
check('R2 plan exact duplicate',data(BASE,paths[5])==data(BASE,paths[6]))
write('input-lineage.json',{'inputs':inputs,'docxScopeLocators':{'xml':'word/document.xml','indexConvention':'1-based every descendant w:p, including table paragraphs and empty paragraphs; no filtered-body indexing','paragraphs':locators},'rawPrivateBodiesRetained':False,'formulasRecalculated':False,'missing':['No earlier pre-R2 capability workbook was found among tracked paths; its exact filename or byte identity was not established.','Underlying human chat approval described by D011 was not found as an exported transcript or signed row-level decision artifact.']})
timeline=[
 {'commit':PROPOSAL,'kind':'proposal','fact':'All43 present with exact current reasons; text explicitly provisional pending scope acceptance.','citation':citation(PROPOSAL,scopePath,{'lines':[1,3,11,13]})},
 {'commit':HUMAN_RECORD,'kind':'recorded_human_approval','fact':'D011 records batch human acceptance of96selected/43deferred; underlying chat not retained in located evidence.','citation':humanCitation},
 {'commit':G0,'kind':'recorded_human_scope_and_Codex_discovery','fact':'Scope header says all139 classifications accepted; D012 is Codex G0 discovery acceptance.','citation':g0Citation},
 {'commit':R2,'kind':'Codex_reconciliation_of_supplied_plan_workbook','fact':'Retains96/43 and records workbook dimension differences; four deferred rows carry Covered family labels. Report calls scope D012, while original human record is D011.','citation':citation(R2,'docs/coordination/reports/CODEX-R2-ADOPTION.md',{'section':'Scope and discrepancies'})},
 {'commit':BASE,'kind':'later_handover_restatement','fact':'Continued96/43 and explicitly states deferral is not deletion.','citation':citation(BASE,'docs/handover/20261012/REMOTE-RESUME-CURRENT-20261012.md',{'lines':[35,228]})},
 {'commit':LATEST,'kind':'current_source_catalog','fact':'139 originals,96selected/43deferred;66mapped30pending67typedoperations; source contracts do not imply live availability.','citation':citation(LATEST,catalogPath,{'jsonPointers':['/originals','/operations']})}
]
for event in timeline:event['gitCommitMetadata']=git('show','-s','--format=%H%n%aI%n%cI%n%an%n%s',event['commit']).decode().splitlines()
write('authority-timeline.json',{'events':timeline,'metadataBoundary':'Git author display name, commit time and commit message do not independently authenticate a human chat instruction.','currentInstruction':'Parent relayed Neo request to reconcile every deferral and full completion; this research neither broadens nor narrows approved execution/product scope.'})
for path in ['AGENTS.md','docs/IMPLEMENTATION-STANDARDS.md','docs/coordination/DECISIONS.md','docs/coordination/reports/CODEX-G0-DISCOVERY.md','docs/handover/20261011/CONTINUATION-INSTRUCTIONS.md','docs/handover/20261011/REFERENCE-INDEX.md','docs/handover/20261012/CONTEXT-INDEX.json','docs/decisions/MEMORY-ADMIN-SELF-APPROVAL-20261012.md']:ref(BASE,path)
write('reference-identities.json',{'references':list(references.values()),'readScope':'Public Meri planning/metadata objects; no legacy Capiro implementation import or private body publication.'})
write('offline-checks.json',{'checks':checks,'passed':len(checks),'failed':0,'currentCatalog':{'commit':LATEST,'counts':dict(collections.Counter(r['state'] for r in catalog['originals'])),'typedOperations':len(catalog['operations'])},'deferredWorkbookLabels':dict(collections.Counter(r['r2Workbook']['coverageStatus'] for r in rows))})
print(json.dumps({'passed':len(checks),'deferred':len(rows),'references':len(references)}))
