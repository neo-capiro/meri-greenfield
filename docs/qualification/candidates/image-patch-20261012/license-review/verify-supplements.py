from pathlib import Path
import hashlib,json,tarfile,re,sys
source=Path(sys.argv[1]); p=source/'docs/qualification/candidates/image-patch-20261012/licenses';out=Path(sys.argv[2]);checks=[]
def sha(v):return hashlib.sha256(v).hexdigest()
def check(k,v,detail=None):checks.append({'check':k,'passed':bool(v),'detail':detail})
arts=json.loads((p/'package-inspection.json').read_text())['artifacts']
up=json.loads((p/'upstream-documents.json').read_text());gap=json.loads((p/'gap-followup.json').read_text())
for doc in up:
 if 'retainedFile' not in doc:continue
 b=(p/doc['retainedFile']).read_bytes();check('supplement:'+doc['retainedFile'],len(b)==doc['bytes'] and sha(b)==doc['sha256'])
 if 'originalMemberSha256' in doc:
  with tarfile.open(arts['isarray@1.0.0']['archiveLocalPath']) as t: original=t.extractfile(doc['member']).read()
  check('isarray-source-member',sha(original)==doc['originalMemberSha256'])
  check('isarray-license-verbatim-section',original.endswith(b) and b'Permission is hereby granted' in b and b'Copyright' in b)
standard=arts['standardwebhooks@1.1.1'];meta=json.loads((p/standard['metadataFile']).read_text());githead=meta['gitHead'];g=gap[0]
check('standardwebhooks-exact-githead',githead in g['url'])
raw=Path('/tmp/meri-image-license-evidence-20261012/standardwebhooks-source.tgz').read_bytes();check('standardwebhooks-source-receipt',len(raw)==g['bytes'] and sha(raw)==g['sha256'])
with tarfile.open('/tmp/meri-image-license-evidence-20261012/standardwebhooks-source.tgz') as t:
 for n in g['notices']:
  b=t.extractfile(n['member']).read();check('standardwebhooks-notice:'+n['member'],sha(b)==n['sha256'] and len(b)==n['bytes'] and b==(p/n['retainedFile']).read_bytes())
 names=[x.name for x in t.getmembers()]
 manifest=next(x for x in names if x.endswith('/libraries/javascript/package.json'))
 data=json.loads(t.extractfile(manifest).read())
 check('standardwebhooks-subdirectory-manifest',data['name']=='standardwebhooks' and data['version']=='1.1.1' and data['license']=='MIT')
 library_license=t.extractfile(next(x for x in names if x.endswith('/libraries/LICENSE'))).read()
 root_license=t.extractfile(next(x for x in names if x.count('/')==1 and x.endswith('/LICENSE'))).read()
 check('standardwebhooks-license-scope',b'Permission is hereby granted' in library_license and b'Apache License' in root_license)
 sdk=arts['@anthropic-ai/claude-agent-sdk-linux-x64@0.3.295']
with tarfile.open(sdk['archiveLocalPath']) as t:
 member=t.getmember('package/claude'); f=t.extractfile(member); digest=hashlib.file_digest(f,'sha256').hexdigest()
pins=json.loads((source/'apps/worker/qualification/component-pins.json').read_text());bound=next(x for x in pins['npm'] if x['name']=='@anthropic-ai/claude-agent-sdk')['bundledCli']
check('sdk-binary-static-pin',member.size==bound['linuxX64BinarySize'] and digest==bound['linuxX64BinaryChecksum'])
result={'checks':checks,'failures':[x['check'] for x in checks if not x['passed']],'standardwebhooks':{'registry_gitHead':githead,'source_tarball_sha256':sha(raw),'source_manifest':manifest,'name':data['name'],'version':data['version'],'license':data['license'],'npm_reproducible_build_not_verified':True},'sdk_binary':{'bytes':member.size,'sha256':digest,'data_only':True},'upstream_failures_preserved':[{'url':d.get('url'),'error':d['error']} for d in up+gap if 'error' in d]}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));sys.exit(bool(result['failures']))
