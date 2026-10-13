import subprocess,json,hashlib,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[5];HERE=pathlib.Path(__file__).resolve().parent
PACKET='e2242bb113b2f9adc2028fc5cef005e36c07fb2e';SOURCE='6f14d780a40e878fa62bc928c4d520286313f56c';MP='docs/qualification/candidates/task-slice-20261012/control-author/manifest.json'
def blob(p,ref=PACKET):return subprocess.check_output(['git','show',ref+':'+p],cwd=ROOT)
checks=[]
def check(k,v):checks.append({'check':k,'pass':bool(v)})
raw=blob(MP);manifest=json.loads(raw);check('manifest sha',hashlib.sha256(raw).hexdigest()=='584290782636caaf2b009220b310d4b98bfc7f7ce6f198e7678745e87af18b34');check('source freeze',manifest['sourceFreeze']==SOURCE);check('member count',len(manifest['members'])==53)
for m in manifest['members']:
 b=blob(m['path']);check('member '+m['path'],len(b)==m['bytes'] and hashlib.sha256(b).hexdigest()==m['sha256'])
audit=json.loads((HERE/'source-audit.json').read_text())
for m in audit['sourceFiles']:check('source packet exact '+m['path'],blob(m['path'])==blob(m['path'],SOURCE)==(ROOT/m['path']).read_bytes())
base='77cedb126d57a0223d2df42ad2f3fe988eb51759';names=subprocess.check_output(['git','diff','--name-only',base,PACKET],cwd=ROOT).decode().splitlines();expected={m['path'] for m in manifest['members']}|{MP};check('complete packet membership',set(names)==expected)
r={'packet':PACKET,'source':SOURCE,'manifestSha256':hashlib.sha256(raw).hexdigest(),'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'nativeRuntimeAccepted':False};(HERE/'packet-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k] for k in ['packet','source','passed','failed']}));raise SystemExit(bool(r['failed']))
