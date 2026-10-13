"""Explicit public dependency installation; no credential/config discovery."""
import os, pathlib, subprocess, tempfile, urllib.parse
root=pathlib.Path.cwd();cache=root/'docs/qualification/candidates/assembled-runtime-20261013/root/.npm-cache'
allowed=['PATH','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR']
env={k:os.environ[k] for k in allowed if k in os.environ}
for k,v in env.items():
 if k.lower() in ['http_proxy','https_proxy','all_proxy']:
  u=urllib.parse.urlparse(v)
  if u.username or u.password:raise SystemExit('Tool proxy contains credentials; refuse')
with tempfile.TemporaryDirectory(prefix='meri-runtime-public-npm-') as temporary:
 user=pathlib.Path(temporary)/'user.npmrc';global_config=pathlib.Path(temporary)/'global.npmrc';user.write_text('');global_config.write_text('')
 for package in ['apps/runtime','apps/artifacts/storage']:
  subprocess.run(['npm','ci','--prefix',package,'--ignore-scripts','--no-audit','--no-fund','--registry','https://registry.npmjs.org','--cache',str(cache),'--userconfig',str(user),'--globalconfig',str(global_config)],env=env,check=True,timeout=90)
