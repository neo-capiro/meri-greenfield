"""Independent local synthetic-filesystem controls; no binaries or images."""
from pathlib import Path
from contextlib import redirect_stdout
from unittest.mock import patch
import hashlib,importlib.util,io,json,os,sys,tempfile
probe=Path(sys.argv[1]);result=Path(sys.argv[2])
spec=importlib.util.spec_from_file_location('review_inventory',probe);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
facts=[]
def check(label,condition,detail=None):
 facts.append({'check':label,'passed':bool(condition),'detail':detail})
 if not condition:raise AssertionError(label)
def capture(root):
 out=root/'inventory-result.json';args=m.parse_args(['--root',str(root),'--out',str(out)])
 manifest,code=m._inventory(args,platform='linux',required_roots=[str(root)],pins={},aliases={},output_path=str(out))
 with redirect_stdout(io.StringIO()):m.emit(manifest,str(out))
 return manifest,code
def by(man):return {x['path']:x for x in man['entries']}
with tempfile.TemporaryDirectory(prefix='meri-inventory-review-') as temp:
 root=Path(temp)/'root';root.mkdir();(root/'tiffcrop').write_bytes(b'one');out=root/'inventory-result.json'
 first,code=capture(root);check('baseline-first-complete',code==0 and first['coverage']['complete'])
 second,code=capture(root);old=by(first)[str(root)];new=by(second)[str(root)]
 check('baseline-output-creation-root-size-drift',old['size']!=new['size'],{'first':old,'second':new})
 # Output now exists before all accepted captures; records remain actual facts.
 stable,code=capture(root);check('preexisting-output-repeated-records-stable',code==0 and second['entries']==stable['entries'])
 check('root-size-not-redacted',by(stable)[str(root)]['size']==os.lstat(root).st_size)
 check('only-dedicated-output-excluded',str(out) not in by(stable) and str(root/'tiffcrop') in by(stable))
 (root/'tiffcrop').write_bytes(b'two');changed,code=capture(root)
 check('same-length-input-mutation-changes-hash',code==0 and by(changed)[str(root/'tiffcrop')]['sha256']==hashlib.sha256(b'two').hexdigest() and by(changed)[str(root/'tiffcrop')]['sha256']!=by(stable)[str(root/'tiffcrop')]['sha256'])
 (root/'extra').write_bytes(b'x');added,code=capture(root)
 check('extra-membership-visible',code==0 and str(root/'extra') in by(added) and len(added['entries'])==len(changed['entries'])+1)
 (root/'extra').unlink();removed,code=capture(root)
 check('removed-membership-visible',code==0 and str(root/'extra') not in by(removed) and len(removed['entries'])==len(changed['entries']))
 (root/'left').mkdir();(root/'right').mkdir();(root/'left'/'inside').write_bytes(b'x');link=root/'link';link.symlink_to(root/'left',target_is_directory=True)
 linked,code=capture(root);check('symlink-no-descent',code==0 and len([x for x in linked['entries'] if x['path'].endswith('/inside')])==1)
 link.unlink();link.symlink_to(root/'right',target_is_directory=True);swapped,code=capture(root)
 check('symlink-target-swap-visible',code==0 and by(linked)[str(link)]['target']!=by(swapped)[str(link)]['target'])
 actual_walk=m.os.walk
 def mutating_walk(path,**kwargs):
  for item in actual_walk(path,**kwargs):
   if item[0]==str(root):(root/'during-walk').write_bytes(b'changed')
   yield item
 with patch.object(m.os,'walk',side_effect=mutating_walk):raced,code=capture(root)
 check('real-directory-mutation-during-scan-fails-closed',code==1 and not raced['coverage']['complete'] and any('identity changed' in e['error'] for e in raced['errors']),raced['errors'])
 owned=temp
check('owned-fixture-removed',not Path(owned).exists())
result.write_text(json.dumps({'probe_sha256':hashlib.sha256(probe.read_bytes()).hexdigest(),'facts':facts,'no_image_native_network_or_provider':True},indent=2)+'\n')
print(json.dumps({'passed':sum(x['passed'] for x in facts),'total':len(facts)},indent=2))
