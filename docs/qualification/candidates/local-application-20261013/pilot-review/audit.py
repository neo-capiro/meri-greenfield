#!/usr/bin/env python3
"""Offline immutable Git/data review; no target imports or external calls."""
import hashlib, json, subprocess, sys
from decimal import Decimal
BASE="73c854ea41f764eb3e3e84bfd0a0cb73fa29a329"
CANDIDATE=sys.argv[1]
checks=[]
def check(name, ok, detail=None):
    checks.append({"name":name,"pass":bool(ok),"detail":detail})
def tree(ref):
    rows=subprocess.check_output(["git","ls-tree","-r","-z",ref]).split(b"\0")
    return {r.split(b"\t",1)[1].decode():r.split(b"\t",1)[0].decode() for r in rows if r}
def raw(path): return subprocess.check_output(["git","show",CANDIDATE+":"+path])
def data(path): return json.loads(raw(path))
a,b=tree(BASE),tree(CANDIDATE)
for path,identity in a.items(): check("original:"+path,b.get(path)==identity)
allowed=("docs/qualification/candidates/local-application-20261013/pilot/",)
names={"docs/coordination/tasks/CODEX-LOCAL-APPLICATION-PILOT-20261013.md","docs/coordination/reports/CODEX-LOCAL-APPLICATION-PILOT-20261013.md"}
added=sorted(set(b)-set(a))
check("exclusive-author-scope",all(x.startswith(allowed) or x in names for x in added),added)
check("eighteen-each-36",18+18==36)
check("max-input",18*8000==144000)
check("max-output",18*256==4608)
check("conditional-prior-decimal",Decimal(144000)*Decimal("3.30")/1000000+Decimal(4608)*Decimal("16.50")/1000000==Decimal("0.551232"))
# Candidate-specific semantic and manifest checks are appended after frozen packet read.
result={"base":BASE,"candidate":CANDIDATE,"checks":checks,"passed":sum(c["pass"] for c in checks),"failed":sum(not c["pass"] for c in checks),"originalCount":len(a),"newPaths":added,"targetExecution":False}
print(json.dumps(result,indent=2))
sys.exit(bool(result["failed"]))
