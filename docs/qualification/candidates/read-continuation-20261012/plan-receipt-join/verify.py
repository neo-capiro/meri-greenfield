#!/usr/bin/env python3
import json,hashlib,subprocess,collections
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[4];n=0

def check(x,message):
 global n
 if not x:raise AssertionError(message)
 n+=1

def read(name):return json.loads((P/name).read_text())
def raw(ref,path):return subprocess.check_output(['git','-C',str(ROOT),'show',ref+':'+path])
j=read('requirements.json');old=json.loads(raw(j['base'],j['originalIndex']['path']))['requirements'];new=j['requirements'];check(len(new)==53,'exact53');check([r['id'] for r in new]==[r['id'] for r in old],'original order')
for a,b in zip(old,new):
 check((a['locator'],a['requirement'])==(b['originalLocator'],b['originalRequirement']),b['id']+' original')
 check(hashlib.sha256(json.dumps(a,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==b['originalRecordSha256'],b['id']+' originalhash')
 for k in ['completedSourceComponents','remaining','owner','nextParallelSourceOrMetadataWork','decisionOrExternalPrerequisite']:check(bool(b[k]),b['id']+' '+k)
 check(b['qualifiedRuntime'] is False,b['id']+' no runtime promotion')
 check(b['status']==('completed-source' if b['id'] in ['W00','G0'] else 'pending'),b['id']+' complete criterion status')
rs=read('receipts.json')['receipts'];by={r['id']:r for r in rs};check(len(by)==len(rs),'unique receipts')
for r in new:
 for id in r['sourceReceiptIds']+r['reportedRuntimeReceiptIds']:check(id in by,r['id']+' reference')
for r in rs:
 if 'identity' in r:
  a=r['identity'];b=raw(a['ref'],a['path']);check(len(b)==a['bytes'],'sourcebytes');check(hashlib.sha256(b).hexdigest()==a['sha256'],'sourcehash');check(hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==a['gitBlob'],'sourceblob')
 if r['id'].endswith('reported') or r['id']=='frontend-earlier-cohort':check(r['qualifiedRuntimeByThisLane'] is False,'reported only')
f=by['frontend'];check(f['source']=='ee01be3b2c5c64a53744994ae4ad0d992a111054','frontend source');check(f['publication']=='7aca86e7d64cfdb85d09d424a07e6186339fc24c','frontend publication')
for a in f['files']:
 b=(P/a['path']).read_bytes();check(len(b)==a['bytes'],'frontbytes');check(hashlib.sha256(b).hexdigest()==a['sha256'],'fronthash');check(hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==a['gitBlob'],'frontblob')
fb=read('frontend/STATUS.json');check(fb['nativeAcceptance'].startswith('UNRUN'),'frontnative');check(fb['fullRowAcceptance']=='NO_NEW_FULL_ROW_ACCEPTANCE','no337rowacceptance');check(fb['remainingOutsideGroup']==18,'18 remain');check(fb['qualifiedSource']==f['source'],'matchingfrontsource')
b=read('boundaries.json');a=b['acceptedRead'];cat=json.loads(raw(a['source'],'packages/contracts/retrieval-0.2/catalog.json'));check(len(cat['operations'])==a['typed']==71,'71');check(sum(o['state']=='mapped' for o in cat['originals'])==a['mapped']==70,'70');check(sum(o['state']=='pending' for o in cat['originals'])==a['pending']==26,'26');check(all(o['handler'] is None and o['availability']=='unimplemented' and o['qualification']=='pending' for o in cat['operations']),'unavailable');check(len(cat['originals'])==139 and sum(o['disposition']=='selected' for o in cat['originals'])==96,'13996')
check('ACCEPT_SOURCE' in raw(by['combined-review']['identity']['ref'],by['combined-review']['identity']['path']).decode(),'acceptedsourceexact');check(b['scopeTensions']==['find_path_to','confirm_memory','correct_memory','forget_memory'],'four tensions');check(b['skills']==14,'14skills');check(b['nativeReportedCohorts']==[33,9,12],'nativecohorts')
orig=b['originalBenchmarks'];check((orig['realTasksMinimum'],orig['completionRateMinimum'],orig['factualCorrectnessMinimum'],orig['adversarialIsolationCasesMinimum'])==(60,.9,.95,100),'originalcore');check((b['r2Benchmark']['realSeedRequestsMinimum'],b['r2Benchmark']['labelledCasesMinimum'])==(75,200),'r2additional');check(b['r2Benchmark']['syntheticReplacementAllowed'] is False,'noreplacement');check(b['shipping']['sourceFromFrontendReceipt']==f['shippingSource']!=f['source'],'separate shipping/newsource');check(b['shipping']['buildStartedUTC']=='2026-10-12T19:42:46Z','startnotterminal');check(b['shipping']['latestIndependentState'].startswith('not queried'),'shippingunknown')
check({r['id'] for r in new if r['optional']}=={'R-11','R-12','REL-07','REL-08','RG-10','RG-11'},'optionalnotdeleted')
rows={r['id']:r for r in new}
check(set(rows['W00']['sourceReceiptIds'])=={'g0','g0-discovery','r2-adoption','plan-index','scope'},'W00 exact discovery receipts')
check(rows['W00']['reportedRuntimeReceiptIds']==[],'W00 not reopened by native receipt')
check('CODEX-G0-DISCOVERY.md' in by['g0-discovery']['identity']['path'],'exact G0 report')
check('CODEX-R2-ADOPTION.md' in by['r2-adoption']['identity']['path'],'exact R2 report')
for id in ['REL-07','REL-08']:
 check('not established or qualified by received evidence' in rows[id]['remaining'],id+' no unseen work assertion')
check(collections.Counter(r['status'] for r in new)=={'completed-source':2,'pending':51},'full criterion status totals')
prior=read('precision-correction/finding-and-preimage.json')
check(prior['priorFreeze']=='39b6da63289241b368a5003d47e98352c7cbc817','preserved preimage')
check(json.loads((P/'precision-correction/prior-verify.stdout').read_text())['checks']==751,'prior751 retained')
print(json.dumps({'status':'PASS','checks':n,'requirements':53,'fullRuntimeCriteriaPromoted':0,'productTestsRun':False,'nativeActions':False,'baseline':j['base']}))
