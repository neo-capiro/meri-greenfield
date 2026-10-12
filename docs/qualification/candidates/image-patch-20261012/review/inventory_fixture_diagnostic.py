"""Explain preserved original fixture failure without editing its assertions/source."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile

ROOT=Path(__file__).resolve().parents[5]
spec=importlib.util.spec_from_file_location('inventory',ROOT/'apps/worker/qualification/probes/image-inventory.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
observations=[]
for precreate in [False,True]:
 with tempfile.TemporaryDirectory(prefix='meri-inventory-diagnostic-') as temporary:
  root=Path(temporary);target=root/'usr/bin/tiffcrop';target.parent.mkdir(parents=True);target.write_bytes(b'independent synthetic TIFF control')
  out=root/'inventory-result.json'
  if precreate:out.write_text('{}')
  args=m.parse_args(['--root',str(root),'--out',str(out)])
  scans=[]
  for index in range(2):
   value,code=m._inventory(args,platform='linux',required_roots=[str(root)],pins={},aliases={},output_path=str(out))
   assert code==0 and value['coverage']['complete'] and value['errors']==[]
   with contextlib.redirect_stdout(io.StringIO()):m.emit(value,str(out))
   assert next(row for row in value['candidates'] if row['kind']=='tiffcrop')['sha256']==hashlib.sha256(target.read_bytes()).hexdigest()
   scans.append(value)
  before,after=[next(row for row in s['entries'] if row['path']==str(root))['size'] for s in scans]
  equal=scans[0]['entries']==scans[1]['entries']
  if precreate:assert equal
  else:
   assert not equal and before!=after
   left=[dict(row) for row in scans[0]['entries']];right=[dict(row) for row in scans[1]['entries']]
   for rows in [left,right]:next(row for row in rows if row['path']==str(root)).pop('size')
   assert left==right
  observations.append({'outputPrecreated':precreate,'entriesEqual':equal,'rootDirectoryBytesBefore':before,'rootDirectoryBytesAfter':after,'bothComplete':True,'candidateHashesMatch':True})
print(json.dumps({'classification':'ORIGINAL_FIXTURE_SELF_MUTATION_DIAGNOSIS','originalSourceChanged':False,'originalTestChanged':False,'runtimeAdmission':False,'observations':observations}))
