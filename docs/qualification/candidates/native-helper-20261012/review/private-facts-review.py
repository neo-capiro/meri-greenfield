"""Pinned text/data review only; no private compilation, import or execution."""
import hashlib
import json
from pathlib import Path
import re
import sys

PRIVATE=Path(sys.argv[1]);LABEL=sys.argv[2];HERE=Path(__file__).resolve().parent
pins={
'NativeMetadata.cs':(6163,'f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c'),
'candidate-hash-and-paths.json':(60160,'1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84'),
'collect.ps1':(23776,'729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1')}
rows=[];raw={}
def check(name,value):rows.append({'name':name,'passed':bool(value)})
for name,(size,digest) in pins.items():
    raw[name]=(PRIVATE/name).read_bytes()
    check('exact-pin:'+name,len(raw[name])==size and hashlib.sha256(raw[name]).hexdigest()==digest)
if not all(r['passed'] for r in rows):raise ValueError('exact private member refused')
helper=raw['NativeMetadata.cs'].decode('utf-8-sig')
body=re.search(r'public static bool Same\([^)]*\)\s*\{(.*?)\}',helper,re.S).group(1).strip()
fields=re.findall(r'\ba\.(\w+)\s*==\s*b\.(\w+)',body)
check('only-thirteen-equality-conjunction',len(fields)==13 and all(a==b for a,b in fields) and re.sub(r'\ba\.\w+\s*==\s*b\.\w+','EQ',body)=='return '+' && '.join(['EQ']*13)+';')
expected=['VolumeSerialHex','FileId128Hex','CreationTime','LastAccessTime','LastWriteTime','ChangeTime','Size','AllocationSize','LinkCount','Attributes','ReparseTag','Directory','DeletePending']
selected=[a for a,b in fields];check('exact-comparator-field-set',selected==expected)
same=lambda a,b:all(a[k]==b[k] for k in selected)
v=json.loads(raw['candidate-hash-and-paths.json'])
identity_fields=['VolumeSerialHex','FileId128Hex','Attributes','ReparseTag','Directory','DeletePending']
failed=[];identity=True;total=0
for role,count in [('executable',9),('root',8),('Lib',9),('DLLs',9)]:
    left=v['before'][role];right=v['after'][role]
    check('complete-paired-role:'+role,len(left['entries'])==len(right['entries'])==count and left['passed'] is True and right['passed'] is True)
    for i,(a,b) in enumerate(zip(left['entries'],right['entries'],strict=True)):
        total+=1
        if not same(a,b):failed.append({'role':role,'entryIndex':i,'fields':[f for f in selected if a[f]!=b[f]]})
        identity=identity and all(a[f]==b[f] for f in identity_fields)
check('thirty-five-pairs-twelve-fail',total==35 and len(failed)==12)
check('exact-ancestor-failures',[x['entryIndex'] for x in failed]==[0,1,2]*4)
check('all-failures-access-time-only',all(x['fields']==['LastAccessTime'] for x in failed))
check('inline-identity-fields-remain-equal',identity)
h=v['hash'];before=h['OpenedBefore'];during=h['NamedDuring'];after=h['OpenedAfter']
relationships=[(v['before']['executable']['entries'][-1],before),(before,during),(before,after),(after,v['after']['executable']['entries'][-1])]
check('all-four-named-opened-relationships-equal',all(same(a,b) for a,b in relationships))
check('byte-count-matches-recorded-size',h['BytesRead']==before['Size']==after['Size']==91648)
check('recorded-executable-content-hash',h['Sha256']=='f1d8d2aa2a8ad7c74b6c6300b29cfdbcb484fc7ffad99b7fbfe1e31c048343b9')
check('recomputed-collector-rejection',h is not None and all(same(a,b) for a,b in relationships) and identity and bool(failed) and v['boundedHashObservationAccepted'] is False)
check('committed-helper-analysis-agrees',json.loads((HERE/'helper-source-data-analysis.json').read_text())['same']['comparedFields']==selected)
# Every compared field independently matters in the evaluated conjunction.
for field in selected:
    changed=dict(before);old=changed[field]
    changed[field]=(not old) if isinstance(old,bool) else old+1 if isinstance(old,int) else str(old)+'x'
    check('derived-comparison-negative:'+field,not same(before,changed))
result={'inputs':[{'member':n,'bytes':s,'sha256':h} for n,(s,h) in pins.items()],'comparisonFields':selected,'failedPairs':failed,'checks':rows,'passed':sum(r['passed'] for r in rows),'failed':sum(not r['passed'] for r in rows),'privateSourceExecuted':False,'privateSourceCompiled':False,'nativeObservationsRecreated':False,'runtimeAccepted':False,'accessTimeWaiver':False}
(HERE/(LABEL+'.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'failed':result['failed']}));sys.exit(0 if result['failed']==0 else 1)
