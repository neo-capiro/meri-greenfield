"""Read public notices and bounded browser ZIP directory as data only."""
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import urllib.request
import zipfile

OUT = Path(__file__).resolve().parent
SHA = lambda data: hashlib.sha256(data).hexdigest()
sources = [
    ('node-v24.21.0-LICENSE.txt', 'https://raw.githubusercontent.com/nodejs/node/v24.21.0/LICENSE', True),
    ('cpython-v3.13.5-LICENSE.txt', 'https://raw.githubusercontent.com/python/cpython/v3.13.5/LICENSE', True),
    ('standardwebhooks-exact-LICENSE.txt', 'https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/b4d2c14fc5b4ccff3ff271e3b087dff812254c59/LICENSE', True),
    ('canvas-exact-gitmodules.txt', 'https://raw.githubusercontent.com/Brooooooklyn/canvas/7d19abed029287e7c26b14eaa6e67d560a37d853/.gitmodules', True),
    ('canvas-exact-tree.json', 'https://api.github.com/repos/Brooooooklyn/canvas/git/trees/7d19abed029287e7c26b14eaa6e67d560a37d853', True),
    ('cpython-v3.13.5-abi.rst', 'https://raw.githubusercontent.com/python/cpython/v3.13.5/Doc/c-api/stable.rst', True),
    ('lxml-installation.html', 'https://lxml.de/installation.html', False),
    ('sdk-legal-and-compliance.html', 'https://code.claude.com/docs/en/legal-and-compliance', False),
    ('sdk-commercial-terms.html', 'https://www.anthropic.com/legal/commercial-terms', False),
]
records = []
for name, url, retain in sources:
    item = {'url': url, 'name': name}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Meri-source-license-evidence/1'}), timeout=20) as response:
            raw = response.read(4*1024*1024+1)
            if len(raw)>4*1024*1024: raise ValueError('document byte bound')
            item.update({'status':response.status,'finalUrl':response.url,'bytes':len(raw),'sha256':SHA(raw)})
        if retain:
            (OUT/'notices'/name).write_bytes(raw)
            item['retainedFile']='notices/'+name
        else:
            item['retention']='HASH_AND_LOCATOR_ONLY_NOT_LICENSE_APPROVAL'
    except Exception as error:
        item['error']=type(error).__name__+': '+str(error)
    records.append(item)

packages=json.loads((OUT/'package-inspection.json').read_text())['artifacts']
item=packages['isarray@1.0.0']
with tarfile.open(item['archiveLocalPath']) as archive:
    member=next(m for m in archive.getmembers() if m.name.lower().endswith('readme.md'))
    raw=archive.extractfile(member).read(); start=raw.index(b'## License'); notice=raw[start:]
    filename='isarray-1.0.0-inline-MIT-LICENSE.txt';(OUT/'notices'/filename).write_bytes(notice)
    records.append({'url':item['url'],'member':member.name,'archiveSha256':item['archiveReceipt']['sha256'],
                    'originalMemberSha256':SHA(raw),'retainedFile':'notices/'+filename,
                    'derivative':'Complete inline license section, bytes from heading to EOF',
                    'bytes':len(notice),'sha256':SHA(notice)})

class RemoteZip(io.RawIOBase):
    def __init__(self, url, size):
        self.url=url;self.size=size;self.offset=0;self.requests=[];self.bytesRead=0
    def seekable(self): return True
    def tell(self): return self.offset
    def seek(self, offset, whence=0):
        self.offset=offset if whence==0 else self.offset+offset if whence==1 else self.size+offset
        if self.offset<0 or self.offset>self.size: raise ValueError('range seek outside archive')
        return self.offset
    def read(self, size=-1):
        count=self.size-self.offset if size<0 else min(size,self.size-self.offset)
        if count==0: return b''
        if count>4*1024*1024 or self.bytesRead+count>12*1024*1024: raise ValueError('browser range byte bound')
        end=self.offset+count-1
        request=urllib.request.Request(self.url,headers={'Range':f'bytes={self.offset}-{end}','User-Agent':'Meri-source-license-evidence/1'})
        with urllib.request.urlopen(request,timeout=20) as response:
            item={'url':self.url,'status':response.status,'range':response.headers.get('Content-Range')}
            self.requests.append(item)
            if response.status!=206 or item['range']!=f'bytes {self.offset}-{end}/{self.size}':
                raise ValueError('server did not honor exact bounded byte range')
            raw=response.read(count+1)
            if len(raw)!=count:raise ValueError('range length mismatch')
        self.offset+=count;self.bytesRead+=count;item['bytes']=count;item['sha256']=SHA(raw)
        return raw

url='https://storage.googleapis.com/chrome-for-testing-public/155.0.8059.12/linux64/chrome-linux64.zip'
remote=RemoteZip(url,198335306);browser={'url':url,'expectedArchiveBytes':remote.size,'fullArchiveHashVerified':False}
try:
    with zipfile.ZipFile(remote) as archive:
        members=archive.infolist();browser['members']=[{'name':m.filename,'bytes':m.file_size,'compressedBytes':m.compress_size,'crc32':f'{m.CRC:08x}'} for m in members]
        browser['notices']=[]
        for member in members:
            if re.search(r'(licen[cs]e|notice|copying|copyright|about)',Path(member.filename).name,re.I):
                raw=archive.read(member);name='cft-155.0.8059.12-'+Path(member.filename).name
                (OUT/'notices'/name).write_bytes(raw)
                browser['notices'].append({'member':member.filename,'bytes':len(raw),'sha256':SHA(raw),'retainedFile':'notices/'+name})
    browser['status']='SELECTED_RANGES_INSPECTED_NOT_WHOLE_ARCHIVE'
except Exception as error:
    browser['status']='FAILED';browser['error']=type(error).__name__+': '+str(error)
browser['rangeRequests']=remote.requests;browser['rangeBytes']=remote.bytesRead
(OUT/'upstream-documents.json').write_text(json.dumps(records,indent=2)+'\n')
(OUT/'browser-range-inspection.json').write_text(json.dumps(browser,indent=2)+'\n')
print(json.dumps({'documents':[(v.get('name'),v.get('status'),v.get('error')) for v in records],
                  'browser':{k:v for k,v in browser.items() if k not in ['members','rangeRequests']}},indent=2))
