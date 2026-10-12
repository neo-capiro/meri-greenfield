"""Independent immutable author/repair/receipt metadata audit. No source imports."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
AUTHOR='4c3b35c9d0c1709bfeb61280474c7186d516a618';INITIAL='49db57c9259f0180fad4f619bf745e541d935db9';SOURCE='788c0419c9489dfdd4906a50b59661595a072713';PREREQ='e721b6f815e68df80d598f9ff1d8127a190ae62a'
LANE='docs/qualification/candidates/read-continuation-20261012/entity-candidates-author/'
FAMILY='packages/contracts/retrieval-0.2/entity-candidates-validation.mjs';SCHEMA='packages/contracts/retrieval-0.2/entity-candidates.schema.json';TEST='packages/contracts/test/retrieval-entity-candidates.test.mjs';REVIEWTEST='packages/contracts/test/retrieval-entity-candidates-independent.test.mjs'
checks=[]
def check(name,value): checks.append({'check':name,'pass':bool(value)})
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,timeout=15)
def blob(path,ref=AUTHOR):return git('show',ref+':'+path)
def obj(name):return json.loads(blob(LANE+name))
def sha(b):return hashlib.sha256(b).hexdigest()
manifestBytes=blob(LANE+'manifest.json');manifest=json.loads(manifestBytes)
check('author manifest expected SHA256',sha(manifestBytes)=='cc2a7b1f05ee925ad4d120a98aa8c6e6bc2cc3f28997608d7c97c4d25802f0d0')
check('exact 16 unique members',len(manifest['members'])==16 and len({r['path'] for r in manifest['members']})==16)
check('source binding',manifest['sourceCommit']==SOURCE and manifest['sourceTree']==git('rev-parse',SOURCE+'^{tree}').decode().strip())
for member in manifest['members']:
 data=blob(member['path']);check('author member '+member['path'],len(data)==member['bytes'] and sha(data)==member['sha256'])
for path in [FAMILY,SCHEMA,TEST,'packages/contracts/retrieval-0.2/state-bill-identity.mjs']:
 check('author source unchanged '+path,blob(path)==blob(path,SOURCE))
check('schema unchanged by repair',blob(SCHEMA,INITIAL)==blob(SCHEMA,SOURCE))
old=blob(FAMILY,INITIAL).decode();new=blob(FAMILY,SOURCE).decode()
expected=old.replace('const currentSeen = new Map();','const currentSeen = new Map(), nameIds = new Map();').replace("        const rank = nameOrder.indexOf(row.entityType);","        const ids = nameIds.get(row.entityType) ?? new Set();\n        if (ids.has(row.canonicalId)) fail('Duplicate entity name-search identity');\n        ids.add(row.canonicalId); nameIds.set(row.entityType, ids);\n        const rank = nameOrder.indexOf(row.entityType);")
check('exact name-only production repair',expected==new)
oldtest=blob(TEST,INITIAL);check('original author test retained',blob(LANE+'initial-author-test.mjs')==oldtest)
expectedtest=oldtest.decode().replace("check(page([member(), {...member(), isCurrent: false}, committee()]));","check(page([member(), {...member(), canonicalId: 'B000001', isCurrent: false}, committee()]));")
check('original assertions retained with single fixture correction',blob(TEST,SOURCE).decode().startswith(expectedtest))
check('one additive author regression',blob(TEST,SOURCE).decode().count('\ntest(')==oldtest.decode().count('\ntest(')+1)
check('independent failing controls unchanged before repair',blob(REVIEWTEST,'b5498ce')==(ROOT/REVIEWTEST).read_bytes())
refs=obj('reference-identities.json')
for row in refs['references']:
 for label in ['frozen','observed']:
  ref=row[label];data=git('show',ref['commit']+':'+row['path'],cwd='/workspace/capirov2')
  check('author pin '+label+' '+row['path'],len(data)==ref['bytes'] and sha(data)==ref['sha256'] and git('rev-parse',ref['commit']+':'+row['path'],cwd='/workspace/capirov2').decode().strip()==ref['blob'])
 check('author pair no drift '+row['path'],row['unchanged'] and row['frozen']['blob']==row['observed']['blob'])
check('metadata only',not refs['privateBodiesRetained'] and not refs['executed'])
for label,start,end,count in [('focused-initial',PREREQ,INITIAL,26),('focused-name-uniqueness-repair',INITIAL,SOURCE,27)]:
 r=obj(label+'.json');check('author completed '+label,r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
 check('author capture producer '+label,r['captureSha256']==sha(blob(LANE+'capture-reaped.py')))
 check('author exact dirty source before commit '+label,r['sourceHead']==start and r['sourceDiffSha256']==sha(git('diff',start,end,'--','apps','packages','scripts','package.json','package-lock.json')))
 for stream in r['streams']:
  data=blob(stream['path']);check('author raw '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
 output=blob(LANE+label+'.stdout.bin').decode();check('author count '+label,f'tests {count}' in output and f'pass {count}' in output and 'fail 0' in output and 'skipped 0' in output)
v=obj('verification.json');check('author offline report 41/41',v['passed']==41 and v['failed']==0 and v['originalFilesPreserved']==6110)
for label,code,passes,failures in [('independent-first',0,29,0),('name-duplicates-before',1,29,3),('repaired-family',0,60,0)]:
 r=json.loads((HERE/(label+'.json')).read_text());check('review completed '+label,r['exitCode']==code and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'] and r['sourceDiffBytes']==0)
 for stream in r['streams']:
  data=(ROOT/stream['path']).read_bytes();check('review raw '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
 output=(HERE/(label+'.stdout.bin')).read_text();check('review count '+label,f'pass {passes}' in output and f'fail {failures}' in output and 'skipped 0' in output)
for p in HERE.glob('*.json'):
 r=json.loads(p.read_text())
 if 'ownedPidAndPgid' not in r:continue
 try:
  import os
  os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('owned group remains absent '+p.name,absent)
print(json.dumps({'scope':'INDEPENDENT_IMMUTABLE_PACKET_AND_REPAIR_ONLY','authorCommit':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'sourceCommit':SOURCE,'authorManifestSha256':sha(manifestBytes),'authorManifestMembers':len(manifest['members']),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
