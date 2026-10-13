"""Author packet verification using immutable Git objects only."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[5];H=pathlib.Path(__file__).parent
REF='7fb3705a33db61d249d4d3b7f05109705f87b0d8';SOURCE='e91143dafe2da71546fdfb3b0152807032f4e9b8';P='docs/qualification/candidates/document-contract-20261013/author/'
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def data(p):return git('show',REF+':'+p)
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)});assert v,n
raw=data(P+'manifest.json');m=json.loads(raw)
check('manifest exact identity',hashlib.sha256(raw).hexdigest()=='77a1add23bafca4904a1afc03a6af826af651ee1f2fe418ec501e711cad3a6e3')
check('52 unique safe members',len(m['members'])==len({x['path'] for x in m['members']})==52 and all(not x['path'].startswith('/') and '..' not in x['path'].split('/') for x in m['members']))
check('same accepted production source',m['sourceCommit']==SOURCE and not git('diff',SOURCE,REF,'--','apps','packages'))
for x in m['members']:
 b=data(x['path']);check(x['path'],len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'])
for x in m['members']:
 if not x['path'].endswith('.json'):continue
 v=json.loads(data(x['path']))
 if not isinstance(v,dict) or 'ownedProcessGroupAbsent' not in v:continue
 check('captured own group '+x['path'],v['ownedProcessGroupAbsent'] and not v['timedOut'])
 for stream in v['streams']:
  b=data(stream['path']);check('raw '+stream['path'],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
r=json.loads(data(P+'public-final.json'));check('author final run exactsource',r['sourceHead']==SOURCE and r['sourceDiffBytes']==0 and r['exitCode']==0)
result={'verdict':'ACCEPT_METADATA','authorPacket':REF,'source':SOURCE,'checks':checks,'passed':len(checks),'failed':0}
(H/'packet-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
