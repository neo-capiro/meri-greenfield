"""Synthetic local source-input checks; subprocess/cloud/native ports never called."""
from pathlib import Path
from unittest.mock import patch,Mock
import copy,hashlib,json,sys,tempfile
root=Path(sys.argv[1]).resolve();result=Path(sys.argv[2]);candidate=sys.argv[3]
sys.path.insert(0,str(root/'scripts/qualification'))
import worker_image_build as build
import worker_image_collect as collect
import worker_context as context
import worker_image_manifest as membership
facts=[]
def sha(v):return hashlib.sha256(v).hexdigest()
def check(name,condition,detail=None):
 facts.append({'check':name,'passed':bool(condition),'detail':detail})
 if not condition:raise AssertionError(name)
def reject(name,fn,fragment=None):
 try:fn()
 except (ValueError,OSError) as error:
  check(name,fragment is None or fragment in str(error),str(error));return
 raise AssertionError('unexpected acceptance:'+name)
rows=[]
for source,target in context.MEMBERS:
 raw=(root/source).read_bytes();rows.append({'sourcePath':source,'contextPath':target,'bytes':len(raw),'sha256':sha(raw)})
manifest={'schemaVersion':1,'status':'SOURCE_ONLY','commitAuthority':False,'members':rows,'totalBytes':sum(x['bytes'] for x in rows)}
context_raw=(json.dumps(manifest,ensure_ascii=True,separators=(',',':'))+'\n').encode('ascii')
check('exact-current-context',sha(context_raw)==collect.CONTEXT_SHA=='640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229',sha(context_raw))
check('exact-unchanged-assembler',sha((root/collect.ASSEMBLER).read_bytes())==collect.ASSEMBLER_SHA=='e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765')
check('context-remains-source-only',manifest['status']=='SOURCE_ONLY' and manifest['commitAuthority'] is False and len(rows)==57)
with tempfile.TemporaryDirectory(prefix='meri-source-guard-review-') as temp:
 target=Path(temp);source_rows=[]
 for name in membership.source_paths():
  raw=build.recipe() if name=='buildspec.json' else (root/name).read_bytes();p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw);source_rows.append({'path':name,'bytes':len(raw),'sha256':sha(raw)})
 value={'schema':collect.SCHEMA,'sourceCommit':candidate,'runUuid':'b164e3ae-80bf-4f61-ad73-1bf0a0b12b50','members':source_rows,'contextManifestSha256':collect.CONTEXT_SHA}
 def validate(v):
  raw=collect.encoded(v);return collect.validate_input(target,raw,sha(raw))
 check('current-input-preflight-only',validate(value)==value)
 for name,digest in [('prior-reviewed-context','0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903'),('historical-context','18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda'),('pre-fixture-context','94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f')]:
  wrong=copy.deepcopy(value);wrong['contextManifestSha256']=digest;reject(name+'-refused',lambda:validate(wrong),'worker input schema')
 for mutation in ['missing','extra','duplicate']:
  wrong=copy.deepcopy(value)
  if mutation=='missing':wrong['members'].pop()
  elif mutation=='extra':wrong['members'].append({'path':'extra','bytes':0,'sha256':sha(b'')})
  else:wrong['members'].append(wrong['members'][0])
  reject(mutation+'-source-member-refused',lambda:validate(wrong),'canonical worker membership')
 testpath='apps/worker/qualification/probes/image-inventory.test.mjs';p=target/testpath;original=p.read_bytes();p.write_bytes(original+b'\n')
 reject('changed-current-bytes-refused',lambda:validate(value),'source drift')
 # Rehashing an altered input cannot evade the actual assembled-context guard.
 rehashed=copy.deepcopy(value)
 for row in rehashed['members']:
  if row['path']==testpath:row['bytes']=p.stat().st_size;row['sha256']=sha(p.read_bytes())
 input_raw=collect.encoded(rehashed);(target/'worker-image-input.json').write_bytes(input_raw)
 class Commands:
  def __init__(self,*args):pass
  def __call__(self,label,argv,*args):
   if label!='assemble-context':raise AssertionError('unexpected external command:'+label)
   context.assemble_context(Path(argv[-1]))
 env={'CODEBUILD_SRC_DIR':str(target),'INPUT_MANIFEST_SHA256':sha(input_raw),'SOURCE_COMMIT':candidate,'SOURCE_ARCHIVE_SHA256':'a'*64,'SOURCE_S3_VERSION':'synthetic-version','RESULT_KEY':'results/sdk-worker-image-'+value['runUuid']+'/evidence.tar.gz'}
 with patch.object(collect,'__file__',str(target/'scripts/qualification/worker_image_collect.py')),patch.object(context,'ROOT',target),patch.object(collect,'Commands',Commands),patch.object(collect,'collect') as native,patch.dict(collect.os.environ,env),patch.object(sys,'argv',['worker_image_collect.py','--collect']):
  reject('rehashed-changed-context-refused-before-build',collect.main,'accepted context manifest');check('native-build-port-not-called',not native.called)
 p.write_bytes(original)
 assembler=target/collect.ASSEMBLER;ab=assembler.read_bytes();assembler.write_bytes(ab+b'\n');wrong=copy.deepcopy(value)
 for row in wrong['members']:
  if row['path']==collect.ASSEMBLER:row['bytes']=len(ab)+1;row['sha256']=sha(ab+b'\n')
 reject('rehashed-assembler-change-refused',lambda:validate(wrong),'canonical assembler');assembler.write_bytes(ab)
 p.unlink();p.symlink_to(root/testpath)
 reject('source-symlink-refused',lambda:validate(value),'link/reparse')
 owned=temp
check('owned-fixture-cleanup',not Path(owned).exists())
result.write_text(json.dumps({'candidate':candidate,'facts':facts,'context_sha256':sha(context_raw),'sourceOnly':True,'external_commands':0,'native_build_calls':0},indent=2)+'\n');print(json.dumps({'passed':len(facts),'total':len(facts)}))
