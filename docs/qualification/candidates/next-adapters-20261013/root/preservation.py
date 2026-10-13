"""Compare immutable baselines and deliberate public extension against the final candidate."""
import hashlib, json, pathlib, subprocess

root = pathlib.Path(__file__).resolve().parents[5]
base = 'a2aef4a5fcd3c19cec974dc62b69222836d71b3e'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def old(path):
    return git('show', base + ':' + path)
checks = []
def check(name, result):
    checks.append({'name': name, 'passed': bool(result)})
    assert result, name
for pin in ['70516e5c9681917ce493bbc50e3023494f2e1209', '25e0d29d6f0b6c3de284d13e86bc5f1aa0c00d21', '980c71b7941b7f13f3e1831009076f283aedbe71', 'a72d130b26d39c99d9d87a524795cee15aca8efc', '398d599311a5f6c48e18d31b4928cf665de8dcb9', '18adda2c5461b8d346277135aafd3972b4768802', base]:
    check('ancestor:' + pin, subprocess.run(['git','merge-base','--is-ancestor',pin,'HEAD'],cwd=root).returncode == 0)
old_package = json.loads(old('packages/contracts/package.json'))
package = json.loads((root / 'packages/contracts/package.json').read_bytes())
check('new additive release0.1.3', package['version'] == '0.1.3')
check('unchanged dependencies and public package allowlist', all(package[k] == old_package[k] for k in ['dependencies','devDependencies','files','engines','private','license']))
for name, value in old_package['exports'].items():
    check('unchanged export:' + name, package['exports'][name] == value)
check('only conversation subpaths added', set(package['exports']) - set(old_package['exports']) == {'./conversation-application','./conversation-application/schema'})
for raw in git('ls-tree','-r','--name-only',base,'packages/contracts/dist/').decode().splitlines():
    check('unchanged original distribution:' + raw, (root / raw).read_bytes() == old(raw))
for prefix in ['packages/contracts/retrieval-0.2/', 'packages/skills/', 'apps/control/qualification-sdk-fixture/', 'apps/worker/qualification/', 'docs/plans/']:
    check('unchanged protected subtree:' + prefix, not git('diff','--name-only',base,'HEAD','--',prefix).strip())
check('unchanged frozen public schema', (root/'packages/contracts/meri.schema.json').read_bytes() == old('packages/contracts/meri.schema.json'))
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_bytes())
entries=catalog['operations']
check('all97 production operations still pending', len(entries)==97 and all(e['availability']=='unimplemented' and e['qualification']=='pending' and e['handler'] is None for e in entries))
check('unchanged conversation model/store/session/durability source', not git('diff','--name-only',base,'HEAD','--','apps/worker/conversation/','apps/control/conversations/service.mjs','apps/control/conversations/postgres-store.mjs','apps/control/conversations/events.mjs','apps/control/conversations/workflow.ts','apps/control/conversations/temporal-dispatch.mjs').strip())
result={'schema':'meri.next-adapters-preservation/1','base':base,'commit':git('rev-parse','HEAD').decode().strip(),'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'checks':checks,'allPassed':True,'frozenSchemaSha256':hashlib.sha256((root/'packages/contracts/meri.schema.json').read_bytes()).hexdigest()}
print(json.dumps(result,indent=2))
