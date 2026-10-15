"""Reproduce this docs-only overlay from explicit Git objects; no network or runtime imports."""
from pathlib import Path
import subprocess, json, hashlib, posixpath, re
from collections import Counter

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
MAIN = '8b123bea4c90794dc2d766814b6ddbdbfe0928bc'
FABLE = 'f0befe1e486cfda644f1f6170cf3d9d671e5158f'
COORD = 'e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7'
CANDIDATE = '5bedcf675b86de6ca3b48a76d6513674f346d86e'
REPO = 'neo-capiro/meri-greenfield'
ASOF = '2026-10-15'

def blob(pin, path):
    return subprocess.check_output(['git', 'show', pin+':'+path], cwd=ROOT)
def js(pin, path): return json.loads(blob(pin, path))
def digest(value): return hashlib.sha256(value).hexdigest()
def link(pin, path): return f'https://github.com/{REPO}/blob/{pin}/{path}'
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, indent=2, ensure_ascii=False)+'\n').encode())
def evidence(pin, path, level, boundary):
    b = blob(pin, path)
    return dict(repository=REPO, commit=pin, path=path, bytes=len(b), sha256=digest(b), url=link(pin,path), evidenceLevel=level, boundary=boundary)

PLAN = 'docs/plans/MERI-DEPLOYMENT.md'
assert digest(blob(MAIN,PLAN)) == '43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388'
assert blob(MAIN,PLAN) == blob(FABLE,PLAN)
original = js(FABLE,'docs/qualification/candidates/original-runtime-20261013/reconciliation.json')
catalog = js(FABLE,'packages/contracts/retrieval-0.2/catalog.json')
originals = {r['id']:r for r in catalog['originals']}
operations = {(r['operation']['id'],r['operation']['version']):r for r in catalog['operations']}
assert len(originals)==139 and Counter(r['disposition'] for r in originals.values())=={'selected':96,'deferred':43}
assert len(operations)==97 and all(r['handler'] is None and r['availability']=='unimplemented' for r in operations.values())

units = {
 'master':evidence(MAIN,PLAN,'MASTER_REQUIREMENT','R2 successor; full v1 and original quantitative gates retained.'),
 'inventory':evidence(FABLE,'docs/SOURCE-INVENTORY.md','DISCOVERY_METADATA','22-domain accepted inventory, not live coverage or credentials.'),
 'catalog':evidence(FABLE,'packages/contracts/retrieval-0.2/catalog.json','DESCRIPTOR_SOURCE','96 selected references mapped;97 descriptors all handler:null/unimplemented. Separate installed source may exist; no absence or runtime inference.'),
 'skills':evidence(FABLE,'packages/skills/assets.json','MANIFEST_SOURCE','14 indexed original manifest/prose pairs; not complete executable skill workflows.'),
 'runtime':evidence(FABLE,'apps/runtime/control.mjs','UNACCEPTED_PRODUCT_SOURCE','Real runtime source exists;17 independent correction findings remain. Not full first chat or runtime admission.'),
 'conversations':evidence(FABLE,'apps/control/conversations/service.mjs','UNACCEPTED_PRODUCT_SOURCE','Conversation source and local evidence; composed native lifecycle/retirement/reauth/retention acceptance outstanding.'),
 'retention':evidence(FABLE,'apps/control/retention/purge.mjs','UNACCEPTED_PRODUCT_SOURCE','Retention source exists; consistency/recovery/target/identity corrections outstanding. Production purge disabled.'),
 'durabilityMap':evidence(FABLE,'docs/coordination/reports/FABLE-DURABILITY-COVERAGE-MAP-20261014.md','HISTORICAL_COVERAGE_MAP','Report is pinned to PR86 c6053e24, not a rerun or coverage acceptance of f0.'),
 'documentMap':evidence(FABLE,'docs/coordination/reports/FABLE-DOCUMENT-COVERAGE-MAP-20261014.md','HISTORICAL_COVERAGE_MAP','PR86 coverage; local artifacts/process/PG controls do not establish live native output.'),
 'corrections':evidence(COORD,'docs/coordination/reports/DOT-FABLE-PICKUP-ALLOCATION-ADDENDUM-20261015.md','REVIEWED_CORRECTION_AND_ALLOCATION','17 findings remain; only namespace decisions accepted. Fable retains runtime files.'),
 'allocations':evidence(COORD,'docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md','CENTRAL_SOURCE_ALLOCATION','0009 confirmed; conversations0010/artifacts0002 retention reserved;0011 Fable issuance reserved. No SQL application.'),
 'frontendDecision':evidence(FABLE,'docs/coordination/DECISIONS.md','HUMAN_OWNERSHIP_DECISION','D005 browser host exception;D014 capiro-frontend ownership. Newer user consolidation/mobile/development-owner directions apply.'),
 'strategyCandidate':evidence(CANDIDATE,'docs/coordination/reports/DOT-STRATEGY-CANDIDATE-V2-PICKUP-20261015.md','CANDIDATE_SOURCE_UNWIRED','21 local tests/38 byte-verified files/30 fingerprints; overall cross-repository acceptance pending; no workload identity/store/public wire.'),
 'resultProposal':evidence(CANDIDATE,'docs/coordination/tasks/CODEX-STRATEGY-RESULT-STORE-0012-PROPOSAL-20261015.md','UNRESERVED_DESIGN_PROPOSAL','0012 not reserved; no assigned SQL writer. Fable recommended after explicit allocation. No second issuer/budget/product-write owner.')
}

