"""Read exact author Git objects and verify packet, repair and source receipts."""
from pathlib import Path
import hashlib,json,subprocess,os
ROOT=Path(__file__).resolve().parents[5];HERE=Path(__file__).resolve().parent
AUTHOR='6414cdae5324b43e612b1176e7096cbeb8b50636';SOURCE='02bac2139b13dec288b5ca2c19edc3be85e2c6b2';INITIAL='ac1c8d86cbef293d1afb82268ce755be975b8e49'
LANE='docs/qualification/candidates/read-continuation-20261012/sam-opportunities-author/';FILES=['packages/contracts/retrieval-0.2/sam-opportunities.schema.json','packages/contracts/retrieval-0.2/sam-opportunities-validation.mjs','packages/contracts/test/retrieval-sam-opportunities.test.mjs'];checks=[]
def check(name,value):checks.append({'check':name,'pass':bool(value)})
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,timeout=15)
def raw(path,ref=AUTHOR):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def obj(name):return json.loads(raw(LANE+name))
m=obj('manifest.json');manifestSha=sha(raw(LANE+'manifest.json'))
check('manifest expected hash',manifestSha=='6c68639043c921db30280a74ec81cc5734a43b1004ae9943d03cfcddf1a60de6')
check('25 unique packet members',len(m['files'])==25 and len({v['path'] for v in m['files']})==25)
check('manifest binds reviewed source',m['source']==SOURCE and m['sourceTree']==git('rev-parse',SOURCE+'^{tree}').decode().strip() and m['preservedFirstSource']==INITIAL)
for f in m['files']:
 b=raw(f['path']);check('member '+f['path'],len(b)==f['bytes'] and sha(b)==f['sha256'])
actual=set(git('ls-tree','-r','--name-only',AUTHOR,'--',LANE).decode().splitlines())
covered={f['path'] for f in m['files'] if f['path'].startswith(LANE)}|{LANE+'manifest.json',LANE+'verification.json'}
check('complete author lane coverage with declared exclusions',actual==covered)
for f in FILES:check('packet source unchanged '+f,raw(f)==raw(f,SOURCE))
check('validator byte-identical to first source',raw(FILES[1],INITIAL)==raw(FILES[1],SOURCE))
old=json.loads(raw(FILES[0],INITIAL));new=json.loads(raw(FILES[0],SOURCE));notes=old['$defs']['SamOpportunitiesOutput']['properties']['notes'];first,second=[r['const'] for r in notes['prefixItems']]
old['$defs']['SamOpportunitiesOutput']['properties']['notes']={'type':'array','enum':[[first],[first,second]]};check('only equivalent exact notes schema repair',old==new)
oldtest=raw(FILES[2],INITIAL).decode();expected=oldtest.replace('schema.$defs.SamOpportunitiesOutput.properties.notes.prefixItems.map(item=>item.const)','schema.$defs.SamOpportunitiesOutput.properties.notes.enum[1]')
check('every author assertion unchanged; fixture lookup only',raw(FILES[2],SOURCE).decode()==expected)
refs=obj('reference-identities.json');check('private metadata only',not refs['privateBodiesPublished'] and not refs['sourceExecuted'])
check('nine author reference pairs',len(refs['references'])==9)
for row in refs['references']:
 for v in row['versions']:
  loc=v['commit']+':'+row['path'];b=git('show',loc,cwd='/workspace/capirov2');check('reference '+loc,len(b)==v['bytes'] and sha(b)==v['sha256'] and git('rev-parse',loc,cwd='/workspace/capirov2').decode().strip()==v['blob'])
 check('reference unchanged '+row['path'],row['unchanged'] and row['versions'][0]['blob']==row['versions'][1]['blob'])
for label,source,code in [('focused',INITIAL,1),('focused-notes-repaired',SOURCE,0),('metadata-audit',SOURCE,0)]:
 r=obj(label+'.json');check('author source receipt '+label,r['sourceHead']==source and r['sourceDiffBytes']==0 and r['sourceDiffSha256']==sha(b''))
 check('author completion '+label,r['exitCode']==code and r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
 check('author capture identity '+label,r['captureSha256']==sha(raw(LANE+'capture-reaped.py')))
 for s in r['streams']:
  b=raw(s['path']);check('raw '+s['path'],len(b)==s['bytes'] and sha(b)==s['sha256'])
 try:os.killpg(r['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('author group currently absent '+label,absent)
failed=raw(LANE+'focused.stdout.bin').decode();passed=raw(LANE+'focused-notes-repaired.stdout.bin').decode()
check('initial strict-Ajv compilation failure retained','strict mode' in failed and 'prefixItems' in failed and 'fail 1' in failed and 'pass 0' in failed)
check('repaired 35 passing controls retained',all(x in passed for x in ['tests 35','pass 35','fail 0','skipped 0']))
v=obj('metadata-audit.stdout.bin');check('author metadata62/62 originals6528',v['passed']==62 and v['failed']==0 and v['originalBlobsPreserved']==6528)
v=obj('verification.json');check('author packet36/36',v['passed']==36 and v['failed']==0)
check('independent test byte-identical pre-candidate',(ROOT/'packages/contracts/test/retrieval-sam-opportunities-independent.test.mjs').read_bytes()==raw('packages/contracts/test/retrieval-sam-opportunities-independent.test.mjs','200fab3c4227f2df1fd77922a2cab8aa2e0a5589'))
for label in ['independent-first','source-audit']:
 r=json.loads((HERE/(label+'.json')).read_text());check('review capture complete '+label,r['exitCode']==0 and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'] and not r['timedOut'])
 for s in r['streams']:
  b=(ROOT/s['path']).read_bytes();check('review raw '+s['path'],len(b)==s['bytes'] and sha(b)==s['sha256'])
print(json.dumps({'scope':'INDEPENDENT_IMMUTABLE_AUTHOR_PACKET_ONLY','authorCommit':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'sourceCommit':SOURCE,'manifestSha256':manifestSha,'manifestMembers':25,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
