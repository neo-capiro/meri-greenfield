import json, os, subprocess, sys, unittest
from unittest.mock import patch
sys.path.insert(0,'scripts/qualification')
import worker_runner_capture as capture
original=subprocess.Popen
children=[]
def launch(argv,**kwargs):
 assert argv==[capture.AWS_EXE,'--version']
 child=original([sys.executable,'-I','-B','-S','-c','import time; time.sleep(5)'],**kwargs);children.append(child);return child

def failed_clock(): raise RuntimeError('synthetic initialization clock failure')
try:
 with patch.object(capture.os,'environ',{'SYSTEMROOT':r'C:\Windows'}),patch.object(capture.subprocess,'Popen',launch):
  try: capture.native_version([capture.AWS_EXE,'--version'],seconds=.25,cap=65536,clock=failed_clock)
  except RuntimeError: pass
  else: raise AssertionError('expected injected clock failure')
 observed={'childrenAllocated':len(children),'directChildStillRunning':[child.poll() is None for child in children],'stdoutClosed':[child.stdout.closed for child in children],'stderrClosed':[child.stderr.closed for child in children]}
 print(json.dumps(observed),flush=True)
 assert all(child.poll() is not None and child.stdout.closed and child.stderr.closed for child in children), 'owned initialization failure cleanup is incomplete'
finally:
 for child in children:
  if child.poll() is None: child.kill()
  child.wait(timeout=3);child.stdout.close();child.stderr.close()
