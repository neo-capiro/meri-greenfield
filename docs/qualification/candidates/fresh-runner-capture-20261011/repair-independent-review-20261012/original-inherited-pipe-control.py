import faulthandler, os, subprocess, sys
from unittest.mock import patch
sys.path.insert(0, 'scripts/qualification')
import worker_runner_capture as capture
original=subprocess.Popen
script="import subprocess,sys; subprocess.Popen([sys.executable,'-I','-B','-S','-c','import time; time.sleep(30)'], stdin=subprocess.DEVNULL); print('aws-cli/2.37.12 synthetic inherited-pipe',flush=True)"
def launch(argv,**kwargs):
 assert argv==[capture.AWS_EXE,'--version']
 return original([sys.executable,'-I','-B','-S','-c',script],**kwargs)
faulthandler.dump_traceback_later(8,repeat=False)
try:
 with patch.object(capture.os,'environ',{'SYSTEMROOT':r'C:\Windows'}),patch.object(capture.subprocess,'Popen',launch):
  capture.native_version([capture.AWS_EXE,'--version'],seconds=1,cap=65536)
finally: faulthandler.cancel_dump_traceback_later()
