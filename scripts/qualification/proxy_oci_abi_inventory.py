"""Fixed23-layer Linux amd64 ABI/notice DATA profile, offline and never admitted.

--manifest FILE --config FILE --blobs DIRECTORY --output NEW_DIRECTORY
Exit0 inert DATA retained (inspect HOLD); exit2 bounded refusal. No native execution.
"""
import argparse
import hashlib
import importlib
import json
import pathlib
import shutil
import sys
import tarfile
import time
import zlib

PINS = {'oci_layer_overlay.py':'835082c6e70bb983f53c9d20227f804c6c930ef8eeb88b6ce8ea99d131abb86c', 'elf_inventory.py':'959d60f5e363763d7d48b586cbebb2f37cdfdb9f342b7a749ae4cbd9668be73d',
        'proxy_oci_inventory.py':'ce6031a05b608b27eef56f4894bd797be362de3742988af9e71328421388264c'}
PROFILE = 'meri-proxy-linux-amd64-node-prisma-abi/3'
ENGINE = 'opt/prisma/.cache/prisma/master/ac9d7041ed77bcc8a8dbd2ab6616b39013829574/debian-openssl-3.0.x/'
CLI = 'opt/prisma/binaries/node_modules/'
LIBRARY_NAMES = ('ld-linux-x86-64.so.2','libc.so.6','libm.so.6','libpthread.so.0',
                 'libdl.so.2','librt.so.1','libresolv.so.2','libutil.so.1','libgcc_s.so.1',
                 'libstdc++.so.6','libssl.so.3','libcrypto.so.3','libz.so.1','libzstd.so.1',
                 'libbrotlidec.so.1','libbrotlicommon.so.1','libcares.so.2','libnghttp2.so.14','libuv.so.1',
                 'libbrotlienc.so.1','libcrypto.so.4','libssl.so.4','libicui18n.so.78','libicuuc.so.78')
LIBRARY_ROOTS = ('lib','lib64','usr/lib','usr/lib64')
LITERAL_LIBRARY_TARGETS = ('libz.so.1.3.2.1-motley',)
NOTICE_PACKAGES = ('glibc','libgcc','libstdc++','nodejs','nodejs-18','nodejs-20','nodejs-22',
                   'nodejs-24','openssl','openssl-provider-default','zlib','zstd','brotli','c-ares','nghttp2','libuv')
REQUIRED = ('usr/bin/node','app/schema.prisma','app/.venv/lib/python3.13/site-packages/prisma/client.py',
            CLI+'prisma/build/index.js',CLI+'prisma/package.json',CLI+'prisma/LICENSE',
            CLI+'@prisma/engines/query-engine-debian-openssl-3.0.x',
            CLI+'@prisma/engines/schema-engine-debian-openssl-3.0.x',CLI+'@prisma/engines/LICENSE')


def selected(name):
    if name in LIBRARY_ROOTS:
        return True  # Preserve actually observed alias/directory metadata.
    if name in REQUIRED or name in ('etc/os-release','usr/lib/os-release','lib/apk/db/installed','var/lib/apk/db/installed','usr/bin/nodejs'):
        return True
    if name.startswith(('app/.venv/lib/python3.13/site-packages/prisma/',
                        'app/.venv/lib/python3.13/site-packages/prisma-0.11.0.dist-info/',
                        CLI+'prisma/build/',CLI+'prisma/prisma-client/',ENGINE)):
        return True
    if name in (CLI+'@prisma/engines/package.json',CLI+'prisma/prisma-client/package.json','opt/prisma/binaries/package.json'):
        return True
    if any(name.startswith('usr/share/licenses/'+p+'/') for p in NOTICE_PACKAGES):
        return True
    parent,_,base=name.rpartition('/')
    if parent in LIBRARY_ROOTS:
        return base in LITERAL_LIBRARY_TARGETS or any(base==n or (base.startswith(n+'.') and len(base)-len(n)<=32 and all(c in '.0123456789' for c in base[len(n):])) for n in LIBRARY_NAMES)
    return False


def sources():
    directory=pathlib.Path(__file__).resolve().parent
    rows={}
    for name in (*PINS,pathlib.Path(__file__).name):
        raw=(directory/name).read_bytes();digest=hashlib.sha256(raw).hexdigest()
        if name in PINS and digest!=PINS[name]:raise ValueError('ABI dependency source drift')
        rows[name]={'bytes':len(raw),'sha256':digest}
    return rows


