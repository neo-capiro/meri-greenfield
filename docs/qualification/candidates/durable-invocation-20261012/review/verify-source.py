"""Read-only exact Git/source preservation audit. No SQL/runtime imports."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root=Path(sys.argv[1]).resolve()
expected=sys.argv[2]
base='6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e'
def git(*args):
    return subprocess.check_output(['git','-C',str(root),*args])
assert git('rev-parse','HEAD').decode().strip()==expected
assert git('status','--porcelain','--untracked-files=no')==b''
originals={line.split('\t',1)[1]:line.split()[2] for line in git('ls-tree','-r',base).decode().splitlines()}
allowed={
'apps/gateway/budget/postgres-tool-budget.mjs',
'apps/gateway/budget/postgres-budget-store.mjs',
'apps/gateway/budget/durable-tool-dispatch.mjs',
'apps/gateway/budget/README.md',
'apps/gateway/dispatch/tool-dispatch.mjs',
'apps/proxy/qualification/state/postgres_store.py',
}
changed=[line for line in git('diff','--name-only',base,expected).decode().splitlines() if line in originals]
assert set(changed)==allowed,(changed,allowed)
untouched=0
for path,blob in originals.items():
    if path in allowed:continue
    assert git('hash-object',str(root/path)).decode().strip()==blob,path
    untouched+=1
newfiles=[line for line in git('diff','--name-only',base,expected).decode().splitlines() if line not in originals]
allowednew={
'apps/gateway/budget/tool-budget-dispatch.mjs','apps/gateway/budget/tool-invocation-owner.mjs','apps/gateway/budget/tool-invocation-record.mjs',
'apps/control/tool-invocations.mjs','apps/control/test/tool-invocations.test.mjs',
'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql',
'docs/coordination/tasks/MERI-DURABLE-INVOCATION-20261012.md','docs/coordination/reports/MERI-DURABLE-INVOCATION-20261012.md',
}
for p in newfiles:
    assert p in allowednew or p.startswith('docs/qualification/candidates/durable-invocation-20261012/author/') or (p.startswith('apps/gateway/test/tool-invocation') and p.endswith('.test.mjs')),p
ast.parse((root/'apps/proxy/qualification/state/postgres_store.py').read_text())
# This is static source inspection only. Existing migration execution remains opt-in.
sql=(root/'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql').read_text()
assert 'CREATE TABLE meri_qualification.tool_invocations' in sql
assert 'UNIQUE(run_id,producer_key_sha256)' in sql
assert 'REFERENCES meri_qualification.tool_reservations(reservation_id)' in sql
sourcepaths=sorted(p for p in [*changed,*newfiles] if p.startswith('apps/'))
manifest=[{'path':p,'bytes':len((root/p).read_bytes()),'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in sourcepaths]
print(json.dumps({'base':base,'authorCommit':expected,'authorTree':git('rev-parse',expected+'^{tree}').decode().strip(),'originalFiles':len(originals),'unchangedOriginalFiles':untouched,'changedOriginalFiles':changed,'sourceHashes':manifest,'migrationExecuted':False,'nativeDatabaseConnected':False,'scope':'exact source, static Python parse and metadata schema inspection only'},indent=2))
