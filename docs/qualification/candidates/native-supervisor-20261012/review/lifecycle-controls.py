"""Only exact isolated lifecycle definitions; all process/stream/clock ports inert."""
from pathlib import Path
import ast,hashlib,json,sys
source=Path(sys.argv[1]).read_bytes();output=Path(sys.argv[2])
tree=ast.parse(source)
allowed={'Refusal','Budget','capture'}
nodes=[node for node in tree.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in allowed]
assert {node.name for node in nodes}==allowed
for node in ast.walk(ast.Module(body=nodes,type_ignores=[])):
 assert not isinstance(node,(ast.Import,ast.ImportFrom))
 if isinstance(node,ast.Name):assert node.id not in {'__import__','eval','exec','open','compile','subprocess','threading','socket','ctypes'}
env={'__builtins__':__builtins__}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'<isolated-reviewed-lifecycle>','exec'),env)
Budget,capture=env['Budget'],env['capture'];facts=[]
def check(name,condition,detail=None):facts.append({'case':name,'passed':bool(condition),'detail':detail})
class Clock:
 def __init__(self):self.now=0.0
 def __call__(self):return self.now
 def sleep(self,value):self.now+=value
class Stream:
 def __init__(self,values,clock):self.values=list(values);self.clock=clock;self.closed=0;self.mode=None
 def read(self,n):
  value=self.values.pop(0) if self.values else b''
  if isinstance(value,Exception):raise value
  if isinstance(value,tuple):self.clock.now+=value[0];return value[1]
  return value
 def close(self):
  self.closed+=1
  if self.mode=='close-error':raise OSError('inert-close-error')
  if self.mode=='late-close':self.clock.now+=16
class Thread:
 def __init__(self,target,mode,clock):self.target=target;self.mode=mode;self.clock=clock;self.alive=False
 def start(self):
  if self.mode=='start-error':raise RuntimeError('inert-start-error')
  if self.mode=='parked':self.alive=True;return
  if self.mode=='empty-return':return
  self.target()
 def join(self,timeout):
  assert 0 < timeout <= 15
  if self.mode=='parked':self.clock.now+=timeout
  if self.mode=='late-join':self.clock.now+=16
 def is_alive(self):
  if self.mode=='alive-error':raise OSError('inert-reader-status-error')
  return self.alive
class Child:
 def __init__(self,clock,stdout,stderr,mode):self.clock=clock;self.stdout=Stream(stdout,clock);self.stderr=Stream(stderr,clock);self.mode=mode;self.stdout.mode=mode;self.stderr.mode=mode;self.polls=0;self.kills=0;self.waits=[]
 def poll(self):
  self.polls+=1
  if self.mode=='late-poll' and self.polls==1:self.clock.now=11
  if self.mode=='late-total-poll' and self.polls==1:self.clock.now=16
  if self.mode=='boolean-exit':return False
  return None if self.mode in {'running','kill-error','wait-error','late-wait'} else 0
 def kill(self):
  self.kills+=1
  if self.mode=='kill-error':raise OSError('inert-kill-error')
 def wait(self,timeout):
  assert 0 < timeout <= 13;self.waits.append(timeout)
  if self.mode=='wait-error':raise TimeoutError('inert-noexit')
  if self.mode=='late-wait':self.clock.now+=16
  self.mode='done';return 0

def run(label,stdout=(b'ok',b''),stderr=(b'',),child_mode='done',thread_mode='normal',spawn_delay=0,initial=0):
 clock=Clock();budget=Budget(clock);clock.now=initial;child=Child(clock,stdout,stderr,child_mode);spawns=[];threads=[]
 def spawn(argv,cwd):spawns.append((argv,cwd));clock.now+=spawn_delay;return child
 def make_thread(target):
  mode=thread_mode if not isinstance(thread_mode,list) else thread_mode[len(threads)]
  t=Thread(target,mode,clock);threads.append(t);return t
 result=capture(['bound-selected-executable','fixed-diagnostic'],'bound-private-cwd',budget,spawn=spawn,make_thread=make_thread,sleep=clock.sleep)
 check(label+'-one-or-zero-attempt',len(spawns)<=1)
 check(label+'-no-runtime-promotion',result['hardTotalProven'] is False and result['descendantTeardownQualified'] is False and result['runtimeAccepted'] is False)
 return result,child,spawns,clock
