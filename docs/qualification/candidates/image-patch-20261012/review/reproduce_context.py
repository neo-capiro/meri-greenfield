"""Exact source context assembly only; no build, image or cloud operation."""
import hashlib,json,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(ROOT/'scripts/qualification'))
import worker_context as context
import worker_image_collect as collect
out=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='meri-image-review-context-') as temporary:
 paths=[Path(temporary)/name for name in ['first','second']]
 manifests=[context.assemble_context(path) for path in paths]
 for path in paths:context.verify_context(path)
 raw=[(path/'manifest.json').read_bytes() for path in paths]
 assert raw[0]==raw[1] and manifests[0]==manifests[1]
 (out/'context-manifest.json').write_bytes(raw[0])
 result={'classification':'UNCHANGED_BASELINE_SOURCE_REPRODUCED_NOT_A_PATCHED_IMAGE',
  'members':len(manifests[0]['members']),'bytes':manifests[0]['totalBytes'],'bothManifestsByteIdentical':True,
  'contextManifestSha256':hashlib.sha256(raw[0]).hexdigest(),'collectorContextSha256':collect.CONTEXT_SHA,
  'assemblerSha256':hashlib.sha256((ROOT/'scripts/qualification/worker_context.py').read_bytes()).hexdigest(),
  'collectorAssemblerSha256':collect.ASSEMBLER_SHA,'commitAuthority':False,'buildAdmitted':False,'runtimeAdmitted':False}
 result['contextPinMatches']=result['contextManifestSha256']==result['collectorContextSha256']
 result['assemblerPinMatches']=result['assemblerSha256']==result['collectorAssemblerSha256']
 (out/'context-reproduction.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result))