# Repair facts only. Imported workbook fields, accepted scope and NOT_QUALIFIED remain intact.
cap_path=ROOT/'docs/coordination/r2/capabilities.json'
caps=json.loads(cap_path.read_text(encoding='utf-8'))
assert {r['fields']['ID'] for r in caps['records']}==set(originals)
cap_rows=[]
for r in caps['records']:
    native=r['fields']['ID']; op=originals[native]
    assert r['acceptedScope']['disposition']==op['disposition'] and r['runtimeParity']=='NOT_QUALIFIED'
    if op['disposition']=='selected':
        replacement=op['replacement']; assert replacement and (replacement['id'],replacement['version']) in operations
        r['replacementOperation']=replacement
        r['replacementState']='CANDIDATE_DESCRIPTOR_MAPPED; NOT_INTEGRATED_OR_RUNTIME_QUALIFIED'
        r['replacementEvidence']={'commit':FABLE,'path':units['catalog']['path'],'sha256':units['catalog']['sha256'],'catalogVersion':catalog['catalogVersion'],'evidenceLevel':'DESCRIPTOR_SOURCE'}
    else: assert r['replacementOperation'] is None
    cap_rows.append(dict(id=native,selection=op['disposition'],owner=r['acceptedScope']['ownerLane'],acceptedBoundary=r['acceptedScope']['boundary'],sourceCommit=FABLE,replacement=op['replacement'],evidenceLevel='DESCRIPTOR_SOURCE' if op['disposition']=='selected' else 'DEFERRED_SCOPE',runtimeParity='NOT_QUALIFIED',remainingGate='Selected: qualify actual handler/domain policy/current source and held-out end-to-end behavior before parity. Deferred: no implementation or release claim without explicit selection.'))
caps['sourceProgressAsOf']=ASOF; caps['sourceProgressCrosswalk']='../master-crosswalk-20261015/crosswalk.json'
caps['sourceProgressBoundary']='References describe exact Fable candidate source only; no candidate source is integrated into main or activated by this documentation.'
write(cap_path,caps)

