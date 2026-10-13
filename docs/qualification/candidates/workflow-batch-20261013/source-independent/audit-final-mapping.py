"""Exact narrow delta proof; detailed output separate from process capture."""
import gzip,hashlib,json,pathlib,re,subprocess
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[4]
SOURCE='9d1bf92a08ea07ad49d63e80ade8249598060635';PARENT='d34a47b07c27ac5c55e9c4281991ae1657c1a723'
UNICODE='516eb2a922c106745d0164bd9819a6bec2c104cc';PUBLIC='1c79a912b6589ccd1004c12a9981bc146d79e8bc'
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def blob(commit,path):return git('show',commit+':'+path)
def check(name,condition,**detail):
 assert condition,name;checks.append({'name':name,'pass':True,**detail})
def entries(commit):
 result={}
 for raw in git('ls-tree','-rz',commit).split(b'\0'):
  if not raw:continue
  meta,path=raw.split(b'\t',1);result[path.decode()]=meta.decode()
 return result
check('Exact source/tree/parent',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='c9a6ed124ba143e8ab0c772939609a6313cc9a07' and git('rev-parse',SOURCE+'^').decode().strip()==PARENT)
old,new=entries(PARENT),entries(SOURCE);changed=[p for p in old if old[p]!=new.get(p)]
added=sorted(set(new)-set(old));memory='apps/gateway/test/memory-context-independent.test.mjs';runner='apps/gateway/test/mail-continuation-regression.test.mjs'
check('Only existing-file change is exact memory test',changed==[memory],changed=changed)
check('Only new executable is current mail test',all(p==runner or p.startswith('docs/qualification/candidates/workflow-batch-20261013/root/') for p in added),added=added)
check('Every other retained parent entry exact',all(new.get(p)==value for p,value in old.items() if p!=memory),exactEntries=len(old)-1)
actual=blob(SOURCE,memory).decode();before=blob(PARENT,memory).decode()
addition=",['search_memory','bound-projection/1'],['read_monday_client_boards','bound-projection/1'],['get_client_context','bound-projection/1'],['find_contacts','bound-projection/1'],['resolve_entity','bound-projection/1'],['read_client_documents','client-documents/1']"
check('Memory repair contains six literal profiles once',actual.count(addition)==1)
check('Entire memory test otherwise exact',actual.replace(addition,'',1)==before)
for text in ["assert.equal(catalog.operations.length,97)","assert.equal(catalog.originals.length,139)","for(const row of catalog.operations)","assert.equal(row.availability,'unimplemented')","assert.equal(row.qualification,'pending')","assert.equal(row.handler,null)","assert.equal(view.entry(row.operation),null)","/UNAVAILABLE/","assert.equal(gateway.sourceEnabled,false)","assert.deepEqual(await gateway.discover(),[])","assert.deepEqual(f.events,[])"]:
 check('Retained catalog assertion: '+text,text in actual and text in before)
history='docs/qualification/candidates/next-adapters-20261013/mail-independent/independent.test.mjs'
legacy=blob(SOURCE,history);mappingPath='docs/qualification/candidates/workflow-batch-20261013/root/legacy-mail-control-mapping.json';mapping=json.loads(blob(SOURCE,mappingPath))
check('Historical mail test is exact immutable PR61 preimage',legacy==blob(PUBLIC,history)==blob(PARENT,history),sha256=hashlib.sha256(legacy).hexdigest())
check('Recorded historical hash matches actual bytes',hashlib.sha256(legacy).hexdigest()==mapping['historicalSha256'])
current=blob(SOURCE,runner).decode();oldControl=mapping['originalControl'];newControl=mapping['currentControl'];helper="const {createMailBodySection}=await module('packages/contracts/retrieval-0.2/mail-utf16.mjs');\n"
check('Exactly one mapped Unicode block plus helper import',current.count(newControl)==1 and current.count(helper)==1 and legacy.decode().count(oldControl)==1)
restored=current.replace(helper,'',1).replace(newControl,oldControl,1)
check('All remaining fixture and 20 controls are byte exact',restored.encode()==legacy,reconstructedSha256=hashlib.sha256(restored.encode()).hexdigest())
check('Mapped Unicode assertions keep refusal, positions, hash, version, cursor and unverified status',all(t in newControl for t in ["await assert.rejects(execute(f,{},f.call(args)),/INVALID_RESULT/)","bodyOffset:start+1","assert.equal(row.section.text,'😀')","assert.equal(row.section.start,start)","assert.equal(row.section.endExclusive,bodyText.length)","assert.equal(row.section.hasMore,false)","assert.deepEqual(value.nextBodyOffsets,[])","assert.equal(value.evidenceReady,false)","assert.equal(row.contentSha256,f.page().messages[0].contentSha256)","assert.equal(row.recordVersionId,f.page().messages[0].recordVersionId)"]))
for prefix in ['packages/contracts/public-0.1.2/','packages/contracts/public-0.1.3/','packages/contracts/dist/','skills/','infra/','apps/worker/']:
 baseline=entries(PUBLIC);paths={p:v for p,v in baseline.items() if p.startswith(prefix)}
 # Some named public versions do not exist; actual public owner is separately checked below.
 if paths:check('Public/skill/native prefix exact PR61: '+prefix,all(new.get(p)==v for p,v in paths.items()),entries=len(paths))
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/normalize-mail.mjs']:
 if path in entries(PUBLIC):check('Protected PR61 file exact: '+path,new.get(path)==entries(PUBLIC)[path])
