import json, os, signal, subprocess, sys, tempfile, time, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,'scripts/qualification')
import worker_runner_capture as capture
import worker_runner_inventory as inventory
original=subprocess.Popen
observations=[]
class RepairControls(unittest.TestCase):
 def test_final_readback_mutation(self):
  with tempfile.TemporaryDirectory() as directory:
   output=Path(directory)/'capture'
   class Mutating(inventory.Filesystem):
    visits=0
    def open_read(self,path):
     if Path(path).name=='second.json':
      self.visits+=1
      if self.visits==2:(output/'first.json').write_bytes(b'{]')
     return super().open_read(path)
   with self.assertRaises(ValueError):inventory.write_result(output,{'first.json':b'{}','second.json':b'{}'},fs=Mutating())
   self.assertFalse(output.exists())
 def test_individual_inherited_pipe_boundaries(self):
  for inherited in ['stdout','stderr','both']:
   children=[];redirect={'stdout':'stderr=subprocess.DEVNULL','stderr':'stdout=subprocess.DEVNULL','both':''}[inherited]
   script="import subprocess,sys; subprocess.Popen([sys.executable,'-I','-B','-S','-c','import time; time.sleep(30)'],stdin=subprocess.DEVNULL"+(','+redirect if redirect else '')+"); print('aws-cli/2.37.12 fixture',flush=True)"
   def launch(argv,**kwargs):
    self.assertEqual(argv,[capture.AWS_EXE,'--version']);self.assertEqual(kwargs['bufsize'],0);self.assertFalse(kwargs['shell'])
    self.assertEqual(kwargs['env'],{'SYSTEMROOT':r'C:\Windows','AWS_EC2_METADATA_DISABLED':'true','AWS_MAX_ATTEMPTS':'1','AWS_PAGER':''})
    child=original([sys.executable,'-I','-B','-S','-c',script],start_new_session=True,**kwargs);children.append(child);return child
   start=time.monotonic()
   try:
    with self.subTest(inherited=inherited),patch.object(capture.os,'environ',{'SYSTEMROOT':r'C:\Windows','AWS_SECRET_ACCESS_KEY':'synthetic','HTTPS_PROXY':'synthetic'}),patch.object(capture.subprocess,'Popen',launch):
     with self.assertRaisesRegex(capture.VersionPipeBoundaryError,'DESCENDANT_TEARDOWN_UNQUALIFIED'):capture.native_version([capture.AWS_EXE,'--version'],seconds=.25,cap=65536)
    elapsed=time.monotonic()-start;self.assertLess(elapsed,1.5)
    self.assertEqual(len(children),1);self.assertIsNotNone(children[0].poll());self.assertTrue(children[0].stdout.closed);self.assertTrue(children[0].stderr.closed)
    observations.append({'inherited':inherited,'refusedMissingEOF':True,'elapsedSeconds':round(elapsed,3),'directChildReaped':True,'parentStdoutClosed':True,'parentStderrClosed':True,'fixtureOwnsDescendantCleanup':True,'productionTreeCleanupProved':False})
   finally:
    for child in children:
     try:os.killpg(child.pid,signal.SIGKILL)
     except ProcessLookupError:pass
     child.wait(timeout=3)
if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(RepairControls);result=unittest.TextTestRunner(verbosity=2).run(suite);print(json.dumps(observations));raise SystemExit(not result.wasSuccessful())