asset_index=js(FABLE,'packages/skills/assets.json'); assets={a['skillId']:a for a in asset_index['assets']}
skill_path=ROOT/'docs/coordination/r2/skills.json'; skills=json.loads(skill_path.read_text(encoding='utf-8'))
assert len(assets)==14 and {r['fields']['ID'] for r in skills['records']}==set(assets)
skill_rows=[]
for r in skills['records']:
    asset=assets[r['fields']['ID']]
    mp=posixpath.normpath('packages/skills/'+asset['manifestPath']); pp=posixpath.normpath('packages/skills/'+asset['prosePath'])
    mb=blob(FABLE,mp); pb=blob(FABLE,pp); m=json.loads(mb)
    assert m['skillId']==asset['skillId'] and m['skillVersion']==asset['skillVersion'] and digest(pb)==asset['proseSha256']
    r['manifestVersion']=asset['skillVersion']; r['integrationDisposition']='Original manifest/prose source present; required-source completion, actual workflow and end-to-end runtime qualification pending.'
    r['sourceEvidence']={'commit':FABLE,'manifestPath':mp,'manifestFileSha256':digest(mb),'prosePath':pp,'proseFileSha256':digest(pb),'evidenceLevel':'MANIFEST_SOURCE','runtimeQualification':'NOT_QUALIFIED'}
    skill_rows.append(dict(id=asset['skillId'],selection='SELECTED_R2_INTENT',owner='Codex skill contracts; Fable runtime; frontend invocation owner',source=r['sourceEvidence'],version=asset['skillVersion'],remainingGate='Complete required-source/workflow/permission/evidence and send/follow-up/resume qualification; Bill Watch existing brief is a bounded subset, not full federal/state workflow parity.'))
skills['sourceProgressAsOf']=ASOF;skills['sourceProgressCrosswalk']='../master-crosswalk-20261015/crosswalk.json';skills['sourceProgressBoundary']='Versioned assets exist at the cited Fable candidate pin; no full workflow, integration or runtime qualification follows.';write(skill_path,skills)

specific={
 'W00':('Codex integration','master inventory frontendDecision','Preserve discovery acceptance; current source/client/identity activation is G2/G3, not inferred.'),
 'W01':('Codex contracts; respective backend/frontend owners','catalog skills strategyCandidate','Finish reviewed typed contracts/handler/source/control mappings. Joint Strategy target/attempt/provenance/clock semantics remain open before any freeze.'),
 'W02':('Fable runtime source; Shipping native qualification','runtime corrections','Close source findings and qualify immutable image, actual SDK/proxy/discovery/egress/restore/browser host and Temporal requirements;G1 OPEN.'),
 'W03':('Shipping infrastructure; Codex integration','allocations runtime','Accept full isolated product foundation/OIDC/services/persistence/network/runbooks. Namespace reservations or qualification stacks do not establish G2.'),
 'W04':('Backend/source gateway owners; Codex integration','catalog inventory','Qualify actual selected-domain handlers, current native identities/client walls/mail/memory grants, full read/paging/evidence coverage and agreed revocation bound across22 inventory domains.'),
 'W05':('Fable runtime/durability; Shipping execution','conversations retention corrections durabilityMap allocations','Close durable issuance, actual startup/transport/current authority, retention suppression, physical retirement/revocation and full recovery/approvals/schedules gates. First chat is a child milestone.'),
 'W06':('capiro-frontend product owner; Meri backend event owner','frontendDecision skills runtime','Qualify accepted visible controls and real identity/stream/history/approval/artifact/schedule wiring in the consolidated frontend; mobile explicitly deferred, never marked passed.'),
 'W07':('Fable artifact/browser source; Shipping host; frontend viewers','documentMap runtime','Qualify native files/render/revise/versions/preview/download/filing and public browser; authenticated workflows individually. Local artifacts and PR86 maps are not current runtime qualification.'),
 'W08':('Backend/source command owners; Fable caller integration','catalog corrections','Memory proposals/tasks/artifact filing require current approval/expiry/idempotency and exact outcomes; no second Strategy/Planner owner or implicit additional source mutations.'),
 'W09':('Independent QA/review; Codex gate owner','master durabilityMap documentMap corrections','Run full original task/isolation/source/UI/artifact/recovery/load/lifecycle suites and held-out R2 cohorts; no sum of unrelated local captures is a gate result.'),
 'W10':('Shipping; independent QA; Codex release coordinator','master corrections allocations','Exact immutable source/image/config/contracts/migrations/Temporal/corpus cohort;staging,restore,rollback,in-flight compatibility and retention evidence;G6 unaccepted.'),
 'W11':('Codex release owner; explicit human authorization','master','Internal/bounded tenant canary after staging acceptance;quality/cost/error evidence,kill switches and rollback;G7 unaccepted.')
}
gate_sources={'G0':'master inventory frontendDecision','G1':'runtime corrections catalog skills','G2':'runtime allocations','G3':'catalog inventory','G4':'runtime conversations durabilityMap documentMap skills frontendDecision','G5':'catalog corrections','G6':'master corrections','G7':'master'}
optional={'R-11','R-12','REL-07','REL-08','RG-10','RG-11'}
tables={}
for path,key in [('requirements.json','Requirement ID'),('tickets.json','Ticket ID'),('gates.json','Gate ID')]:
    for r in js(FABLE,'docs/coordination/r2/'+path)['records']: tables[r['fields'][key]]=r['fields']
