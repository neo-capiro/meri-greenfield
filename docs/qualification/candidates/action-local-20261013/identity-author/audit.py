import hashlib,json,pathlib,subprocess,os,errno
root=pathlib.Path(__file__).resolve().parents[5]
base="d68615c9861315ac1c6ee616697f7ad0093d9192"
source="351b23190e61b459e94c910da013d1a0ea0a4518"
def git(*args):return subprocess.check_output(["git",*args],cwd=root)
def entries(ref):
 out={}
 for raw in git("ls-tree","-r","-z",ref).split(b"\0"):
  if raw:
   meta,path=raw.split(b"\t",1);out[path.decode()]=meta.decode()
 return out
before,after=entries(base),entries("HEAD")
assert all(after.get(p)==v for p,v in before.items()),"original file changed"
allowed=("apps/gateway/local-action/","docs/coordination/tasks/CODEX-ACTION-LOCAL-IDENTITY-20261013.md","docs/coordination/reports/CODEX-ACTION-LOCAL-IDENTITY-20261013.md","docs/qualification/candidates/action-local-20261013/identity-author/")
assert all(p.startswith(allowed) for p in after.keys()-before.keys()),"unallocated change"
paths=sorted(p for p in after if p.startswith("apps/gateway/local-action/"))
manifest=[]
for path in paths:
 data=(root/path).read_bytes();expected=git("show",source+":"+path)
 assert data==expected,"working source mismatch"
 manifest.append({"path":path,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"gitBlob":git("rev-parse",source+":"+path).decode().strip()})
evidence=root/"docs/qualification/candidates/action-local-20261013/identity-author"
cleanup=[]
for label in ("initial","setup-repaired","denial-repaired"):
 r=json.loads((evidence/(label+".json")).read_text());pg=r["ownedPidAndPgid"]
 try:os.killpg(pg,0)
 except ProcessLookupError:absent=True
 else:absent=False
 assert absent and r["ownedProcessGroupAbsent"] and not r["timedOut"],"owned group not absent"
 cleanup.append({"label":label,"pgid":pg,"freshGroupAbsent":absent,"exitCode":r["exitCode"]})
result={"base":base,"source":source,"originalEntriesUnchanged":len(before),"allocatedOnly":True,"source":source,"sourceFiles":manifest,"cleanup":cleanup,"realEngineExecuted":False,"networkExecuted":False,"productionCatalogChanged":False}
(evidence/"source-identities.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({"audit":"PASS","originalEntriesUnchanged":len(before),"sourceFiles":len(manifest),"captureGroupsAbsent":len(cleanup)}))
