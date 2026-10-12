"""Read/hash only: immutable author packet and local recorded processes/streams."""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[5];HERE=pathlib.Path(__file__).resolve().parent
HEAD='5a8d11399d8a4b65a5b04d73f9f22e5de54a157f';SOURCE='ca506ba1591b35eae5d389e551787017328eea73'
checks=[]
def check(name,value):checks.append({'check':name,'pass':bool(value)})
def blob(path):return subprocess.check_output(['git','-C',str(ROOT),'show',HEAD+':'+path])
def groups():
 result=set()
 for p in pathlib.Path('/proc').iterdir():
  if p.name.isdigit():
   try:result.add(int((p/'stat').read_text().rsplit(')',1)[1].split()[2]))
   except (OSError,ValueError,IndexError):pass
 return result
manifestPath='docs/qualification/candidates/vertical-source-20261012/command-author/manifest.json'
b=blob(manifestPath);manifest=json.loads(b)
check('source binding',manifest['sourceFreeze']==SOURCE)
check('all62 author members',len(manifest['members'])==62)
for m in manifest['members']:
 content=blob(m['path']);check('author member '+m['path'],len(content)==m['bytes'] and hashlib.sha256(content).hexdigest()==m['sha256'])
# Bodies are public Meri evidence only; private source remains metadata.
observed=[];live=groups()
for directory in [HERE,ROOT/'docs/qualification/candidates/vertical-source-20261012/command-author']:
 for path in directory.glob('*.json'):
  try:r=json.loads(path.read_text())
  except (ValueError,UnicodeError):continue
  if not isinstance(r,dict) or 'ownedPidAndPgid' not in r or 'streams' not in r:continue
  pgid=r['ownedPidAndPgid'];check('fresh group absence '+path.name+':'+str(pgid),pgid not in live)
  observed.append({'capture':str(path.relative_to(ROOT)),'pgid':pgid,'recordedAbsent':r['ownedProcessGroupAbsent'],'freshAbsent':pgid not in live,'exitCode':r['exitCode']})
  for s in r['streams']:
   content=(ROOT/s['path']).read_bytes();check('raw receipt '+path.name+':'+s['path'],len(content)==s['bytes'] and hashlib.sha256(content).hexdigest()==s['sha256'])
exact=json.loads(blob('docs/qualification/candidates/vertical-source-20261012/command-author/exact-composition.json'))
check('author immutable141 replay',exact['sourceHead']==SOURCE and exact['sourceDiffBytes']==0 and exact['exitCode']==0)
check('metadata followup no executable delta',all(not p.endswith(('.mjs','.sql','.schema.json')) or '/command-author/' in p for p in subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',SOURCE,HEAD]).decode().splitlines()))
print(json.dumps({'authorPacket':HEAD,'source':SOURCE,'manifestSha256':hashlib.sha256(b).hexdigest(),'authorMembers':len(manifest['members']),'captureGroups':observed,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks)},indent=2));sys.exit(any(not c['pass'] for c in checks))
