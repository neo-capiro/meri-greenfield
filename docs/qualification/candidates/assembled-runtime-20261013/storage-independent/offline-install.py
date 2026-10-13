"""Actual npm admission from clean copied manifests and empty owned cache; no network."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[5]
target = Path(tempfile.mkdtemp(prefix='meri-storage-independent-offline-', dir='/tmp'))
for name in ['package.json', 'package-lock.json']:
    shutil.copyfile(root / 'apps/artifacts/storage' / name, target / name)
for name in ['user.npmrc', 'global.npmrc']:
    (target / name).write_text('')
command = ['npm', 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
           '--userconfig=' + str(target / 'user.npmrc'), '--globalconfig=' + str(target / 'global.npmrc'),
           '--cache=' + str(target / 'cache')]
print(json.dumps({'ownedTemporaryRoot': str(target), 'command': command, 'scope': 'INSTALLATION_ONLY_OFFLINE'}), flush=True)
try:
    result = subprocess.run(command, cwd=target, env={'PATH': os.environ['PATH']}, timeout=160)
finally:
    shutil.rmtree(target)
    print(json.dumps({'ownedTemporaryRoot': str(target), 'removed': not target.exists()}), flush=True)
raise SystemExit(result.returncode)
