"""Local metadata/source-only audit. Private source bytes are hashed, never printed."""
import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path.cwd();base='e5fb3963de787bbd7b7663316c368f15814897da';evidence=root/'docs/qualification/candidates/vertical-source-20261012/command-author'
checks=[]
def check(name,value):
 checks.append({'check':name,'passed':bool(value)})
 if not value: print('FAIL',name)
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
allowed={'apps/gateway/authorization/current-tool-authority.mjs','apps/gateway/index.mjs','apps/gateway/budget/postgres-tool-budget.mjs','apps/gateway/budget/tool-budget-dispatch.mjs','packages/contracts/commands-0.2/artifact-file-validation.mjs','packages/contracts/test/command-artifact-file.test.mjs'}
original={line.split(b'\t',1)[1].decode():line.split(b'\t',1)[0].split()[2].decode() for line in git('ls-tree','-r',base).splitlines()}
current={line.split(b'\t',1)[1].decode():line.split(b'\t',1)[0].split()[2].decode() for line in git('ls-tree','-r','HEAD').splitlines()}
changed={p for p,blob in original.items() if current.get(p)!=blob}
check('only six expressly allocated existing paths changed',changed==allowed)
check('public0.1 unchanged',all(current[p]==b for p,b in original.items() if p.startswith('packages/contracts/') and '/commands-0.2/' not in p and '/test/' not in p))
check('original migrations/locks untouched',all(current[p]==b for p,b in original.items() if '/migrations/' in p or p.endswith('lock.json') or p.endswith('lock.txt')))
check('source catalog unchanged',current['packages/contracts/retrieval-0.2/catalog.json']==original['packages/contracts/retrieval-0.2/catalog.json'])
check('authority dependency exact root freeze',git('show','HEAD:apps/gateway/authorization/current-tool-authority.mjs')==git('show','50576f78db514dbd09de2d4b34f1ef82e1d18967:apps/gateway/authorization/current-tool-authority.mjs'))
check('gateway preserves root public authority entry',git('show','HEAD:apps/gateway/index.mjs').startswith(git('show','50576f78db514dbd09de2d4b34f1ef82e1d18967:apps/gateway/index.mjs')))
for row in json.loads((evidence/'reference-identities.json').read_text())['references']:
 for label in ['pinned','observed']:
  identity=row[label];content=git('show',identity['commit']+':'+row['path'],cwd='/workspace/capirov2')
  check(label+' '+row['path'],len(content)==identity['bytes'] and hashlib.sha256(content).hexdigest()==identity['sha256'] and git('rev-parse',identity['commit']+':'+row['path'],cwd='/workspace/capirov2').decode().strip()==identity['blob'])
 check('unchanged '+row['path'],row['pinned']['blob']==row['observed']['blob'])
new=[p for p in current if p not in original]
for p in new:
 if p.endswith('.mjs') and (p.startswith('apps/control/') or p.startswith('apps/gateway/') or p.startswith('packages/contracts/commands-0.2/')):
  result=subprocess.run(['node','--check',str(root/p)],capture_output=True)
  check('syntax '+p,result.returncode==0)
for p in ['packages/contracts/commands-0.2/execution-intent.mjs','packages/contracts/commands-0.2/execution-boundary.mjs']:
 check('no package to application dependency '+p,b'/apps/' not in (root/p).read_bytes())
check('journal migration source only single table', (root/'apps/control/commands/migrations/0001_commands.sql').read_text().count('CREATE TABLE')==1)
check('no private source implementation introduced',not any(p.startswith('apps/api/') for p in new))
check('whitespace diff',subprocess.run(['git','diff','--check',base],capture_output=True).returncode==0)
result={'sourceHead':git('rev-parse','HEAD').decode().strip(),'scope':'SOURCE_METADATA_ONLY_NO_RUNTIME_ADMISSION','originalFiles':len(original),'originalPreserved':len(original)-len(changed),'allowedOriginalChanges':sorted(changed),'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks)}
(evidence/'source-audit-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}));sys.exit(0 if result['passed']==len(checks) else 1)
