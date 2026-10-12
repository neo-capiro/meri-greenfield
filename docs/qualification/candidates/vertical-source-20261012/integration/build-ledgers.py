"""Preserve all original scope/requirement rows; distinguish source and runtime."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
BASE='cbbd8c5a7fe94d977b7da896ff7d01c959815fac'
PATH='docs/qualification/candidates/read-continuation-20261012/plan-receipt-join/requirements.json'
raw=subprocess.check_output(['git','show',f'{BASE}:{PATH}'],cwd=ROOT)
prior=json.loads(raw)
assert len(prior['requirements'])==53
components={
 'portfolio':{'operations':['get_research_evidence'],'source':'62062236e38ac77b9494a04668df6969ab1f33e2','review':'c94867684d14b2517a1a1c3f040ce4194d7c1fc6','behavior':'Fixed projected review/snapshot/current-continuity GET adapters; all four review lanes; shared response cleanup.','remaining':['Qualified current identity/source/client disclosure adapters','Raw member and unrestricted historical evidence unavailable']},
 'commands':{'operations':['create_task','update_task','save_memory','save_chat_attachments'],'source':'ca506ba1591b35eae5d389e551787017328eea73','review':'eb19cd4023434a9016598e07fbf6e607193d9229','behavior':'Concrete guarded command journal, fixed HTTP producers and actual shared durable budget composition.','remaining':['Qualified preparation metadata persistence/delivery identity and current approval producers','Real database/JWT/credential/source qualification','Personal memory pending-only producer unavailable; no autocommit fallback']},
 'schedules':{'operations':['schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task'],'source':'b5d0f55108a375ce15eed97d3a7a6926558221af','review':'55eb24267c91ff30cf7d1f61ac15f41fe3f71a5e','behavior':'Concrete Temporal create/update/cancel/describe/original-run adapters and application Postgres ownership journal.','remaining':['Qualified task/template/destination/limits/current-authority resolution','Real database and Temporal topology/recovery','History partial and retry-currentness unverified; cancellation ACK not physical stop']},
 'artifacts':{'operations':['create_word','create_excel','create_powerpoint','run_analysis'],'source':'47aef9f9a58d14a932ddc0b8cfdaf1475a5cb1ae','review':'3e4166b3d164ad5d589b8dbdcf87c9f144cd1cbe','behavior':'Concrete local library creation/revision/inspection/download with immutable provenance and admitted general-program boundary.','remaining':['Native Office rendering/recalculation/quality and sandbox admission','Production storage/current-authority and general inspection/publication adapters','Local executor is not a sandbox; general code never runs on this local host']}
}
catalog=json.loads((ROOT/'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
records=[]
for row in catalog['originals']:
 r=dict(row);family=next((name for name,v in components.items() if row['id'] in v['operations']),None)
 r['continuationFamily']=family;r['productionAvailable']=False;r['runtimeQualified']=False
 r['sourceEvidence']=components[family] if family else {'status':'PREVIOUS_SOURCE_OR_DEFERRED_PRESERVED'}
 records.append(r)
ledger={'catalogVersion':catalog['catalogVersion'],'original':139,'selected':96,'deferred':43,'mappedUnavailable':sum(x['state']=='mapped' for x in records),'selectedPending':sum(x['disposition']=='selected' and x['state']=='pending' for x in records),'typedUnavailable':len(catalog['operations']),'sourceEnabled':False,'runtimeAccepted':False,'meaning':'Mapped means exact private source contract and owned execution/read path, not production readiness or full native parity. Explicit adapter and unsupported-subscope obligations remain.','records':records}
(OUT/'capability-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
affected={'W01':['portfolio','commands','schedules','artifacts'],'W04':['portfolio'],'W05':['commands','schedules'],'W07':['artifacts'],'W08':['commands'],'W09':['portfolio','commands','schedules','artifacts'],'R-01':['portfolio','commands','schedules','artifacts'],'R-04':['portfolio','commands','schedules','artifacts'],'R-05':['portfolio','commands','schedules','artifacts'],'REL-02':['portfolio','commands','schedules','artifacts'],'REL-06':['portfolio','commands','schedules','artifacts'],'G4':['artifacts','schedules'],'G5':['commands'],'RG-02':['portfolio','commands','schedules','artifacts'],'RG-05':['portfolio','commands','schedules','artifacts'],'RG-07':['portfolio','commands','schedules','artifacts']}
reqs=[]
for old in prior['requirements']:
 families=affected.get(old['id'],[])
 reqs.append({'id':old['id'],'governingRequirement':old,'status':old['status'],'qualifiedRuntime':False,'continuationSourceFamilies':families,'continuationComponents':[components[x] for x in families],'wholeCriterionPromotion':False,'remainingDisposition':'Original whole requirement remains pending unless already accepted discovery; new source components do not close its runtime/UI/native/evaluation obligations.','nativeEvidence':'Parent-reported only; both supported Library transfers blocked; no native evidence joined.'})
assert sum(r['status']=='completed-source' for r in reqs)==2
out={'governingSource':{'commit':BASE,'path':PATH,'sha256':hashlib.sha256(raw).hexdigest()},'counts':{'requirements':53,'completedSourceDiscovery':2,'wholePending':51,'wholeRuntimeQualified':0},'gateState':{'G0':'ACCEPTED','G1':'OPEN','G2-G7':'UNENTERED'},'sourceEnabled':False,'nativeSummaryJoined':False,'records':reqs}
(OUT/'requirements-continuation.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in ledger.items() if k not in ['records','meaning']}))
