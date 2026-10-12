import json,subprocess,sys,time
from unittest.mock import patch
sys.path.insert(0,'scripts/qualification')
import worker_runner_capture as capture
original=subprocess.Popen
children=[]
def launch(argv,**kwargs):
 assert argv==[capture.AWS_EXE,'--version'] and kwargs['bufsize']==0 and not kwargs['shell']
 assert kwargs['env']=={'SYSTEMROOT':r'C:\Windows','AWS_EC2_METADATA_DISABLED':'true','AWS_MAX_ATTEMPTS':'1','AWS_PAGER':''}
 child=original([sys.executable,'-I','-B','-S','-c','import time;time.sleep(30)'],**kwargs);children.append(child);return child
calls=0
def clock():
 global calls
 calls+=1
 if calls>1:raise RuntimeError('post-allocation synthetic clock failure')
 return time.monotonic()
start=time.monotonic()
try:
 with patch.object(capture.os,'environ',{'SYSTEMROOT':r'C:\Windows','AWS_SECRET_ACCESS_KEY':'synthetic','HTTPS_PROXY':'synthetic'}),patch.object(capture.subprocess,'Popen',launch):
  try:capture.native_version([capture.AWS_EXE,'--version'],seconds=1,cap=65536,clock=clock)
  except RuntimeError as error:assert 'post-allocation' in str(error)
  else:raise AssertionError('expected clock failure')
 assert len(children)==1
 assert children[0].poll() is not None and children[0].stdout.closed and children[0].stderr.closed
 assert time.monotonic()-start<1.5
 print(json.dumps({'clockCalls':calls,'childCount':1,'directChildReaped':True,'parentStdoutClosed':True,'parentStderrClosed':True,'minimalEnvironment':True,'elapsedSeconds':round(time.monotonic()-start,3)}))
finally:
 for child in children:
  if child.poll() is None:child.kill()
  child.wait(timeout=3);child.stdout.close();child.stderr.close()