for path in ['packages/contracts/retrieval-0.2/mail-utf16.mjs','packages/contracts/retrieval-0.2/mail-validation.mjs','packages/contracts/test/retrieval-mail-unicode.test.mjs','packages/contracts/test/retrieval-mail.test.mjs','packages/contracts/test/backend-execution-expectations.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs']:
 check('Previously reviewed source exact Unicode checkpoint: '+path,blob(SOURCE,path)==blob(UNICODE,path),sha256=hashlib.sha256(blob(SOURCE,path)).hexdigest())
for path,value in entries(PUBLIC).items():
 if '/schemas/' in path or path.endswith('.schema.json'):assert new.get(path)==value,path
check('Every original schema exact PR61',True)
root='docs/qualification/candidates/workflow-batch-20261013/root/'
for label,counts in [('integration-final',{'tests':1256,'pass':1254,'fail':2}),('integration-deltas-corrected',{'tests':75,'pass':75,'fail':0})]:
 record=json.loads(blob(SOURCE,root+label+'.json'))
 check('Retained parent capture counts '+label,all(record['counts'][k]==v for k,v in counts.items()),counts=record['counts'],recordedCommit=record['commit'],precommitCandidateMetadata=label=='integration-deltas-corrected')
 for stream in ['stdout','stderr']:
  raw=gzip.decompress(blob(SOURCE,root+label+'.'+stream+'.gz'));saved=record['blobs'][stream]
  check('Retained parent capture raw hash '+label+' '+stream,len(raw)==saved['rawBytes'] and hashlib.sha256(raw).hexdigest()==saved['rawSha256'])
 if label=='integration-final':
  text=raw if stream=='stdout' else gzip.decompress(blob(SOURCE,root+label+'.stdout.gz'))
  names=re.findall(rb'^not ok \d+ - (.+)$',text,re.M)
  check('Initial failure names exactly metadata inventory and old split control',len(names)==2 and any(b'canonical mail and memory profiles' in n for n in names) and any(b'UTF16 one-unit sections may split' in n for n in names),failedNames=[n.decode() for n in names])
check('Reviewer checkout has no executable or public diff from exact pin',not git('diff','--name-only',SOURCE,'HEAD','--','apps','packages','skills','infra').strip())
check('Earlier source review evidence unchanged',all(new.get(p)==v for p,v in entries(UNICODE).items() if '/source-independent/' in p))
output={'decision':'ACCEPT_SOURCE','sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'parent':PARENT,'checks':checks,'passedAssertions':len(checks),'testOnlyDelta':True,'historicalAssertionsPreserved':True,'fullNativeOrArtifactAcceptance':False,'scopeNote':'Mapped glyph block does not itself compare scopes/input digest; immutable other controls and independent Unicode gateway controls cover those bindings.'}
out=HERE/'final-mapping-preservation-details.json';assert not out.exists();out.write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'decision':output['decision'],'passedAssertions':len(checks),'detailFile':str(out),'exactParentEntries':len(old)-1}))
