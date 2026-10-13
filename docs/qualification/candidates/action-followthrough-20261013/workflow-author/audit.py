import json,subprocess,pathlib,hashlib,os
root=pathlib.Path(__file__).resolve().parents[5]
evidence=root/"docs/qualification/candidates/action-followthrough-20261013/workflow-author"
base="b23a2cd027d43740bd99f937366e9be2df1be3ad";source="0715c71025a72312917c7cc0714951be814f7ae3"
def git(*args):return subprocess.check_output(["git",*args],cwd=root)
def tree(ref):
 result={}
 for raw in git("ls-tree","-r","-z",ref).split(b"\0"):
  if raw:
   meta,path=raw.split(b"\t",1);result[path.decode()]=meta.decode()
 return result
before,after=tree(base),tree(source)
assert all(after.get(p)==v for p,v in before.items()),"original modified"
allowed=("apps/control/action-followthrough/","docs/coordination/tasks/CODEX-ACTION-FOLLOWTHROUGH-WORKFLOW-20261013.md","docs/coordination/reports/CODEX-ACTION-FOLLOWTHROUGH-WORKFLOW-20261013.md","docs/qualification/candidates/action-followthrough-20261013/workflow-author/")
assert all(p.startswith(allowed) for p in after.keys()-before.keys()),"unallocated addition"
files=[]
for p in sorted(p for p in after if p.startswith("apps/control/action-followthrough/")):
 raw=(root/p).read_bytes();assert raw==git("show",source+":"+p)
 files.append({"path":p,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"gitBlob":git("rev-parse",source+":"+p).decode().strip()})
groups=[]
for label in ["initial","fixture-repaired","configuration-negative","configuration-repaired"]:
 r=json.loads((evidence/(label+".json")).read_text());pg=r["ownedPidAndPgid"]
 try:os.killpg(pg,0)
 except ProcessLookupError:absent=True
 else:absent=False
 assert absent and r["ownedProcessGroupAbsent"] and not r["timedOut"]
 groups.append({"label":label,"pgid":pg,"freshAbsent":True,"exitCode":r["exitCode"]})
result={"base":base,"source":source,"originalEntriesUnchanged":len(before),"allocatedOnly":True,"files":files,"groups":groups,"sourceOnly":True,"realEngineExecuted":False}
(evidence/"source-identities.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({"audit":"PASS","originalEntriesUnchanged":len(before),"sourceFiles":len(files),"groupsAbsent":len(groups)}))
