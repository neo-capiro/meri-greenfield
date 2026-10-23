"""Derive the preview Core ship kit for a new capiro-backend commit from ship-core-ca4de503.
Changes: source/archive pins, rollback = the serving :7 (ca4de503, already on the clone), and step 04 copies
the rollback revision changing only image + RELEASE_SHA (no DB_HOST swap). 045 (migrations) is dropped: no migration."""
import hashlib, os, re, shutil, subprocess, sys
SRC = 'C:/dev/fable/ship-core-ca4de503'
REPO = 'C:/dev/fable/wt-be-layoutlog'
sha = subprocess.run(['git', '-C', REPO, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True).stdout.strip()
branch = subprocess.run(['git', '-C', REPO, 'rev-parse', '--abbrev-ref', 'HEAD'], check=True, capture_output=True, text=True).stdout.strip()
out = f'C:/dev/fable/ship-core-{sha[:8]}'
assert not os.path.exists(out), out
os.makedirs(out)
for f in os.listdir(SRC):
    if f.endswith('.sh') or f in ('buildspec.template.yml', 'kit.env', 'verify-alpine-amd64-scan.cjs'):
        if f != '045-migrate-clone.sh':
            shutil.copy(f'{SRC}/{f}', out)
archive = f'core-{sha}-lf.zip'
subprocess.run(['git', '-C', REPO, '-c', 'core.autocrlf=false', 'archive', '--format=zip', '-o', f'{out}/{archive}', sha], check=True)
digest = hashlib.sha256(open(f'{out}/{archive}', 'rb').read()).hexdigest()
OLD_SHA, OLD_ZIP_SHA = 'ca4de503fb6ec09caf0daf8b976a0f649c6b9665', '95208dbbffaed4bf3894d861601747764a6105a4f27211158e095e49423e796f'

def edit(name, pairs):
    p = f'{out}/{name}'
    s = open(p, encoding='utf-8').read()
    for old, new, count in pairs:
        assert s.count(old) == count, (name, old, s.count(old))
        s = s.replace(old, new)
    open(p, 'w', encoding='utf-8', newline='\n').write(s)

edit('buildspec.template.yml', [(OLD_SHA, sha, 2), (OLD_ZIP_SHA, digest, 1)])
env = open(f'{out}/kit.env', encoding='utf-8').read()
env = re.sub(r'^SOURCE_BRANCH=.*$', f'SOURCE_BRANCH={branch}', env, flags=re.M)
env = env.replace(f'SOURCE_SHA={OLD_SHA}', f'SOURCE_SHA={sha}').replace(f'ARCHIVE_SHA256={OLD_ZIP_SHA}', f'ARCHIVE_SHA256={digest}')
env = re.sub(r'^ROLLBACK_TD=.*$', 'ROLLBACK_TD=arn:aws:ecs:us-east-1:967807252336:task-definition/capiro-preview-first-chat-core:7', env, flags=re.M)
env = re.sub(r'^ROLLBACK_DIGEST=.*$', 'ROLLBACK_DIGEST=sha256:036b368c3de9cfd8cb191bb8849760efeb2530d131e3317f7e6c357ccda54f23', env, flags=re.M)
env = re.sub(r'^ROLLBACK_SHA=.*$', f'ROLLBACK_SHA={OLD_SHA}', env, flags=re.M)
assert sha in env and OLD_ZIP_SHA not in env
open(f'{out}/kit.env', 'w', encoding='utf-8', newline='\n').write(env)
edit('04-register-td.sh', [(
"""(host,) = [e for e in c['environment'] if e['name'] == 'DB_HOST']
# DATABASE_URL is empty here; the entrypoint composes it from DB_* (so only DB_HOST moves).
(url,) = [e for e in c['environment'] if e['name'] == 'DATABASE_URL']
assert url['value'] == '' and host['value'] != clone_host
host['value'] = clone_host
""",
"""# The rollback revision already serves the clone; only the image and RELEASE_SHA change.
(host,) = [e for e in c['environment'] if e['name'] == 'DB_HOST']
assert host['value'] == clone_host, host['value']
""", 1),
 ("== ['DB_HOST', 'RELEASE_SHA']", "== ['RELEASE_SHA']", 1),
 ("TD_DIFF_OK image + RELEASE_SHA + DB_HOST -> clone", "TD_DIFF_OK image + RELEASE_SHA", 1)])
print(out, sha, digest)
