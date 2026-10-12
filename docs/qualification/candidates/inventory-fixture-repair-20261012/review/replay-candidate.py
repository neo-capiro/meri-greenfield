from pathlib import Path
from datetime import datetime,timezone
import hashlib,importlib.util,json,subprocess,tempfile,time,sys
root=Path('/workspace/meri-inventory-fixture-repair-20261012');out=Path(__file__).resolve().parent
base='690bac4cd44112b161d8e02818aeae7639ce237a';candidate='0ea9b778c983108f664455e7fc4e195a0a33148a';test='apps/worker/qualification/probes/image-inventory.test.mjs';probe='apps/worker/qualification/probes/image-inventory.py'
def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
def sha(raw):return hashlib.sha256(raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==candidate and not git('status','--porcelain')
original=git('show',base+':'+test);new=(root/test).read_bytes();production=(root/probe).read_bytes();assert production==git('show',base+':'+probe)
setup=b"  // Finish fixture membership before comparing full directory metadata.\n  // The result is excluded, but creating its directory entry changes the root.\n  write(dir, 'inventory-result.json', '{}');\n"
assert new.count(setup)==1 and new.replace(setup,b'',1).startswith(original)
assert new[:new.index(b"test('directory sizes remain captured")].replace(setup,b'',1).rstrip()==original.rstrip()
changes=git('diff','--name-status',base,candidate).decode().splitlines();modified=[x.split('\t')[1] for x in changes if x.startswith('M\t')];assert modified==[test]
records=[]
def run(label,args,cwd=root,expected=0):
 start=time.monotonic();r=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=60)
 (out/(label+'.stdout.txt')).write_text(r.stdout);(out/(label+'.stderr.txt')).write_text(r.stderr)
 row={'label':label,'argv':args,'cwd':str(cwd),'exit_code':r.returncode,'expected_exit':expected,'duration_seconds':round(time.monotonic()-start,3)};records.append(row)
 assert r.returncode==expected,(row,r.stdout[-3000:],r.stderr[-3000:]);return r
run('candidate-original-and-appended',['node','--test',test])
run('candidate-context-suite',['python3','-B','-m','unittest','discover','-s','scripts/qualification','-p','worker_context_test.py','-v'])
run('candidate-independent-mutations',['python3','-B',str(out/'mutation-controls.py'),str(root/probe),str(out/'candidate-mutation-controls.json')])
run('candidate-stale-context-guard',['python3','-B','-m','unittest','test_worker_image_build.Controls.test_context_manifest_pin_tracks_candidate_bytes'],root/'scripts/qualification',expected=1)
with tempfile.TemporaryDirectory(prefix='meri-inventory-review-mutant-') as temp:
 d=Path(temp);(d/'image-inventory.test.mjs').write_bytes(new)
 needle=b'return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid, st.st_size,'
 assert production.count(needle)==1
 mutant=production.replace(needle,b'return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid, 0,',1)
 (d/'image-inventory.py').write_bytes(mutant)
 run('candidate-size-blind-mutant',['node','--test','--test-name-pattern=directory sizes remain captured',str(d/'image-inventory.test.mjs')],expected=1)
 mutant_receipt={'production_sha256':sha(production),'mutant_sha256':sha(mutant),'mutation':'Only st_size is replaced with0 in _identity, in an isolated temporary copy.','test_bytes_match_candidate':True,'temp_removed_after':temp}
assert not Path(mutant_receipt['temp_removed_after']).exists();mutant_receipt['temporary_copy_removed']=True
spec=importlib.util.spec_from_file_location('review_context',root/'scripts/qualification/worker_context.py');context=importlib.util.module_from_spec(spec);spec.loader.exec_module(context)
rows=[]
for source,target in context.MEMBERS:
 b=(root/source).read_bytes();rows.append({'sourcePath':source,'contextPath':target,'bytes':len(b),'sha256':sha(b)})
manifest={'schemaVersion':1,'status':'SOURCE_ONLY','commitAuthority':False,'members':rows,'totalBytes':sum(x['bytes'] for x in rows)};raw=context._json_bytes(manifest)
(out/'candidate-context.manifest.json').write_bytes(raw)
assert not git('status','--porcelain')
receipt={'candidate_commit':candidate,'candidate_tree':git('rev-parse',candidate+'^{tree}').decode().strip(),'base':base,'reviewed_at_utc':datetime.now(timezone.utc).isoformat(),'existing_modified_paths':modified,'original_test_exact_prefix_after_removing_setup':True,'original_tests':25,'candidate_tests':26,'test':{'bytes':len(new),'sha256':sha(new)},'production_probe':{'bytes':len(production),'sha256':sha(production),'unchanged':True},'context':{'members':len(rows),'bytes':manifest['totalBytes'],'manifest_bytes':len(raw),'manifest_sha256':sha(raw),'assembler_sha256':sha((root/'scripts/qualification/worker_context.py').read_bytes())},'checks':records,'size_blind_mutant':mutant_receipt,'author_worktree_clean':True,'no_image_native_cloud_provider_calls':True}
(out/'candidate-replay.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
