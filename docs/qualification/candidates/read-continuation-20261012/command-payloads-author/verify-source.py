"""Bounded local source/pin audit; no private module execution or services."""
from pathlib import Path
import hashlib
import json
import subprocess
import re
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
checks=[]
def check(name,value):checks.append({'name':name,'passed':bool(value)})
def git(*args,cwd=root):return subprocess.check_output(['git','-C',str(cwd),*args],stderr=subprocess.PIPE)
def private(path):return git('show','fd8765ec01d292013758606204f2c9d886cd31c1:'+path,cwd='/workspace/capirov2').decode()
refs=json.loads((evidence/'reference-identities.json').read_text())
for entry in refs['references']:
 for key in ['pinned','observed']:
  x=entry[key];raw=git('show',x['commit']+':'+entry['path'],cwd='/workspace/capirov2');check(entry['path']+':'+key,len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256'] and git('rev-parse',x['commit']+':'+entry['path'],cwd='/workspace/capirov2').decode().strip()==x['blob'])
 check(entry['path']+':no-drift',entry['pinned']['blob']==entry['observed']['blob'])
s=private('apps/api/prisma/schema.prisma');model=re.search(r'model EngagementTask \{([\s\S]*?)\n\}',s)[1]
check('task status default todo',bool(re.search(r'status\s+EngagementTaskStatus\s+@default\(todo\)',model)))
check('task dueDate nullable SQL date',bool(re.search(r'dueDate\s+DateTime\?[^\n]*@db\.Date',model)))
check('task id UUID',bool(re.search(r'id\s+String[^\n]*@db.Uuid',model)))
service=private('apps/api/src/engagement/engagement.service.ts')
check('task owner default null','ownerUserId: input.ownerUserId ?? null' in service)
check('task creator context actor','createdByUserId: ctx.userId' in service)
filing=private('apps/api/src/meri/meri-client-filing.service.ts')
prestorage=filing.splitlines()[148:151]
check('missing bytes/type is prestorage failed (corrected source trace)', 'byteLength' in prestorage[0] and 'mediaType' in prestorage[0] and "status: 'failed'" in prestorage[1])
check('quarantine is pending',"const pending = document.lifecycleStatus === 'quarantined'" in filing)
check('pending/failed not indexed',"failed || pending ? 'not_indexed'" in filing)
check('reused exact boolean',"reused: document.reused === true" in filing)
allowed=['packages/contracts/commands-0.2/task-create.schema.json','packages/contracts/commands-0.2/task-create-validation.mjs','packages/contracts/commands-0.2/artifact-file.schema.json','packages/contracts/commands-0.2/artifact-file-validation.mjs','packages/contracts/test/command-task-create.test.mjs','packages/contracts/test/command-artifact-file.test.mjs']
identities=[]
for p in allowed:
 raw=(root/p).read_bytes();check(p+':committed-current',raw==git('show','HEAD:'+p));identities.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'blob':git('rev-parse','HEAD:'+p).decode().strip()})
for family in ['task-create','artifact-file']:
 data=json.loads((root/f'packages/contracts/commands-0.2/{family}.schema.json').read_text());check(family+':URN',data['$id']==f'urn:meri:commands:{family}:0.2.0')
 source=(root/f'packages/contracts/commands-0.2/{family}-validation.mjs').read_text();check(family+':canonical inert reuse',"import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs'" in source)
 check(family+':no effect ports',not re.search(r'\b(fetch|spawn|execFile|connect|writeFile|createServer)\s*\(',source))
 check(family+':no private import','@capiro' not in source and '/apps/api/' not in source)
old={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r',base).decode().splitlines()};new={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r','HEAD').decode().splitlines()}
check('all original Git entries unchanged',all(new.get(k)==v for k,v in old.items()))
check('no original working-tree modifications',not git('diff',base,'--',*old.keys()))
check('six allocated source additions only',set(git('diff','--name-only',base,'--','packages').decode().splitlines())==set(allowed))
public=json.loads(git('show','HEAD:packages/contracts/meri.schema.json'));check('public vocabulary unchanged',public['$defs']['Command']['properties']['action']['enum']==['memory.propose','task.create','artifact.file'])
record={'base':base,'head':git('rev-parse','HEAD').decode().strip(),'scope':'SOURCE_ONLY_NO_RUNTIME_ADMISSION','originalEntries':len(old),'identities':identities,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks)}
(evidence/'source-checks.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['head','originalEntries','passed','failed']}))
for x in checks:
 if not x['passed']:print('FAILED: '+x['name'])
raise SystemExit(bool(record['failed']))
