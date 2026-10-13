from pathlib import Path
import hashlib,json,subprocess,os
REF='b2fb1f9e882a631be0ad9e0f5ffda35336da3422';SOURCE='d16896b348daa765f3cb069732c9a70e5ffe13b0';PREFIX='docs/qualification/candidates/action-session-20261013/pilot-baseline-author/'
checks=[]
def check(n,v):checks.append({'name':n,'passed':bool(v)})
def raw(p,ref=REF):return subprocess.check_output(['git','show',ref+':'+p])
def data(p):return json.loads(raw(p))
m=data(PREFIX+'manifest.json');check('manifest-source',m['source']==SOURCE)
check('manifest22',len(m['members'])==22)
for member in m['members']:
 b=raw(member['path']);check('member:'+member['path'],len(b)==member['bytes'] and hashlib.sha256(b).hexdigest()==member['sha256'])
for name in ['run.mjs','cli.mjs','baseline.test.mjs']:
 p='evals/action-followthrough/local-baseline/'+name;check('reviewed-source-exact:'+name,raw(p)==raw(p,SOURCE))
for label in ['initial','focused','cleanup-repair','final-baseline']:
 r=data(PREFIX+label+'.json');check('capture-clean:'+label,r['exitCode']==0 and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 for stream in r['streams']:
  b=raw(stream['path']);check('stream:'+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
 absent=False
 try:os.killpg(r['ownedPidAndPgid'],0)
 except ProcessLookupError:absent=True
 check('group-still-absent:'+label,absent)
final=data(PREFIX+'final-baseline.stdout.bin');check('actual6of6',final['status']=='PASS' and final['passed']==final['caseCount']==6 and [x['id'] for x in final['cases']]==['P01','P02','P03','P04','P05','P06'])
check('no-human-model-provider-native',final['qualifiedRealRequests']==final['modelCalls']==final['providerCalls']==0 and final['nativeDatabase'] is False)
gold=raw('docs/qualification/candidates/local-application-20261013/pilot/cases.json');check('gold-receipt-bound',final['casesSha256']==hashlib.sha256(gold).hexdigest())
for row in final['cases']:
 check('clean-zero-effects:'+row['id'],row['status']=='PASS' and all(c['passed'] for c in row['checks']) and row['effects']['taskEffects']==row['effects']['approvals']==0 and row['cleanup']['closed'] and row['cleanup']['postCloseStatus']==401 and row['cleanup']['noAdditionalEffects'])
check('p05-exact-refusal',final['cases'][4]['observed']['error']=={'code':'COMMAND_APPROVAL_REFUSED','outcome':'NOT_DISPATCHED'})
check('p06-exact-revocation',final['cases'][5]['observed']['error']=={'code':'UNAUTHENTICATED','outcome':'NOT_DISPATCHED'} and final['cases'][5]['effects']['sourceReads']==0)
audit=data(PREFIX+'audit.json');check('author-audit37',audit['passed']==audit['total']==37 and all(c['passed'] for c in audit['checks']) and audit['originalEntriesPreserved']==10967)
text=raw('docs/coordination/reports/CODEX-ACTION-PILOT-BASELINE-20261013.md').decode();check('failure-history-truthful','13/15 plus1/2' in text and 'synthetic binding-template IDs' in text)
check('same-capture-source',all(raw('evals/action-followthrough/local-baseline/'+n,m['finalBaselineCaptureHead'])==raw('evals/action-followthrough/local-baseline/'+n,SOURCE) for n in ['run.mjs','cli.mjs','baseline.test.mjs']))
result={'candidate':REF,'acceptedSource':SOURCE,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'targetExecution':False};print(json.dumps(result,indent=2));raise SystemExit(bool(result['failed']))