rows=[]
for r in original['records']:
    rid=r['id']; copied=r['originalRequirement']; locator=r['originalLocator']
    assert digest(copied.encode())==locator['rowSha256']
    if rid.startswith('W'): owner,source_ids,remaining=specific[rid]
    elif rid.startswith('G'):
        owner='Codex gate owner with independent/source/frontend/Shipping evidence';source_ids=gate_sources[rid];remaining='Full original gate evidence remains required;historical G0 accepted,G1 OPEN,G2-G7 unaccepted. Source/tests never advance a gate.'
    else:
        fields=tables[rid];owner='Codex coordination; current source/runtime/frontend owner; independent QA (historical workbook owner preserved below)'
        source_ids='catalog skills' if rid.startswith('R-') or rid in {'REL-02','REL-03','REL-04'} else 'master runtime corrections'
        if rid in optional: source_ids='master'
        remaining=fields.get('Completion evidence') or fields.get('Fixtures and protocol') or fields.get('Implementation rule')
        remaining+='; full native/end-to-end current-authority acceptance remains unestablished by this source crosswalk.' if rid not in optional else '; disabled optional, no core release blocker unless explicitly promoted.'
    rows.append(dict(id=rid,requirement=copied,originalLocator=locator,selection='DISABLED_OPTIONAL' if rid in optional else 'SELECTED_CORE',currentOwner=owner,originalWorkbookFields=tables.get(rid),sourceEvidence=[s for s in source_ids.split()],evidenceLevel='HISTORICAL_DISCOVERY_ACCEPTED' if rid in {'W00','G0'} else 'DISABLED_OPTIONAL' if rid in optional else 'PARTIAL_SOURCE_OR_DESIGN_NO_WHOLE_GATE_ACCEPTANCE',remainingGate=remaining,wholeRuntimeQualified=False,historicalAssessment={'commit':FABLE,'path':'docs/qualification/candidates/original-runtime-20261013/reconciliation.json','class':r['primaryClass'],'status':r['status'],'boundary':'Historical classification is not a current claim that source is absent.'}))