r,c,s,k=run('success');check('success-both-eof-and-direct-exit',r['observationEligible'] and r['readersSettled'] and r['directChildPhysicalExitObserved'] and all(x['eof'] for x in r['streams'].values()))
r,_,_,_=run('exact-caps',stdout=(b'x'*32768,b''),stderr=(b'x'*65536,b''));check('exact-cap-complete-eof-pass',r['observationEligible'])
for name,cap in [('stdout',32768),('stderr',65536)]:
 args={name:(b'x'*(cap+1),b'')};r,_,_,_=run(name+'-overflow',**args);check(name+'-overflow-denies',not r['observationEligible'] and r['streams'][name]['overflow'] and len(r['streams'][name]['data'])==cap)
for value,label in [(OSError('inert-read'),'read-error'),(None,'none-read'),('text','text-read')]:
 r,_,_,_=run(label,stdout=(value,));check(label+'-never-eof',not r['observationEligible'] and not r['streams']['stdout']['eof'] and r['streams']['stdout']['error'] is not None)
r,_,_,_=run('empty-thread',thread_mode='empty-return');check('thread-return-not-eof',not r['observationEligible'] and not r['readersSettled'] and r['streams'] is None)
r,c,_,_=run('parked-reader',thread_mode=['normal','parked']);check('unsettled-reader-withholds-buffer',not r['observationEligible'] and r['streams'] is None and not r['readersSettled'] and c.stderr.closed==0)
r,c,s,_=run('expired-before-spawn',initial=10);check('expired-no-acquisition',not s and not r['observationEligible'])
for delay in (11,16):
 r,c,_,_=run('late-spawn'+str(delay),spawn_delay=delay,child_mode='running');check('late-spawn'+str(delay)+'-denies-and-retains-owned-cleanup',not r['observationEligible'] and c.kills==1)
r,c,_,_=run('missing-exit',child_mode='wait-error');check('missing-exit-remains-unknown',not r['observationEligible'] and not r['directChildPhysicalExitObserved'] and c.kills==1)
r,c,_,_=run('kill-error',child_mode='kill-error');check('kill-error-no-success',not r['observationEligible'] and c.kills==1 and any(x.startswith('kill:') for x in r['errors']))
r,_,_,_=run('late-wait',child_mode='late-wait');check('late-wait-no-success',not r['observationEligible'] and r['elapsedSeconds']>=15)
r,_,_,_=run('late-join',thread_mode='late-join');check('late-join-no-success',not r['observationEligible'] and r['elapsedSeconds']>=15)
r,_,_,_=run('partial-thread-start',thread_mode=['normal','start-error']);check('partial-thread-start-no-success',not r['observationEligible'] and r['streams'] is None)
r,_,_,_=run('late-total-poll',child_mode='late-total-poll');check('late-total-poll-no-success',not r['observationEligible'])
r,_,_,_=run('late-action-poll',child_mode='late-poll');check('late-action-poll-no-success',not r['observationEligible'],{'observedEligible':r['observationEligible'],'timedOut':r['timedOut'],'elapsedSeconds':r['elapsedSeconds']})
r,_,_,_=run('last-reader-crosses-action',stderr=((11,b'ok'),b''));check('last-reader-crosses-action-no-success',not r['observationEligible'],{'observedEligible':r['observationEligible'],'timedOut':r['timedOut'],'elapsedSeconds':r['elapsedSeconds']})
try:
 r,_,_,_=run('reader-status-error',thread_mode='alive-error');check('reader-status-error-structured-hold',not r['observationEligible'] and r['streams'] is None)
except Exception as error:
 check('reader-status-error-structured-hold',False,{'escapedClass':type(error).__name__})
for label in ('close-error','late-close','boolean-exit'):
 r,_,_,_=run(label,child_mode=label);check(label+'-no-success',not r['observationEligible'])
r,_,_,_=run('late-read-observation',stderr=((16,b'abc'),b''));check('late-read-counted-without-success',not r['observationEligible'] and r['streams'] is not None and r['streams']['stderr']['observedBytes']==3,{'streams':None if r['streams'] is None else {name:{key:value for key,value in row.items() if key!='data'} for name,row in r['streams'].items()}})
result={'sourceSha256':hashlib.sha256(source).hexdigest(),'isolatedDefinitions':['Refusal','Budget','capture'],'candidateEntryImported':False,'nativePortsExecuted':False,'facts':facts,'passed':sum(x['passed'] for x in facts),'failed':sum(not x['passed'] for x in facts)}
output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise SystemExit(0 if result['failed']==0 else 1)
