"""Offline exact commit/source preservation receipt; no native operations."""
import hashlib,json,subprocess
from pathlib import Path
BASE='90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73'
AUTHOR='dc4a046028bdfb798dc2b1888721afc45f2e97a3'
ROOT=Path('/workspace/meri-native-ancestor-diagnosis-20261012')
SOURCE='docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py'
OLD='docs/qualification/candidates/native-capture-diagnosis-20261012/inspect-local-metadata.py'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,timeout=15)
def require(value,name):
    if not value:raise ValueError(name)
require(git('rev-parse','HEAD').decode().strip()==AUTHOR,'exact_author_commit')
require(git('status','--porcelain')==b'','clean_author_worktree')
changes=git('diff','--name-status',BASE,AUTHOR).decode().splitlines()
require(all(row.startswith('A\tdocs/') for row in changes),'all_original_files_unchanged')
data=git('show',AUTHOR+':'+SOURCE)
require(data==(ROOT/SOURCE).read_bytes(),'freeze_matches_worktree')
require(len(data)==6297 and hashlib.sha256(data).hexdigest()=='9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd','final_source_pin')
old=git('show',BASE+':'+OLD)
require(old==git('show',AUTHOR+':'+OLD),'old_diagnostic_unchanged')
checks=json.loads((ROOT/'docs/qualification/candidates/native-ancestor-diagnosis-20261012/author/checks.json').read_bytes())
for name,record in checks['rawEvidence'].items():
    raw=(ROOT/'docs/qualification/candidates/native-ancestor-diagnosis-20261012/author'/name).read_bytes()
    require(len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256'],'author_raw_'+name)
print(json.dumps({'verdict':'PASS_EXACT_SOURCE_INTEGRITY','base':BASE,'authorCommit':AUTHOR,'allBaseFilesUnchanged':len(git('ls-tree','-r','--name-only',BASE).splitlines()),'source':{'path':SOURCE,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},'originalDiagnosticSha256':hashlib.sha256(old).hexdigest(),'authorRawFilesVerified':len(checks['rawEvidence']),'nativeExecuted':False},indent=2))