def dependencies():
    before=sources();directory=pathlib.Path(__file__).resolve().parent
    sys.path.insert(0,str(directory))
    modules=[importlib.import_module(n) for n in ('proxy_oci_inventory','oci_layer_overlay','elf_inventory')]
    for m in modules:
        if pathlib.Path(m.__file__).resolve()!=directory/(m.__name__+'.py'):raise ValueError('foreign ABI module')
    if sources()!=before:raise ValueError('ABI import source drift')
    return (*modules,before)


def analyze(overlay, elf):
    rows=[{'path':p,**r} for p,r in sorted(overlay.entries.items()) if selected(p)]
    holds=[];elfs=[];links=[];packages=[]
    for path in REQUIRED:
        row=overlay.entries.get(path)
        if row is None or row['kind']!='file' or 'sha256' not in row:
            holds.append({'path':path,'reason':'REQUIRED_REGULAR_BYTES_MISSING'})
    for row in rows:
        overlay.check_time()
        path=row['path']
        if row['kind'] in ('symlink','hardlink'):
            value=elf.resolve_virtual(path,overlay.entries)
            links.append({'path':path,'kind':row['kind'],'target':row['target'],
                          'resolvedTarget':value.get('path'),**{k:v for k,v in value.items() if k!='path'}})
            # Even a lexical target is inert DATA, not dynamic-loader/host-link proof.
            # Library-root aliases resolve directories, not executable file bytes.
            if path not in LIBRARY_ROOTS and (value['status']!='REGULAR_VIRTUAL_TARGET' or 'sha256' not in overlay.entries[value.get('path','')]):
                holds.append({'path':path,'reason':'LINK_TARGET_BYTES_UNESTABLISHED'})
        if row['kind']!='file' or 'sha256' not in row:continue
        raw=overlay.objects[row['sha256']]
        if path in ('usr/bin/node',CLI+'@prisma/engines/query-engine-debian-openssl-3.0.x',CLI+'@prisma/engines/schema-engine-debian-openssl-3.0.x') and not raw.startswith(b'\x7fELF'):
            holds.append({'path':path,'reason':'REQUIRED_NATIVE_ELF_BYTES_MISSING'})
        if raw.startswith(b'\x7fELF'):
            try:info=elf.inspect_elf(raw)
            except elf.ElfRefusal as exc:
                holds.append({'path':path,'reason':'ELF_REFUSED','detail':str(exc)});continue
            edges=[]
            names=info['needed']+([info['interpreter'].lstrip('/')] if info['interpreter'] else [])
            for need in names:
                candidates=[need] if '/' in need else [root+'/'+need for root in LIBRARY_ROOTS]
                matches=[]
                for candidate in candidates:
                    target=elf.resolve_virtual(candidate,overlay.entries)
                    if target['status']=='REGULAR_VIRTUAL_TARGET':
                        record=overlay.entries[target['path']]
                        if 'sha256' in record:
                            is_elf=overlay.objects[record['sha256']].startswith(b'\x7fELF')
                            matches.append({'requested':candidate,'regularTarget':target['path'],'sha256':record['sha256'],'hasElfMagic':is_elf})
                            if not is_elf:holds.append({'path':target['path'],'reason':'DEPENDENCY_CANDIDATE_NOT_ELF'})
                edges.append({'needed':need,'regularCandidates':matches})
                if not matches:holds.append({'path':path,'reason':'DEPENDENCY_BYTES_MISSING','dependency':need})
            if info['rpath'] or info['runpath']:holds.append({'path':path,'reason':'DYNAMIC_SEARCH_PATH_REQUIRES_REVIEW'})
            elfs.append({'path':path,**info,'dependencyCandidates':edges})
        if path in ('lib/apk/db/installed','var/lib/apk/db/installed'):
            if len(raw)>2*1024**2:raise ValueError('APK metadata limit')
            text=raw.decode('utf-8');blocks=text.split('\n\n')
            if len(blocks)>20000:raise ValueError('APK package count')
            for block in blocks:
                fields={}
                for line in block.splitlines():
                    if line[:2] in ('P:','V:','L:'):
                        key=line[0]
                        if key in fields:raise ValueError('duplicate APK identity field')
                        fields[key]=line[2:]
                if fields:packages.append(fields)
    if not packages:holds.append({'path':'APK_DATABASE','reason':'PACKAGE_IDENTITY_AND_LICENSE_MAPPING_MISSING'})
    holds.append({'path':'PROFILE','reason':'NATIVE_LOADER_AND_COMPLETE_PACKAGE_NOTICE_VERIFICATION_UNQUALIFIED'})
    return {'schema':'meri-proxy-oci-abi-data/1','profile':PROFILE,'status':'HOLD','selected':rows,
            'elf':elfs,'links':links,'apkPackageMetadata':packages,'holds':holds,
            'originalFirstStageHoldCleared':False,'nativeExecution':False,'runtimeAdmitted':False,
            'libraryCandidatesAreLoaderProof':False,'enterprisePaths':[p for p in sorted(overlay.entries) if p=='app/enterprise' or p.startswith('app/enterprise/')],
            'profileDefinition':{'requiredRegular':list(REQUIRED),'libraryRoots':list(LIBRARY_ROOTS),'libraryNames':list(LIBRARY_NAMES),'literalLibraryTargets':list(LITERAL_LIBRARY_TARGETS),'noticePackages':list(NOTICE_PACKAGES)}}


