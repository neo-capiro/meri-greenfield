"""Read-only independent exact-source/inverse expectation audit; no application imports."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
BASE = 'ede7b56845816d38d0bbffab5a657aaa4f978739'
PREFIX = 'docs/qualification/candidates/read-continuation-20261012/'
checks = []


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, timeout=30)


def raw(ref, path):
    return git('show', ref+':'+path)


def data(ref, path):
    return json.loads(raw(ref,path))


def check(label, ok):
    checks.append({'check':label, 'pass':bool(ok)})


def tree(ref):
    result = {}
    for line in git('ls-tree','-rz',ref).split(b'\0'):
        if line:
            info,path = line.split(b'\t',1)
            result[path.decode()] = info.decode()
    return result


def main(candidate):
    before,after = tree(BASE),tree(candidate)
    packet = PREFIX+'backend-next-integration/'
    patches = data(candidate,packet+'test-expectation-updates.json')
    check('18 explicit reversible original expectation files',len(patches['changes']) == 18 and patches['base'] == BASE)
    for patch in patches['changes']:
        old,new = raw(BASE,patch['path']),raw(candidate,patch['path'])
        check('old/new test hash '+patch['path'],hashlib.sha256(old).hexdigest()==patch['beforeSha256'] and hashlib.sha256(new).hexdigest()==patch['afterSha256'])
        inverse = new.decode()
        for change in reversed(patch['replacements']):
            check('inverse replacement multiplicity '+patch['path']+':'+change['new'],inverse.count(change['new'])==change['count'])
            inverse = inverse.replace(change['new'],change['old'])
        check('all original assertions reversible '+patch['path'],inverse.encode()==old)
    pe = data('cb5310d34cddd13d04b2233c937f271b5b4713d1',PREFIX+'pe-reference-detachment/test-expectation-update.json')
    old,new=raw(BASE,pe['path']),raw(candidate,pe['path'])
    check('PE direct ownership test exact separately reviewed inverse',hashlib.sha256(old).hexdigest()==pe['beforeSha256'] and hashlib.sha256(new).hexdigest()==pe['afterSha256'] and new.decode().replace(pe['after'],pe['before']).encode()==old)
    canonical = {'packages/contracts/retrieval-0.2/'+name for name in ['validate.mjs','catalog.json','catalog-validation.mjs']}
    allowed = canonical | {x['path'] for x in patches['changes']} | {pe['path'],'packages/contracts/retrieval-0.2/pe-references-validation.mjs'}
    actual = {p for p,v in before.items() if after.get(p)!=v}
    check('exact23 existing-file allowlist',len(allowed)==23 and actual==allowed)
    for path,oid in before.items():
        if path not in allowed:
            check('original preserved '+path,after.get(path)==oid)
    catalog=data(candidate,'packages/contracts/retrieval-0.2/catalog.json')
    baseline=data(BASE,'packages/contracts/retrieval-0.2/catalog.json')
    added={'query_outreach','search_program_elements','get_program_element','get_pe_budget_timeline'}
    check('all67 original descriptor bytes/data/order', [d for d in catalog['operations'] if d['operation']['id'] not in added]==baseline['operations'])
    check('exact139 original order', [d['id'] for d in catalog['originals']]==[d['id'] for d in baseline['originals']])
    for original,updated in zip(baseline['originals'],catalog['originals']):
        expected=original | {'state':'mapped','replacement':{'id':original['id'],'version':'0.2.0'}} if original['id'] in added else original
        check('original scope/state '+original['id'],updated==expected)
    check('source disabled and0.2.10/71/70/26',catalog['catalogVersion']=='0.2.10' and len(catalog['operations'])==71 and sum(d['state']=='mapped' for d in catalog['originals'])==70 and sum(d['disposition']=='selected' and d['state']=='pending' for d in catalog['originals'])==26 and all(d['handler'] is None and d['availability']=='unimplemented' and d['qualification']=='pending' and d['retry']['maxRetries']==0 for d in catalog['operations']))
    for path in ['task-create-validation.mjs','task-create.schema.json','artifact-file-validation.mjs','artifact-file.schema.json','validate.mjs']:
        full='packages/contracts/commands-0.2/'+path
        check('PR33 private command bytes '+path,raw(candidate,full)==raw('a838c3819ca01798d9175a1d07bef1eb81355808',full))
    pe_source='packages/contracts/retrieval-0.2/pe-references-validation.mjs'
    check('exact accepted PE detached return source',raw(candidate,pe_source)==raw('8dcc6e13f360c15d9ba0f7c9fbd3419f1318afe3',pe_source))
    freezes=data(candidate,packet+'candidate-freezes.json')
    check('no unreviewed family admitted',freezes['unintegratedPendingReview']==[] and all(f['verdict']=='ACCEPT_SOURCE' for f in freezes['families']))
    for family in freezes['families']:
        if family['family'] not in ['outreach-query','program-elements']:
            continue
        name=family['family']
        for path in ['packages/contracts/retrieval-0.2/'+name+'-validation.mjs','packages/contracts/retrieval-0.2/'+name+'.schema.json','packages/contracts/test/retrieval-'+name+'.test.mjs']:
            check('accepted family exact '+path,raw(candidate,path)==raw(family['source'],path))
    report={'base':BASE,'candidate':candidate,'tree':git('rev-parse',candidate+'^{tree}').decode().strip(),'originalFiles':len(before),'existingChanges':sorted(actual),'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'limits':'Source objects only; no native/runtime, SQL, provider, package or application execution. Original-test inverse proves exact retention, not native behavior.'}
    print(json.dumps(report,indent=2))
    return bool(report['failed'])


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1]))
