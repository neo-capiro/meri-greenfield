"""Explicit reversible registry expectations; original behavior controls remain."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
packet=Path(__file__).resolve().parent
base='cff71e1ba8ca8dea8970ad0c778b580a73f84815'
ids=['search_public_web','scrape_web_page','search_sam_opportunities','get_florida_budget_project']
prior=json.loads((packet.parent/'civic-integration/test-expectation-updates.json').read_text())
paths=[x['path'] for x in prior['changes']]+['packages/contracts/test/retrieval-civic-integration-independent.test.mjs']
changes=[]
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
    if path.endswith('retrieval-civic-integration-independent.test.mjs'):
        edit("const ids=['get_state_bill_status'",'const observedIds='+json.dumps(ids)+";\nconst ids=['get_state_bill_status'",True)
        edit('!ids.includes(d.operation.id)','!ids.includes(d.operation.id)&&!observedIds.includes(d.operation.id)',True)
        edit('!ids.includes(x.id)','!ids.includes(x.id)&&!observedIds.includes(x.id)',True)
        edit('ids.includes(old.id)?','(ids.includes(old.id)||observedIds.includes(old.id))?',True)
    else:
        edit('"query_intelligence"','"query_intelligence", '+', '.join(json.dumps(x) for x in ids))
    for space in ['', ' ']:
        for before,after in [(34,30),(62,66),(63,67)]:
            edit('.length,'+space+str(before)+')','.length,'+space+str(after)+')')
        edit('.size,'+space+'63)','.size,'+space+'67)')
    edit("'0.2.8'","'0.2.9'")
    edit('all 63','all 67');edit('all63','all67')
    if path.endswith('retrieval-read-continuation-independent.test.mjs'):
        edit("['get_research_evidence','search_sam_opportunities']","['get_research_evidence']",True)
        edit("['get_state_bill_status','search_state_floor_votes']){const d=resolve(id).descriptor;","['get_state_bill_status','search_state_floor_votes','search_sam_opportunities']){const d=resolve(id).descriptor;",True)
    assert edits,path
    inverse=text
    for e in reversed(edits):
        assert inverse.count(e['new'])==e['count'],(path,e)
        inverse=inverse.replace(e['new'],e['old'])
    assert inverse.encode()==original,path
    target.write_text(text)
    changes.append({'path':path,'beforeSha256':hashlib.sha256(original).hexdigest(),'afterSha256':hashlib.sha256(text.encode()).hexdigest(),'replacements':edits,'inverseExact':True,'change':'Explicit four-ID mapping allowlist and canonical count/version expectations; prior behavioral controls retained. SAM pending-resolution refusal becomes exact-version/unavailable/null-handler positive assertion; research refusal preserved.'})
(packet/'test-expectation-updates.json').write_text(json.dumps({'base':base,'explicitNewOperationIds':ids,'changes':changes},indent=2)+'\n')
print(json.dumps({'testFiles':len(changes),'inverseExact':True}))