assert len(rows)==53 and len({r['id'] for r in rows})==53
plan_lines=blob(MAIN,PLAN).decode().splitlines()
criteria=[l for l in plan_lines if l.startswith('| ') and any(l.startswith('| '+s+' |') for s in ['Real work','Cross-tenant isolation','Within-tenant authorization','Revocation','Source coverage','Current Meri scope','Native artifacts','Recovery and side effects','User interface','Design traceability','Visual and responsive behavior','Interaction and accessibility','Mode switch','Browser operation','Performance and cost','Data lifecycle','Deployment operations','Reuse'])]
assert len(criteria)==18
result=dict(schema='meri-master-source-crosswalk/20261015',asOf=ASOF,authority='Existing master+explicit human changes; this is an evidence overlay, not a replacement plan or scope decision.',mainPin=MAIN,fableSourcePin=FABLE,sourceUnits=units,counts={'requirements':53,'historicalDiscoveryAccepted':2,'coreOpen':45,'optionalDisabled':6,'wholeRuntimeQualified':0,'nativeCapabilities':139,'selected':96,'deferred':43,'selectedDescriptorsMapped':96,'operationDescriptors':97,'originalSkillAssets':14,'runtimeQualifiedSkills':0},masterRequirements=rows,nativeCapabilities=cap_rows,originalSkills=skill_rows,preservedReleaseCriteria=criteria,revocation={'targetMs':30000,'acceptedOrMeasuredHere':False,'requiredDecision':'Agree numeric bound beforeG3, then measure actual revocation across live and stored context.'},userApprovedChanges=[{'id':'D005','change':'Measured Fargate browser failure permits dedicated isolated browser-host qualification; no actual host/security acceptance inferred.'},{'id':'D014+later consolidation','change':'Product UI in neo-capiro/capiro-frontend consolidated application; Meri backend/contracts stay separate. No duplicate Meri frontend required.'},{'id':'20261015 mobile direction','change':'Mobile deferred by explicit current user direction; original requirement retained as deferred, no mobile PASS or silent removal.'},{'id':'development ownership','change':'Current explicit Codex/Fable/backend/frontend/Shipping ownership governs. Historical Hermes examples/worker methods are not product runtime features or mandatory overrides.'}],childMilestones=[{'name':'first authenticated chat and continuation repair','parentRequirements':['W02','W05','W06','G1','G4','RG-12'],'sourceUnit':'runtime','status':'Source/correction child milestone; not fullv1.'},{'name':'retention/issuance fixes','parentRequirements':['W05','W09','G4','G6','RG-07','RG-12'],'sourceUnit':'corrections','status':'Source HOLD pending17 findings; allocation only is accepted.'},{'name':'typed Strategy/backend integration candidate','parentRequirements':['W01','W04','W05'],'sourceUnit':'strategyCandidate','status':'Separately user-directed source candidate; no D012 scope reclassification, issuer, dispatcher or product write.'}],trackingRepairs=['96 selected replacement references now explicitly derived from exact f0 catalog;runtimeParity remainsNOT_QUALIFIED.','14 manifest versions/prose locations now derived from exact f0 assets;workflow/runtime qualification stayspending.','PR86 coverage maps stayhistorical; f0 current source and17 findings cited separately.','Central0009/0010/artifacts0002/0011 allocations replace obsolete no-migrations claim;0012 remainsunreserved.','Humanaccepted96/43 wording rendered asaccepted; original proposal provenance preserved inGit.','Whole W03-W11 queue labels do not imply no source; sourcechildprogress and runtimegate acceptance trackedseparately.'],scopeBoundary='No source missing inference from stale/null ledger fields; no deployed/source-policy/image/browser/artifact/recovery/RG PASS from source/tests. All remaining original thresholds apply. Current native installation/authority must be reverified by their owners.')
write(OUT/'crosswalk.json',result)
write(OUT/'verification.json',{'status':'PASS_DOCUMENT_CONSISTENCY_ONLY','mainPin':MAIN,'fablePin':FABLE,'preservedRequirementRows':53,'rowHashesVerified':53,'preservedReleaseCriteria':18,'nativeIDs':139,'selected':96,'deferred':43,'selectedRefsVerified':96,'operationDescriptors':97,'allDescriptorHandlersUnavailable':True,'skillManifestProsePairsVerified':14,'runtimePromotions':0,'sourceUnitFileHashesVerified':len(units),'crosswalkSha256':digest((OUT/'crosswalk.json').read_bytes()),'notRun':'No runtime,model,AWS,SQL,source activation or qualification suite.'})
print(json.dumps({'status':'PASS_DOCUMENT_CONSISTENCY_ONLY','requirements':53,'scope':'96selected/43deferred','mappedDescriptors':96,'manifests':14,'runtimePromotions':0}))
