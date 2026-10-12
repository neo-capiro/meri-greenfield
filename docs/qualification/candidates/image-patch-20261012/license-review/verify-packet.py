"""Read artifacts as data; no install, import of packages, network, or execution."""
from pathlib import Path
import base64, collections, hashlib, json, re, struct, sys, tarfile, zipfile

source=Path(sys.argv[1]); packet=source/'docs/qualification/candidates/image-patch-20261012/licenses'
output=Path(sys.argv[2]); failures=[]; checks=[]; artifact_rows=[]; archive_notices=[]
def check(label, condition, detail=None):
    checks.append({'check':label,'passed':bool(condition),'detail':detail})
    if not condition: failures.append(label)
def sha(data): return hashlib.sha256(data).hexdigest()
def integrity(data,value):
    algo,expected=value.split('-',1)
    return base64.b64encode(hashlib.new(algo,data).digest()).decode()==expected
def selected(meta):
    for key,target in [('os','linux'),('cpu','x64'),('libc','glibc')]:
        values=meta.get(key,[])
        if '!'+target in values: return False
        positives=[v for v in values if not v.startswith('!')]
        if positives and target not in positives and 'any' not in positives: return False
    return True
lock=json.loads((source/'apps/worker/qualification/package-lock.json').read_text())['packages']
inspection=json.loads((packet/'package-inspection.json').read_text()); artifacts=inspection['artifacts']
reported={v['path']:v for v in json.loads((packet/'lock-target-inventory.json').read_text())['locations']}
selected_registry={}; excluded=[]; local=[]; eligible_locations=0
for path,meta in lock.items():
    if not path: continue
    eligible=selected(meta)
    check('target:'+path,reported.get(path,{}).get('targetEligible')==eligible)
    if not eligible: excluded.append(path);continue
    eligible_locations+=1
    name=path.rsplit('node_modules/',1)[-1]; key=name+'@'+meta['version']
    if meta['resolved'].startswith('file:'):
        data=(source/'apps/worker/qualification'/meta['resolved'][5:]).read_bytes()
        check('local-integrity:'+key,integrity(data,meta['integrity']))
        local.append({'name':key,'bytes':len(data),'sha256':sha(data)})
    else:
        selected_registry[key]=meta
        check('lock-metadata:'+key,key in artifacts and all(artifacts[key].get(k)==meta.get(v) for k,v in [('version','version'),('url','resolved'),('integrity','integrity')]))
check('npm-exact-set',set(selected_registry)=={k for k,v in artifacts.items() if v['kind']=='npm'})
req={m[0]:(m[1],m[2]) for m in re.findall(r'^([^#\s=]+)==([^\s]+) --hash=sha256:([a-f0-9]{64})$',(source/'apps/worker/qualification/requirements.lock.txt').read_text(),re.M)}
check('wheel-exact-set',{n+'@'+v for n,(v,h) in req.items()}=={k for k,v in artifacts.items() if v['kind']=='wheel'})
notice_records=0; copied=0; hash_only=0; dirs=[]; missed=[]; compressed=0
notice_pattern=re.compile(r'(license|licence|copying|notice|copyright|third.?party)',re.I)
for key,item in artifacts.items():
    raw=Path(item['archiveLocalPath']).read_bytes(); compressed+=len(raw)
    check('archive-receipt:'+key,len(raw)==item['archiveReceipt']['bytes'] and sha(raw)==item['archiveReceipt']['sha256'])
    if item['kind']=='npm': check('archive-integrity:'+key,integrity(raw,selected_registry[key]['integrity']))
    else: check('wheel-integrity:'+key,sha(raw)==req[item['name']][1]==item['expectedSha256'])
    metadata=(packet/item['metadataFile']).read_bytes()
    check('metadata-receipt:'+key,sha(metadata)==item['metadataReceipt']['sha256'] and len(metadata)==item['metadataReceipt']['bytes'])
    if item['kind']=='npm':
        arc=tarfile.open(item['archiveLocalPath'],'r:gz'); members=arc.getmembers(); byname={m.name:m for m in members}
        def isdir(n): return byname[n].isdir()
        def read(n): return arc.extractfile(byname[n]).read()
        regular=[m.name for m in members if m.isfile()]
    else:
        arc=zipfile.ZipFile(item['archiveLocalPath']); members=arc.infolist(); byname={m.filename:m for m in members}
        def isdir(n): return byname[n].is_dir()
        def read(n): return arc.read(n)
        regular=[m.filename for m in members if not m.is_dir()]
    check('member-count:'+key,len(members)==item['memberCount'])
    listed={n['member'] for n in item['notices']}
    for name in regular:
        if notice_pattern.search(Path(name).name) and name not in listed:
            missed.append({'artifact':key,'member':name})
    for n in item['notices']:
        if isdir(n['member']):
            dirs.append({'artifact':key,'member':n['member']});check('directory-placeholder:'+key,n['bytes']==0);continue
        body=read(n['member']);notice_records+=1
        check('notice-member:'+key+':'+n['member'],sha(body)==n['sha256'] and len(body)==n['bytes'])
        if 'retainedFile' in n:
            copied+=1;check('notice-copy:'+key+':'+n['member'],(packet/n['retainedFile']).read_bytes()==body)
        else:
            hash_only+=1;check('commercial-hash-boundary:'+key,key.startswith('@anthropic-ai/claude-agent-sdk') and n.get('retention')=='HASH_ONLY_COMMERCIAL_COMPONENT_NO_APPROVAL')
    artifact_rows.append({'artifact':key,'bytes':len(raw),'sha256':sha(raw),'members':len(members),'notice_files':len(item['notices'])-sum(isdir(n['member']) for n in item['notices'])})
    arc.close()
