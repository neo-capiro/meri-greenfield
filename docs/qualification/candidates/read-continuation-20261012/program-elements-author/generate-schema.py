"""Author-owned schema construction from frozen scalar metadata, never private implementation."""
from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parents[5]
meta=json.loads(subprocess.check_output(['git','-C',str(root),'show','4b8368501acb22ea19486d7ab3a70eeebfd7e4da:docs/qualification/candidates/read-continuation-20261012/domain-source-next/scalar-inventory.json']))['models']
def ref(n):return {'$ref':'#/$defs/'+n}
def nullable(s):return {'anyOf':[s,{'type':'null'}]}
def obj(p,optional=()):return {'type':'object','properties':p,'required':[k for k in p if k not in optional],'additionalProperties':False}
def arr(s,**extra):return {'type':'array','items':s,**extra}
def enum(a):return {'enum':a.split()}
S={'type':'string'};N={'type':'number'};I={'type':'integer','minimum':-2147483648,'maximum':2147483647};B={'type':'boolean'};NN=nullable(N);NS=nullable(S);NI=nullable(I)
D={}
D['ProgramElementJson']={'anyOf':[{'anyOf':[{'type':kind} for kind in ['string','number','boolean','null']]},arr(ref('ProgramElementJson')),{'type':'object','additionalProperties':ref('ProgramElementJson')}]}
D['ProgramElementInstant']={'type':'string','format':'date-time','pattern':r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'}
D['ProgramElementDecimal']={'type':'string','pattern':r'^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$','description':'Meri normalized lossless Decimal(14,2) wire; adapter prerequisite, not legacy serialization proof.'}
D['ProgramElementContext']=obj({'evidenceAccuracyMode':enum('off shadow enforce')})
raw={'anyOf':[{'type':kind} for kind in ['string','number','boolean','null']]}
D['ProgramElementSearchRequest']=obj({k:raw for k in ['query','q','service','budgetActivity','hasData','page','limit']},['query','q','service','budgetActivity','hasData','page','limit'])
D['ProgramElementSearchInput']=obj({'query':NS,'service':NS,'budgetActivity':NS,'hasData':nullable(B),'page':{'type':'integer','minimum':1,'maximum':100},'limit':{'type':'integer','minimum':1,'maximum':50}})
for f in ['Detail','Timeline']:
 D['ProgramElement'+f+'Request']=obj({'peCode':S});D['ProgramElement'+f+'Input']=obj({'peCode':{'type':'string','minLength':1,'maxLength':32}})
D['ProgramElementClaimSource']=obj({k:NS for k in ['sourceDocumentId','documentType','budgetCycle','publisher','sourceUrl']}|{'pageNumber':NN,'observedAt':NS})
D['ProgramElementClaim']=obj({'value':NN,'fiscalYear':NI,'stage':enum('request hasc sasc ndaa_conference hacd sacd appropriations_conference enacted none'),'stageLabel':S,'legislativeVehicle':enum('request authorization authorization_conference appropriations appropriations_conference enacted none'),'cycleClass':enum('historical current outyear unknown'),'isProjection':B,'unit':{'const':'USD millions'},'enactmentStatus':enum('enacted not_enacted unknown'),'vehicleType':enum('budget_request authorization appropriation unknown'),'originalUnit':nullable(enum('dollars thousands millions')),'originalValue':NN,'source':ref('ProgramElementClaimSource'),'semantics':S},['enactmentStatus','vehicleType','originalUnit','originalValue','source','semantics'])
D['ProgramElementStage']=enum('request hasc sasc hacd sacd conference enacted none')
D['ProgramElementVehicle']=enum('authorization appropriation request none')
identity={'identifierKind':enum('pe procurement_line_item other'),'budgetExhibitType':enum('')}
identity['budgetExhibitType']={'enum':['R-1/R-2 RDT&E Program Element','P-1/P-40 procurement line item (NOT a Program Element)','budget line (exhibit type not classified)']}
D['ProgramElementFundingNote']={'const':'Per-chamber marks are NOT included in search results. Before stating or comparing figures, call get_pe_budget_timeline for the full request / HASC / SASC / HAC-D / SAC-D / conference / enacted breakdown with authorization-vs-appropriations labels. "current" is the furthest-along stage on record (not necessarily enacted); when its fiscal year differs from the request year, do not compute a change between them.'}
D['ProgramElementSearchFunding']=obj({'unit':{'const':'USD millions'},'current':nullable(obj({'value':N,'fy':NI,'stage':ref('ProgramElementStage'),'stageLabel':S,'vehicle':ref('ProgramElementVehicle')})),'request':nullable(obj({'value':N,'fy':NI})),'enacted':nullable(obj({'value':N,'fy':NI})),'enactedVsRequestPct':NN,'currentVsRequest':NS,'note':S})
row={'peCode':S,'title':S,'service':NS,'budgetActivity':NS,'appropriationType':NS,'status':NS,'lastSyncedAt':ref('ProgramElementInstant'),'hasData':B,'watched':B,'billCount':nullable({'type':'integer','minimum':0}),'requestAtEnactedFy':NN,'peCurrentCycleFy':NI,'signalType':NS,'signalScore':NN,'signalDeltaPct':NN,'lineType':NS,'maturity':NN,'appropTier':NS,'appropScore':NN,'actionSignalType':NS,'actionSignalTone':NS,'valleyOfDeath':nullable(B)}
row|={k:nullable(ref('ProgramElementClaim')) for k in ['currentClaim','requestClaim','enactedClaim','requestAtEnactedClaim']}
row|={'comparableEnactedVsRequest':nullable(obj({'fiscalYear':I,'enacted':N,'request':N,'deltaPct':NN})),**identity,'currentFundingClaim':nullable(ref('ProgramElementClaim')),'funding':ref('ProgramElementSearchFunding')}
D['ProgramElementFinderRow']=obj(row)
base={'tool':{'const':'search_program_elements'},'generatedAt':ref('ProgramElementInstant')}
D['ProgramElementSearchOutput']=obj(base|{'data':arr(ref('ProgramElementFinderRow'),maxItems=50),'total':{'type':'integer','minimum':0},'page':{'type':'integer','minimum':1,'maximum':100},'limit':{'type':'integer','minimum':1,'maximum':50}})
def scalar(fields):
 out={}
 for f in fields:
  typ=f['type'];native=f['nativeType'] or '';s={'String':S,'Int':I,'Float':N,'Boolean':B,'Json':ref('ProgramElementJson'),'Decimal':ref('ProgramElementDecimal'),'DateTime':ref('ProgramElementInstant')}[typ]
  if native=='Uuid':s={'type':'string','format':'uuid'}
  if f['nullable']:s=nullable(s)
  out[f['field']]=s
 return out
stored=scalar(meta['ProgramElement']['fields']);year=scalar(meta['ProgramElementYear']['fields']);milestone=scalar(meta['ProgramElementMilestone']['fields'])
D['ProgramElementYear']=obj(year|{'fundingClaim':nullable(ref('ProgramElementClaim'))})
D['ProgramElementStored']=obj(stored|{'years':arr(ref('ProgramElementYear')),'fundingSummary':S,'billCount':nullable({'type':'integer','minimum':0}),'projectCount':{'type':'integer','minimum':0},'sourceCount':{'type':'integer','minimum':0},'currentCycleFy':NI,'currentUserIsWatching':B})
D['ProgramElementLineageRow']=obj({'relType':enum('predecessor_successor same_program'),'status':enum('accepted candidate'),'fromCode':S,'toCode':S,'transitionFyFrom':NI,'transitionFyTo':NI,'evidence':ref('ProgramElementJson')})
D['ProgramElementLineage']=obj({'accepted':arr(ref('ProgramElementLineageRow')),'candidates':arr(ref('ProgramElementLineageRow')),'note':{'const':'Candidate lineage is unverified. A changed stage label or a shared narrative does not establish that one line was consolidated into another.'}})
common={'generatedAt':ref('ProgramElementInstant'),**identity,'currentCycleFy':NI,'currentFundingClaim':nullable(ref('ProgramElementClaim')),'lineage':ref('ProgramElementLineage')}
D['ProgramElementDetailOutput']=obj({'tool':{'const':'get_program_element'},**common,'programElement':ref('ProgramElementStored')},['lineage'])
marks=['request','hascMark','sascMark','ndaaConference','hacDMark','sacDMark','conference','enacted']
D['ProgramElementMissingMarks']=obj({k:enum('present not_applicable not_started candidate_gap unknown_coverage') for k in marks})
D['ProgramElementTimelineYear']=obj(year|{'cycle':enum('historical current outyear unknown'),'current':NN,'currentStage':ref('ProgramElementStage'),'currentStageLabel':S,'currentVehicle':ref('ProgramElementVehicle'),'currentDeltaVsRequestM':NN,'requestConflictValuesM':nullable(arr(N)),'fundingClaim':nullable(ref('ProgramElementClaim')),'missingMarks':ref('ProgramElementMissingMarks'),**{k:NN for k in ['predictedConferenceAmount','predictedConferenceAmountCiLow','predictedConferenceAmountCiHigh','predictedConferenceConfidence']}})
D['ProgramElementMilestone']=obj(milestone)
D['ProgramElementTimelineOutput']=obj({'tool':{'const':'get_pe_budget_timeline'},**common,'peCode':S,'title':S,'service':NS,'appropriationType':NS,'budgetActivity':NS,'lineNumber':NS,'fundingSummary':S,'years':arr(ref('ProgramElementTimelineYear')),'milestones':arr(ref('ProgramElementMilestone'))},['lineage'])
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:program-elements:0.2.0','title':'Private program-element finder, detail and timeline projections','$defs':D}
(root/'packages/contracts/retrieval-0.2/program-elements.schema.json').write_text(json.dumps(schema,indent=2)+'\n')
