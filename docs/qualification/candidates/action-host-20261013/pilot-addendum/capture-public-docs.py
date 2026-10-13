"""Two allowlisted public documentation GETs; no account/API/model call or body retention."""
from pathlib import Path
from urllib.request import Request,urlopen
from datetime import datetime,timezone
import hashlib,json,re
urls=[('count-tokens','https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html'),('sonnet-4-6','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html')]
records=[]
for key,url in urls:
 r={'id':key,'url':url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'method':'GET','credentialsSupplied':False,'bodyRetained':False}
 try:
  with urlopen(Request(url,headers={'User-Agent':'Meri-public-documentation-audit/1'}),timeout=20) as response:
   body=response.read(2*1024*1024+1)
   if len(body)>2*1024*1024:raise ValueError('public page exceeds bound')
   r.update(status=response.status,finalUrl=response.url,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),headers={h:response.headers.get(h) for h in ['Content-Type','ETag','Last-Modified','Date']})
   text=re.sub('<[^>]+>',' ',body.decode());text=re.sub(r'\s+',' ',text)
   if key=='count-tokens':r['feeSentencePresent']="API doesn't incur charges." in text
   else:r['modelProfilePresent']='us.anthropic.claude-sonnet-4-6' in text;r['countTokensTextPresent']='Count tokens' in text;r['runtimeTextPresent']='bedrock-runtime' in text;r['mantleTextPresent']='bedrock-mantle' in text
 except Exception as error:
  r.update(errorType=type(error).__name__,error=str(error),status=getattr(error,'code',None))
 records.append(r)
p=Path(__file__).with_name('public-retrievals.json');p.write_text(json.dumps({'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'records':records,'scope':'Public documentation only; presence checks are not table support interpretation or runtime qualification.'},indent=2)+'\n')
print(p.read_text())
