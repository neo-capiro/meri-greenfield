"""Independent immutable source, packet and owned-process metadata audit only."""
import hashlib,json,os,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[5]; E=Path(__file__).resolve().parent
BASE='5a8d11399d8a4b65a5b04d73f9f22e5de54a157f'; SOURCE='d0433f7c7e52e6dbc606a9937f92705a42ac863a'; PACKET='52e60d45c262444e8347d8f99fc1d7f7b4517fa8'; PURE='1625c95d89593f07ec072ad71f9756a41e0c0db1'; REGISTRY='83d0f5951a5e0c5d86d3a8684c2396b6cf13f794'
registry_root=Path(os.environ.get('MERI_COMMAND_REGISTRY_ROOT','/workspace/meri-command-registry-frozen-review-20261012'))
def git(*args): return subprocess.check_output(['git',*args],cwd=R)
def blob(ref,path):return git('show',f'{ref}:{path}')
def digest(b):return hashlib.sha256(b).hexdigest()
def tree(ref):
 out={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
checks=0;failed=[]
def check(condition,label):
 global checks
 checks+=1
 if not condition:failed.append(label)
def absent(pgid):
 try:os.killpg(pgid,0);return False
 except ProcessLookupError:return True
base,source,packet=tree(BASE),tree(SOURCE),tree(PACKET)
for path,value in base.items():check(source.get(path)==value and packet.get(path)==value,'preserve:'+path)
check(len(base)==8735,'base count')
app='apps/control/commands/tool-interface.mjs'; author_test='apps/control/test/commands-tool-interface.test.mjs'
pure=['packages/contracts/commands-0.2/tool-interface-validation.mjs','packages/contracts/commands-0.2/tool-interface.schema.json']
added={p for p in packet if p not in base and p.startswith(('apps/','packages/'))}
check(added=={app,author_test,*pure},'author source addition allowlist')
identities=[]
for ref,path in [(SOURCE,app),(SOURCE,author_test),*[(PURE,p) for p in pure]]:
 b=blob(ref,path);check((R/path).read_bytes()==b,'tested local source:'+path)
 check(blob(PACKET,path)==b,'author final source:'+path)
 identities.append({'ref':ref,'path':path,'bytes':len(b),'sha256':digest(b)})
for earlier,sub in [('ef0bab0be59991d9460f3abd96cbc4b13881031b','output-prefreeze-source'),('83d2e2afeff4b121cc64880cf5374cfc420ac3fd','late-release-prefreeze-source')]:
 check((E/sub/'tool-interface.mjs').read_bytes()==blob(earlier,app),'retained exact failing source:'+earlier)
manifest_path='docs/qualification/candidates/vertical-source-20261012/command-tool-interface/manifest.json'
manifest=json.loads(blob(PACKET,manifest_path));check(len(manifest['members'])==26,'author member count')
for item in manifest['members']:
 b=blob(PACKET,item['path']);check(len(b)==item['bytes'] and digest(b)==item['sha256'],'author packet:'+item['path'])
check(subprocess.check_output(['git','rev-parse','HEAD'],cwd=registry_root).decode().strip()==REGISTRY,'immutable registry checkout head')
check(subprocess.check_output(['git','diff','HEAD','--','apps','packages'],cwd=registry_root)==b'','immutable registry complete materialized source diff')
registry_paths=[*pure,'packages/contracts/commands-0.2/validate.mjs',*['packages/contracts/retrieval-0.2/'+p for p in ['validate.mjs','catalog-validation.mjs','catalog.json','execution-schema-sources.mjs','execution-tool-validators.mjs']]]
for path in registry_paths:
 b=blob(REGISTRY,path);check((registry_root/path).read_bytes()==b,'tested canonical source:'+path)
 identities.append({'ref':REGISTRY,'path':path,'bytes':len(b),'sha256':digest(b)})
# Prior pure contracts and every public0.1/root lock file stay exact; unrelated
# root artifact/portfolio additions are outside this four-command slice verdict.
for path in pure:check(blob(REGISTRY,path)==blob(PURE,path),'root pure dependency:'+path)
public=[p for p in base if p.startswith('packages/contracts/') and '/commands-0.2/' not in p and '/retrieval-0.2/' not in p and '/artifacts-0.2/' not in p and '/test/' not in p and '/scripts/' not in p and p.count('/')==2]
for path in public:check(tree(REGISTRY).get(path)==base[path],'public contract:'+path)
for path in ['package.json','package-lock.json','packages/contracts/package.json','packages/contracts/package-lock.json']:
 check(tree(REGISTRY).get(path)==base.get(path),'manifest/lock:'+path)
loader=blob(REGISTRY,'packages/contracts/commands-0.2/validate.mjs').decode()
check('createTaskUpdateValidators' in loader and 'taskUpdateValidators' in loader,'real private task update owner')
for path in [*pure,'packages/contracts/commands-0.2/validate.mjs','packages/contracts/retrieval-0.2/execution-tool-validators.mjs']:
 check('/apps/' not in blob(REGISTRY,path).decode(),'contracts have no app dependency:'+path)
catalog=json.loads(blob(REGISTRY,'packages/contracts/retrieval-0.2/catalog.json'))
operations=catalog['operations']
for native in ['create_task','update_task','save_memory','save_chat_attachments']:
 rows=[v for v in operations if v['operation']['id']==native]
 check(len(rows)==1,'single canonical descriptor:'+native)
 if rows:
  v=rows[0];check(v['handler'] is None and v['availability']=='unimplemented' and v['qualification']=='pending' and v['retry']['maxRetries']==0,'disabled descriptor:'+native)
receipts=[]
for folder,ref in [(E,None),(R/'docs/qualification/candidates/vertical-source-20261012/command-tool-interface',PACKET)]:
 for path in sorted(folder.glob('*.json')):
  try:data=json.loads(path.read_text())
  except ValueError:continue
  if 'ownedPidAndPgid' not in data:continue
  pgid=data['ownedPidAndPgid'];check(data['ownedProcessGroupAbsent'] and not data['timedOut'] and not data['ownedGroupKillRequired'],'capture cleanup:'+path.name)
  check(absent(pgid),'fresh absence:'+str(pgid))
  for stream in data['streams']:
   b=blob(ref,stream['path']) if ref else (R/stream['path']).read_bytes()
   check(len(b)==stream['bytes'] and digest(b)==stream['sha256'],'raw stream:'+stream['path'])
  receipts.append({'path':path.relative_to(R).as_posix(),'exitCode':data['exitCode'],'pgid':pgid,'freshAbsent':absent(pgid)})
result={'verdict':'PASS' if not failed else 'FAIL','checks':checks,'failed':failed,'base':BASE,'source':SOURCE,'authorPacket':PACKET,'pureSource':PURE,'registrySource':REGISTRY,'preservedOriginalEntries':len(base),'authorManifestMembers':len(manifest['members']),'authorManifestSha256':digest(blob(PACKET,manifest_path)),'sourceIdentities':identities,'receipts':receipts,'scope':'IMMUTABLE_SOURCE_PACKET_AND_OWNED_GROUP_METADATA_ONLY; no native/durability/current-authority claim'}
(E/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise SystemExit(bool(failed))
