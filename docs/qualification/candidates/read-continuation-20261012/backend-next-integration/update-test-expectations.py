"""Explicit reversible registry expectations; original behavior controls remain."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
packet=Path(__file__).resolve().parent
base='ede7b56845816d38d0bbffab5a657aaa4f978739'
ids=['query_outreach','search_program_elements','get_program_element','get_pe_budget_timeline']
prior=json.loads((packet.parent/'observed-reads-integration/test-expectation-updates.json').read_text())
paths=[x['path'] for x in prior['changes']]+['packages/contracts/test/retrieval-observed-integration-independent.test.mjs']
changes=[]
pending=[]
for path in paths:
    original=subprocess.check_output(['git','show',base+':'+path],cwd=root)
    target=root/path
    assert target.read_bytes()==original,path
    text=original.decode();edits=[]
    def edit(old,new,required=False):
        global text
        count=text.count(old)
        assert count or not required,(path,old)
        if count:
            text=text.replace(old,new)
            edits.append({'old':old,'new':new,'count':count})
    if path.endswith('retrieval-observed-integration-independent.test.mjs'):
        edit("const ids=['search_public_web'",'const backendIds='+json.dumps(ids)+";\nconst ids=['search_public_web'",True)
        edit('!ids.includes(x.operation.id)','!ids.includes(x.operation.id)&&!backendIds.includes(x.operation.id)',True)
        edit('!ids.includes(x.id)','!ids.includes(x.id)&&!backendIds.includes(x.id)',True)
        edit('ids.includes(old.id)?','(ids.includes(old.id)||backendIds.includes(old.id))?',True)
    else:
        edit('"get_florida_budget_project"','"get_florida_budget_project", '+', '.join(json.dumps(x) for x in ids))
    for space in ['', ' ']:
        for before,after in [(30,26),(66,70),(67,71)]:
            edit('.length,'+space+str(before)+')','.length,'+space+str(after)+')')
        edit('.size,'+space+'67)','.size,'+space+'71)')
    edit("'0.2.9'","'0.2.10'")
    edit('all 67','all 71');edit('all67','all71')
    assert edits,path
    inverse=text
    for e in reversed(edits):
        assert inverse.count(e['new'])==e['count'],(path,e)
        inverse=inverse.replace(e['new'],e['old'])
    assert inverse.encode()==original,path
    pending.append((target,text))
    changes.append({'path':path,'beforeSha256':hashlib.sha256(original).hexdigest(),'afterSha256':hashlib.sha256(text.encode()).hexdigest(),'replacements':edits,'inverseExact':True,'change':'Explicit outreach/program-element mapping allowlist and canonical count/version expectations; all prior behavioral and pending-refusal assertions retained.'})
for target,text in pending:
    target.write_text(text)
(packet/'test-expectation-updates.json').write_text(json.dumps({'base':base,'explicitNewOperationIds':ids,'changes':changes},indent=2)+'\n')
print(json.dumps({'testFiles':len(changes),'inverseExact':True}))
