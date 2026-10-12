"""Exercise actual Git-source baseline logic with a test-only Linux Git adapter.

Usage: python3 -B probe-baseline.py <exact-candidate-commit>
Exit0 proves local source equality only. Any error exits nonzero. No build runs.
"""
from pathlib import Path
from unittest.mock import patch
import json
import re
import shutil
import sys

root = Path(__file__).resolve().parents[5]
if len(sys.argv) != 2 or not re.fullmatch('[a-f0-9]{40}', sys.argv[1]):
    raise SystemExit('exact candidate commit required')
sys.path.insert(0, str(root / 'scripts/qualification'))
import worker_image_build as build

native_git = shutil.which('git')
if sys.platform != 'linux' or native_git is None:
    raise SystemExit('local Linux source-check Git required')
with patch.object(build.source, 'GIT', native_git):
    source = build.baseline(sys.argv[1])
assert build.context_manifest_sha(source) == build.collector.CONTEXT_SHA
print(json.dumps({'sourceOnly': True, 'candidate': sys.argv[1],
                  'acceptedReference': build.REFERENCE,
                  'verifiedSourceMembers': len(source),
                  'stableMembers': len([p for p in build.ORIGINAL if p not in build.PACKAGING_CHANGES]),
                  'contextManifestSha256': build.collector.CONTEXT_SHA,
                  'testOnlyGitAdapter': native_git,
                  'fixedWindowsGitAndRuntimeQualified': False,
                  'buildAuthorized': False}))
