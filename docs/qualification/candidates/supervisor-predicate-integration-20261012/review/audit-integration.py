"""Read exact public Git/document evidence only; no private/native/network input."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root=Path(sys.argv[1]);freeze=sys.argv[2]
base='15f671a65365e3401f0ce07b46deb4cf63538346'
roadmap='docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
report='docs/coordination/reports/MERI-SUPERVISOR-PREDICATE-INTEGRATION-20261012.md'
def git(*args):return subprocess.check_output(['git','-C',str(root),*args],timeout=10)
def body(p,ref=freeze):return git('show',ref+':'+p)
def js(p):return json.loads(body(p))
def tree(ref):
 return {v.split(b'\t',1)[1].decode():v.split(b'\t',1)[0].split()[2].decode() for v in git('ls-tree','-rz',ref).split(b'\0') if v}
checks=[]
def check(name,okay):checks.append({'name':name,'passed':bool(okay)})
before,after=tree(base),tree(freeze)
changed=[p for p in before if before[p]!=after.get(p)]
check('sole changed pre-existing file is canonical roadmap',changed==[roadmap])
check('all other original files including production source preserved',all(after.get(p)==v for p,v in before.items() if p!=roadmap))
new=sorted(set(after)-set(before))
roots=['docs/qualification/candidates/native-predicate-20261012/','docs/qualification/candidates/pgdg-metadata-20261012/','docs/qualification/candidates/supervisor-predicate-integration-20261012/integration/']
allowednames={f'docs/coordination/{kind}/{name}.md' for kind in ['tasks','reports'] for name in ['MERI-NATIVE-PREDICATE-20261012','MERI-NATIVE-PREDICATE-REVIEW-20261012','MERI-PGDG-METADATA-20261012','MERI-PGDG-METADATA-REVIEW-20261012','MERI-SUPERVISOR-PREDICATE-20261012','MERI-SUPERVISOR-PREDICATE-INTEGRATION-20261012']}
check('new files remain within allocated evidence and documentation',all(p in allowednames or any(p.startswith(q) for q in roots) for p in new))
refs=['7591d8670e53fa49876aa762b0407b8baf2c66ba','33e2ab2fbfa42c635f1ee69368da7fa24bc3cb91','76355bfe516260ba758dee44f9fcf454e317cd71','e98df5f1502a732cc22d6bc6d3911e4e8e956bfc']
check('PR19 base ancestry',subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',base,freeze],timeout=10).returncode==0)
picks=['26ad60bc96a4c04315b33064cf78832bb9b95970','7f236d6b95f7d0476e55e46a6d77af36655e3a25','1d2e42a1821e9927aa0f17813de1b8eaff6416da','ed0fb1fee6363952b0798e406862f963f9bc70b4']
for original,picked in zip(refs,picks):
 check('original exact delta matches integrated cherry-pick '+original,git('diff-tree','--no-commit-id','--raw','--no-abbrev','-r',original)==git('diff-tree','--no-commit-id','--raw','--no-abbrev','-r',picked))
 check('integrated cherry-pick ancestry '+picked,subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',picked,freeze],timeout=10).returncode==0)
for ref in refs:
 items=tree(ref)
 additions=[p for p in items if p not in before]
 check('exact accepted lane additions preserved '+ref,all(after.get(p)==items[p] for p in additions))
obs=js(roots[2]+'root-private-observation.json')
check('public recount has35 complete pairs and12 differences',obs['totalPairs']==35 and obs['differentPairs']==12 and [v['pairs'] for v in obs['roles']]==[9,8,9,9])
check('only reported access-time fields differ at0..2',all([x['index'] for x in role['differences']]==[0,1,2] and all(x['fields']==['LastAccessTime'] for x in role['differences']) for role in obs['roles']))
check('recorded four-term rejection remains false',list(obs['recordedAcceptanceTerms'].values())==[True,True,True,False] and obs['conjunction'] is False and obs['recordedAccepted'] is False)
helper={'name':'NativeMetadata.cs','bytes':6163,'sha256':'f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c'}
check('exact missing helper remains unreviewed',obs['missingHelper']==helper and obs['helperImplementationReviewed'] is False)
check('recount retains native and admission holds',obs['nativeExecution'] is False and obs['admissionChanged'] is False)
pg=js(roots[1]+'author/decision-package.json');capture=js(roots[1]+'author/retrievals.json')
check('eight retained proxy403 attempts have zero bodies',len(capture['records'])==8 and all(r['bytes']==0 and '403' in r['error'] for r in capture['records']))
check('PGDG authentication and supported-prefix gaps remain',pg['decision']=='HOLD_EXTERNAL_INPUT' and pg['executionStatus']=='NOT_EXECUTABLE' and pg['researchDelta']['signatureVerification']=='UNRUN_MISSING_RAW_INPUTS_AND_TRUST' and pg['researchDelta']['newBuildOrPrefixSupport']=='NONE_ESTABLISHED')
x=pg['externalDecisionPackage'];check('external metadata intake ceilings are finite',x['maxRawMetadataMembers']==7 and x['maxTotalMembersIncludingProvenanceAndSupportProfile']==9 and x['maxDecodedTransferBytes']==4194304 and x['maxIndividualMetadataBytes']==1500000)
check('no setup permission or launcher is claimed',pg['nextSetupDecision']['setupApprovalRequested'] is False and pg['nextSetupDecision']['setupCommand'] is None)
pr=js(roots[2]+'pr19-base-readback.json');check('captured PR19 exact head/base remains draft unmerged',pr['head_sha']==base and pr['base_sha']=='6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e' and pr['draft'] is True and pr['merged'] is False and pr['state']=='open')
text={p:body(p).decode() for p in [roadmap,report]}
check('both root documents pin exact missing helper',all(helper['name'] in t and helper['sha256'] in t for t in text.values()))
check('current execution absence is scoped to continuation',all('In this source continuation' in t for t in text.values()))
check('known original receipt is not requested again','1,407B/hash' in text[report] and 'not requested again' in text[report])
check('canonical capability and gate boundaries retained',all(k in text[roadmap] for k in ['139 original capabilities:96 selected/43 deferred','14 bound but unavailable/82 selected unmapped','14 named skills unqualified','G0 accepted; G1 OPEN; G2–G7 unentered','All source connectivity stays disabled']))
check('scope owners remain canonical',all(k in text[roadmap] for k in ['Claude Agent SDK','Temporal durability','AI SDK/Elements','Public0.1/private0.2','Existing Aurora stays selected']))
check('separate wrapper bindings remain visible',all(k in text[roadmap] for k in ['Separate [wrapper-binding fields]','source-verification.json','priorEvidenceFileCount','priorEvidenceFilesUnchanged','Git executable','enclosing watchdog']))
check('frozen L1 remains not executable and unauthorized','NOT_EXECUTABLE and not authorized' in text[roadmap])
ex=js(roots[2]+'pgdg-integrated-pin-explanation.json')
check('integrated historical-pin failures remain visible',ex['integratedReplay']['passed']==62 and ex['integratedReplay']['failed']==1 and ex['rawFailurePreserved'] is True and ex['independentReviewInitialRootInvocation']['passed']==96 and len(ex['independentReviewInitialRootInvocation']['failed'])==2 and ex['correctedExactAuthorRootReplay']['passed']==98)
receipts=[]
for name in ['pgdg-author','pgdg-review','pgdg-review-exact','predicate-author']:
 r=js(roots[2]+name+'.json');receipts.append(r)
 check('root check stream hashes '+name,all(len(body(s['path']))==s['bytes'] and hashlib.sha256(body(s['path'])).hexdigest()==s['sha256'] for s in r['streams']))
 check('root check process cleanup '+name,r['ownedProcessGroupAbsent'] is True and r['timedOut'] is False)
check('root replay exit outcomes preserved',[r['exitCode'] for r in receipts]==[1,1,0,0])
privacyfiles=[*text]
privacyfiles.extend(p for p in new if p.startswith(roots[2]) and p.endswith('.json'))
check('bounded personal Windows-home path screen',not any(re.search(rb'[A-Za-z]:[\\/]Users[\\/][^\s\\/"<>]+',body(p)) for p in privacyfiles))
check('no missing private helper body added',not any(p.endswith('/NativeMetadata.cs') for p in new))
result={'verdict':'ACCEPT_DOCUMENT_INTEGRATION' if all(c['passed'] for c in checks) else 'HOLD','rootFreeze':freeze,'rootTree':git('rev-parse',freeze+'^{tree}').decode().strip(),'base':base,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':[c['name'] for c in checks if not c['passed']],'originalFiles':len(before),'unchangedOriginalFiles':len(before)-len(changed),'changedOriginalFiles':changed,'newFiles':len(new),'documentHashes':[{'path':p,'bytes':len(body(p)),'sha256':hashlib.sha256(body(p)).hexdigest()} for p in text],'privateInputAccessed':False,'nativeOrTargetProcessExecuted':False,'networkRetrievalPerformed':False,'limits':'Independent integration review of accepted public facts and exact Git objects. No independent remeasurement of private inputs, authentication or native predicates.'}
print(json.dumps(result,indent=2))
sys.exit(0 if not result['failed'] else 1)
