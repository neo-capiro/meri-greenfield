"""Independent exact Git/source preservation audit; no producer or native execution."""
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent
base='cff71e1ba8ca8dea8970ad0c778b580a73f84815';source='753566baf2d230ed241941dcdeca41625277cb1d';head=sys.argv[1] if len(sys.argv)>1 else source
prefix='docs/qualification/candidates/read-continuation-20261012/'
checks=[]
def check(name,ok):checks.append({'check':name,'passed':bool(ok)})
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def data(ref,path):return git('show',ref+':'+path)
def tree(ref):return {line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in git('ls-tree','-r',ref).decode().splitlines()}
def sha(b):return hashlib.sha256(b).hexdigest()
old=tree(base);current=tree(head)
manifest=json.loads(data(head,prefix+'observed-reads-integration/test-expectation-updates.json'))
changes=manifest['changes'];canonical=['packages/contracts/retrieval-0.2/'+s for s in ['catalog-validation.mjs','catalog.json','validate.mjs']]
allow=set(canonical+[x['path'] for x in changes]);changed=[p for p,h in old.items() if current.get(p)!=h]
check('exact20 prior paths changed:3 canonical and17 tests',len(changes)==17 and len(allow)==20 and set(changed)==allow)
check('all other original files byte-preserved',all(current.get(p)==h for p,h in old.items() if p not in allow))
for item in changes:
    original=data(base,item['path']).decode();final=data(head,item['path']).decode();patched=original
    check('original test hash '+item['path'],sha(original.encode())==item['beforeSha256'])
    for replacement in item['replacements']:
        check('replacement original occurrence '+item['path']+' '+replacement['old'][:30],patched.count(replacement['old'])==replacement['count'])
        patched=patched.replace(replacement['old'],replacement['new'])
    check('exact forward patch '+item['path'],patched==final and sha(final.encode())==item['afterSha256'])
    restored=final
    for replacement in reversed(item['replacements']):restored=restored.replace(replacement['new'],replacement['old'])
    check('exact inverse original assertions '+item['path'],restored==original)
for path in canonical:
    check('canonical source freeze '+path,data(head,path)==data(source,path))
expected=[('public-web','c7d2bb344d56552d271c3f8d508b99cb8e2bb970','8edcfe8673072bcc925bc332e5a584b800ca5042','4e6733e7eb971bd71afb9a50817f0993ee02c228'),('sam-opportunities','02bac2139b13dec288b5ca2c19edc3be85e2c6b2','6414cdae5324b43e612b1176e7096cbeb8b50636','ae179ffc40e15a893cfaaa58d07caa6b0c5b2953'),('florida-budget','dabe2b50d94f0b12ef983292a1c18e1ef35d4675','e37a72402f8b4b7167e7efac9c4845caf5acef07','495cf95f842023c856716698a7effc62e98d30ac')]
freeze=json.loads(data(head,prefix+'observed-reads-integration/candidate-freezes.json'))
check('three accepted exact family refs',[(x['family'],x['source'],x['packet'],x['review'])for x in freeze['families']]==expected and freeze['runtimeAccepted'] is False)
familyFiles=[];packets=[]
for family,accepted,packet,review in expected:
    for path in ['packages/contracts/retrieval-0.2/'+family+'-validation.mjs','packages/contracts/retrieval-0.2/'+family+'.schema.json','packages/contracts/test/retrieval-'+family+'.test.mjs']:
        b=data(accepted,path);check('accepted family exact '+path,data(head,path)==b);familyFiles.append({'path':path,'source':accepted,'sha256':sha(b),'bytes':len(b)})
    for role,ref in [('author',packet),('review',review)]:
        paths=tree(ref);folder=prefix+family+'-'+role+'/'
        names=[p for p in paths if p.startswith(folder) and Path(p).name in ['manifest.json','review-manifest.json','packet-manifest.json']]
        check('single manifest '+family+role,len(names)==1)
        mpath=names[0];raw=data(ref,mpath);m=json.loads(raw);members=m.get('members',m.get('files'))
        check('unique packet member paths '+family+role,len({x['path']for x in members})==len(members))
        for item in members:
            b=data(ref,item['path']);check('original and integrated packet member '+item['path'],len(b)==item['bytes'] and sha(b)==item['sha256'] and data(head,item['path'])==b)
        check('complete packet folder preserved '+family+role,all(current.get(p)==h for p,h in paths.items() if p.startswith(folder)))
        packets.append({'family':family,'role':role,'ref':ref,'manifest':mpath,'sha256':sha(raw),'members':len(members)})
for path in ['packages/contracts/test/retrieval-public-web-independent.test.mjs','packages/contracts/test/retrieval-sam-opportunities-independent.test.mjs','packages/contracts/test/retrieval-florida-budget-independent.test.mjs']:
    ref=expected[['public-web','sam-opportunities','florida-budget'].index(path.split('retrieval-')[-1].split('-independent')[0])][3]
    check('accepted independent family test '+path,data(head,path)==data(ref,path))
initial=(ev/'initial-controls.test.mjs').read_text();latest=(root/'packages/contracts/test/retrieval-observed-integration-independent.test.mjs').read_text()
check('only reviewer key-order assumption amended',initial.replace('assert.deepEqual(resolve(id).binding.contextKeys,keys);','assert.deepEqual([...resolve(id).binding.contextKeys].sort(),[...keys].sort());')==latest)
check('actual final focused27 passed',b'pass 27' in (ev/'independent-corrected.stdout.bin').read_bytes() and b'fail 0' in (ev/'independent-corrected.stdout.bin').read_bytes())
result={'base':base,'source':source,'head':head,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'headTree':git('rev-parse',head+'^{tree}').decode().strip(),'originalCount':len(old),'unchangedOriginalCount':len(old)-len(changed),'changedOriginalPaths':changed,'familyFiles':familyFiles,'packets':packets,'checks':checks,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'scope':'SOURCE_ONLY_NO_RUNTIME_ACCEPTANCE'}
(ev/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['head','originalCount','unchangedOriginalCount','passed','failed']}));raise SystemExit(bool(result['failed']))
