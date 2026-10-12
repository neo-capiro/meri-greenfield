"""Replay retained new-Meri source data; no private Capiro import or execution."""
import os, shutil, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[5]
initial=Path(__file__).resolve().parent/'initial-source'
with tempfile.TemporaryDirectory(prefix='meri-pe-review-') as temporary:
    destination=Path(temporary)
    shutil.copytree(initial/'packages',destination/'packages')
    (destination/'packages/contracts/retrieval-0.2/operation-contracts.mjs').symlink_to(root/'packages/contracts/retrieval-0.2/operation-contracts.mjs')
    environment=dict(os.environ,MERI_PE_REVIEW_SOURCE_ROOT=str(destination))
    result=subprocess.run(['node','--test','packages/contracts/test/retrieval-pe-references-independent.test.mjs'],cwd=root,env=environment,check=False)
    raise SystemExit(result.returncode)
