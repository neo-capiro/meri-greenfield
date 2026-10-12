"""Exact source preservation; all commands are read-only Git and file operations."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
parser=argparse.ArgumentParser()
parser.add_argument('root',type=Path)
parser.add_argument('commit')
args=parser.parse_args()
root=args.root.resolve()
base='263d0d174f9924a6030bb1c20100ff1115ffcda0'
def git(*argv):return subprocess.check_output(['git','-C',str(root),*argv])
assert git('rev-parse','HEAD').decode().strip()==args.commit
assert git('status','--porcelain')==b''
original=git('ls-tree','-r','--name-only',base).decode().splitlines()
changed=git('diff','--name-only',base,args.commit).decode().splitlines()
allocated=['apps/gateway/budget/README.md','apps/gateway/budget/durable-tool-dispatch.mjs','apps/gateway/budget/postgres-tool-budget.mjs']
assert sorted(p for p in changed if p in original)==sorted(allocated)
new=['apps/gateway/budget/tool-budget-outcome.mjs','apps/gateway/test/tool-budget-outcome.test.mjs']
assert all(p in allocated+new or p.startswith(('docs/qualification/candidates/g1-budget-outcome-20261012/author/',
 'docs/coordination/tasks/MERI-G1-BUDGET-OUTCOME-','docs/coordination/reports/MERI-G1-BUDGET-OUTCOME-')) for p in changed)
files={}
for name in allocated+new:
 b=(root/name).read_bytes();assert b==git('show',f'{args.commit}:{name}')
 files[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
assert git('diff','--check',base,args.commit)==b''
print(json.dumps({'verdict':'PASS_SOURCE_PRESERVATION','base':base,'commit':args.commit,
 'tree':git('rev-parse',f'{args.commit}^{{tree}}').decode().strip(),'originalTrackedFiles':len(original),
 'unchangedOriginalFiles':len(original)-len(allocated),'changedOriginalFiles':allocated,'files':files,
 'nativeOrDatabaseExecution':False},indent=2))