def inventory(manifest,config,blob_dir,new_output):
    io,layer,elf,before=dependencies();deadline=time.monotonic()+1200
    output=pathlib.Path(new_output).absolute()
    if output.exists() or output.is_symlink() or not output.parent.is_dir():raise ValueError('fresh ABI output required')
    for p in [output.parent,*output.parent.parents]:
        if p.is_symlink() or getattr(p.lstat(),'st_file_attributes',0)&0x400:raise ValueError('output ancestor link')
    if shutil.disk_usage(output.parent).free<2*1024**3:raise ValueError('free disk floor')
    mr,mrec=io.pinned_read(manifest,io.MANIFEST,io.META_CAP,deadline);cr,crec=io.pinned_read(config,io.CONFIG,io.META_CAP,deadline)
    m,c=io.parse(mr),io.parse(cr);rows=m['layers']
    if (m['schemaVersion']!=2 or len(rows)!=23 or m['config']['digest']!='sha256:'+io.CONFIG or m['config']['size']!=len(cr) or c['os']!='linux' or c['architecture']!='amd64' or c['rootfs']['type']!='layers' or len(c['rootfs']['diff_ids'])!=23 or c['config']['Labels']['org.opencontainers.image.revision']!='fc3920bf403124ad075bc04990f999f7e0612e12' or sum(r['size'] for r in rows)!=io.COMPRESSED):raise ValueError('fixed ABI image binding')
    paths=[];records=[]
    for row in rows:
        if row['mediaType']!='application/vnd.oci.image.layer.v1.tar+gzip':raise ValueError('fixed gzip layer required')
        digest=row['digest'].removeprefix('sha256:');path=pathlib.Path(blob_dir)/(digest+'.blob')
        _,record=io.pinned_read(path,digest,row['size'],deadline)
        if record['bytes']!=row['size']:raise ValueError('descriptor byte mismatch')
        paths.append(path);records.append(record)
    overlay=layer.Overlay(layer.Limits(),deadline,selection=selected)
    for i,(path,row,record) in enumerate(zip(paths,rows,records),1):
        handle,st=io.open_regular(path)
        try:
            import os
            fd=os.fstat(handle.fileno());overlay.add_layer(handle,c['rootfs']['diff_ids'][i-1],i)
            if io.within_api(fd)!=io.within_api(os.fstat(handle.fileno())) or io.within_api(st)!=io.within_api(path.lstat()):raise ValueError('layer scan drift')
        finally:handle.close()
        if io.pinned_read(path,record['sha256'],row['size'],deadline)[1]!=record:raise ValueError('post layer hash drift')
    io.pinned_read(manifest,io.MANIFEST,io.META_CAP,deadline);io.pinned_read(config,io.CONFIG,io.META_CAP,deadline)
    result=analyze(overlay,elf);overlay.check_time()
    if sources()!=before:raise ValueError('ABI source post drift')
    result.update(manifest=mrec,config=crec,compressedLayers=records,layers=overlay.layers,expandedBytes=overlay.expanded,limits=dict(overlay.limits.__dict__),sources=before,sourceRevision='fc3920bf403124ad075bc04990f999f7e0612e12',trustedFilesystemLimit='No hostile filesystem/atomic snapshot guarantee')
    output.mkdir(exist_ok=False);objects=output/'objects';objects.mkdir()
    for digest in sorted({r['sha256'] for r in result['selected'] if 'sha256' in r}):
        overlay.check_time()
        with (objects/digest).open('xb') as f:f.write(overlay.objects[digest])
    with (output/'abi-inventory.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(result,f,indent=2);f.write('\n')
    return result


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('manifest','config','blobs','output'):parser.add_argument('--'+name,required=True)
    args=parser.parse_args(argv)
    try:result=inventory(args.manifest,args.config,args.blobs,args.output)
    except (ValueError,OSError,KeyError,TypeError,EOFError,tarfile.TarError,zlib.error):
        print('REFUSED offline ABI DATA',file=sys.stderr);return 2
    print(json.dumps({'status':result['status'],'profile':PROFILE,'selected':len(result['selected']),'runtimeAdmitted':False}));return 0


if __name__=='__main__':raise SystemExit(main())
