"""Fetch only two named official text metadata objects, never package payloads."""
from pathlib import Path
import datetime,hashlib,json,time,urllib.request

HERE=Path(__file__).resolve().parent
REQUESTS=[('pgdg-key.asc','https://www.postgresql.org/media/keys/ACCC4CF8.asc'),
          ('pgdg-trixie.InRelease','https://apt.postgresql.org/pub/repos/apt/dists/trixie-pgdg/InRelease')]
CAP=524288
receipts=[]
for name,url in REQUESTS:
    start=time.monotonic();raw=bytearray();row={'url':url,'file':name,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'capBytes':CAP,'socketTimeoutSeconds':8}
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'Meri-source-metadata-review/1'})
        with urllib.request.urlopen(request,timeout=8) as response:
            row['finalUrl']=response.url;row['status']=response.status;row['contentType']=response.headers.get('Content-Type')
            if response.url!=url:raise ValueError('unexpected redirect')
            while True:
                if time.monotonic()-start>15:raise TimeoutError('cooperative metadata ceiling')
                data=response.read(min(65536,CAP+1-len(raw)))
                if not data:break
                raw.extend(data)
                if len(raw)>CAP:raise ValueError('metadata byte cap')
        row['complete']=True
    except Exception as error:
        row['complete']=False;row['errorType']=type(error).__name__;row['error']=str(error)
    row.update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),elapsedSeconds=time.monotonic()-start)
    (HERE/name).write_bytes(raw);receipts.append(row)
(HERE/'official-metadata-fetch.json').write_text(json.dumps({'scope':'Two official text metadata reads only; no package, wheel, tarball or executable acquired','hardDeadlineClaim':False,'requests':receipts},indent=2)+'\n')
print(json.dumps(receipts))
raise SystemExit(0 if all(r['complete'] for r in receipts) else 1)
