from pathlib import Path
import subprocess,hashlib,json,sys
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
candidate=sys.argv[1];base='ede7b56845816d38d0bbffab5a657aaa4f978739';checks=[]
def git(*a):return subprocess.check_output(['git',*a],cwd=r)
def check(name,okay):
 checks.append({'name':name,'pass':bool(okay)})
 if not okay:raise AssertionError(name)
def blobs(ref):return {x.split('\t',1)[1]:x.split()[2] for x in git('ls-tree','-r',ref).decode().splitlines()}
b,c=blobs(base),blobs(candidate)
check('all original paths preserved',set(b)<=set(c));changed=[p for p in b if b[p]!=c[p]];check('no original source or test edits',not changed)
owned=[p for p in c if p.startswith('packages/contracts/retrieval-0.2/program-element') or p=='packages/contracts/test/retrieval-program-elements.test.mjs']
for p in owned:
 check('working source exact '+p,git('hash-object',p).decode().strip()==c[p])
for row in json.loads((e/'reference-identities.json').read_text())['references']:
 for label in ['frozen','observed']:
  pin=row[label];data=subprocess.check_output(['git','show',pin['commit']+':'+row['path']],cwd='/workspace/capirov2');blob=subprocess.check_output(['git','rev-parse',pin['commit']+':'+row['path']],cwd='/workspace/capirov2',text=True).strip()
  check(label+' '+row['path'],blob==pin['blob'] and len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'])
for receipt in sorted(e.glob('*.json')):
 rec=json.loads(receipt.read_text())
 if not isinstance(rec,dict) or 'ownedPidAndPgid' not in rec:continue
 check(receipt.name+' bounded physical cleanup',rec['ownedProcessGroupAbsent'] and not rec['timedOut'] and not rec['ownedGroupKillRequired'])
 for stream in rec['streams']:
  data=(r/stream['path']).read_bytes();check(receipt.name+' '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
for p in owned:
 if p.endswith('.mjs') and '/test/' not in p:
  src=git('show',candidate+':'+p).decode()
  check('no private/runtime dependencies '+p,not any(v in src for v in ['capirov2','@capiro','fetch(','node:child_process','setInterval(','Date.now(','process.env']))
result={'base':base,'candidate':candidate,'tree':git('rev-parse',candidate+'^{tree}').decode().strip(),'originalsPreserved':len(b),'ownedSourceFiles':owned,'sourceHashes':{p:hashlib.sha256(git('show',candidate+':'+p)).hexdigest() for p in owned},'passed':len(checks),'checks':checks,'unrun':['Native runtime','SQL/DB','Private producers','Provider/model calls','Broad/public suites']}
(e/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['candidate','originalsPreserved','passed']}))
