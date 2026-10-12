import json, os, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, 'scripts/qualification')
import worker_runner_inventory as inventory

class IndependentOutputControls(unittest.TestCase):
 def test_foreign_member_must_refuse_success(self):
  with tempfile.TemporaryDirectory() as directory:
   output=Path(directory)/'capture'; original=os.fsync; injected=False
   def insert(fd):
    nonlocal injected
    if not injected:
     injected=True; (output/'foreign.txt').write_bytes(b'foreign synthetic member')
    original(fd)
   with patch.object(os,'fsync',insert):
    with self.assertRaises(ValueError): inventory.write_result(output,{'first.json':b'{}','second.json':b'{}'})
 def test_prior_artifact_mutation_must_refuse_success(self):
  with tempfile.TemporaryDirectory() as directory:
   output=Path(directory)/'capture'; original=os.fsync; writes=0
   def mutate(fd):
    nonlocal writes
    writes+=1; original(fd)
    if writes==2: (output/'first.json').write_bytes(b'{]')
   with patch.object(os,'fsync',mutate):
    with self.assertRaises(ValueError): inventory.write_result(output,{'first.json':b'{}','second.json':b'{}'})

if __name__=='__main__': unittest.main(verbosity=2)