check('compressed-byte-total',compressed==inspection['compressedBytes'])
# A broad filename scan is only a completeness signal; classify any misses manually.
# ELF64 DT_NEEDED is decoded without loading or executing native modules.
def needed(raw):
    assert raw[:6]==b'\x7fELF\x02\x01'
    phoff=struct.unpack_from('<Q',raw,32)[0]; phsize,phnum=struct.unpack_from('<HH',raw,54)
    loads=[]; dynamic=None
    for i in range(phnum):
        typ,flags,off,vaddr,paddr,filesz,memsz,align=struct.unpack_from('<IIQQQQQQ',raw,phoff+i*phsize)
        if typ==1: loads.append((off,vaddr,filesz))
        if typ==2: dynamic=(off,filesz)
    entries=[struct.unpack_from('<qQ',raw,o) for o in range(dynamic[0],sum(dynamic),16)]
    strings=next(v for t,v in entries if t==5)
    base=next(off+strings-va for off,va,sz in loads if va<=strings<va+sz)
    result=[]
    for t,v in entries:
        if t==1:
            start=base+v;end=raw.index(b'\0',start);result.append(raw[start:end].decode())
    return result
native=[]
for obs in json.loads((packet/'native-static-observations.json').read_text())['members']:
    item=artifacts[obs['artifact']]
    if item['kind']=='wheel':
        with zipfile.ZipFile(item['archiveLocalPath']) as z:raw=z.read(obs['member'])
    else:
        with tarfile.open(item['archiveLocalPath']) as t:raw=t.extractfile(obs['member']).read()
    check('native-member:'+obs['member'],sha(raw)==obs['sha256'] and len(raw)==obs['bytes'])
    result={'artifact':obs['artifact'],'member':obs['member'],'sha256':sha(raw)}
    if 'needed' in obs:
        result['independent_DT_NEEDED']=needed(raw)
        check('ELF-needed:'+obs['member'],result['independent_DT_NEEDED']==obs['needed'])
        if 'etree.' in obs['member']:
            result['static_markers']={s.decode():s in raw for s in [b'xmlCheckVersion',b'xsltApplyStylesheet',b'2.14.6',b'1.1.43']}
    else:
        result['version_defines']=[line.strip() for line in raw.decode().splitlines() if line.lstrip().startswith('#define') and re.search(r'(LIBXML|LIBXSLT|LIBEXSLT)_(DOTTED_VERSION|VERSION|TEST_VERSION)',line)]
        check('header-defines:'+obs['member'],set(obs['versionDefines'])<=set(result['version_defines']))
    native.append(result)
summary={'source_root':str(source),'checks':checks,'failures':failures,'counts':{'lock_locations':len(lock)-1,'eligible_locations':eligible_locations,'excluded_locations':len(excluded),'selected_unique_registry_npm':len(selected_registry),'local_vendor':len(local),'wheels':len(req),'package_artifacts':len(artifacts),'compressed_bytes':compressed,'notice_file_records':notice_records,'retained_package_notice_files':copied,'commercial_hash_only':hash_only,'directory_placeholders':len(dirs)},'local_vendor':local,'excluded':excluded,'directory_placeholders':dirs,'unlisted_notice_like_files':missed,'artifacts':artifact_rows,'native':native,'no_download_install_or_package_execution':True}
output.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'counts':summary['counts'],'checks':len(checks),'failures':failures,'unlisted_notice_like_files':missed},indent=2))
sys.exit(bool(failures))
