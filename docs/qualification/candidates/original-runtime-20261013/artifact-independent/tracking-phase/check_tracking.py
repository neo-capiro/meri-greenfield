"""Compare visible tracking/provenance to retained typed native receipts; no native qualification."""
import hashlib, json, pathlib, sys
digest=lambda value:hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
output=pathlib.Path(sys.argv[1]); checked=[]
for directory in map(pathlib.Path,sys.argv[2:]):
 saved=json.loads((directory/'provenance.json').read_text())
 for index,label in enumerate(['original','revision'] if (directory/'revision.docx').exists() else ['original']):
  prep=saved['preparations'][index]; tracking=prep['tracking']; assert tracking==prep['provenance']['tracking']; assert len(tracking)==3
  assert not {'tasks','action_recommendation','client_knowledge_monday'}&{e['sourceId'] for e in prep['context']['evidence']}
  observations=[]
  for row in tracking:
   receipts=[r for r in prep['reads'] if r['operation']==row['operation'] and r['resultSha256']==row['receipt']['resultSha256']]
   assert len(receipts)==1; raw=receipts[0]['result']; assert digest(raw)==row['receipt']['resultSha256']
   assert row['receipt']['binding']==raw['binding']==prep['context']['binding']
   assert row['receipt']['scopes']==raw['subject']['scopes']==prep['context']['scopes']
   assert row['receipt']['authorizationDecisionId']==raw['subject']['authorizationDecisionId']
   assert row['deliveryVerified'] is False and row['acceptanceVerified'] is False and row['nativeStatusVerification']=='unverified'
   assert row['linkage']['sourceVersionMatch']=='unavailable' and row['linkage']['semanticVerification']=='requires-human-verification'
   assert row['coverage']['qualifiedComplete'] is False and row['coverage']['snapshotVersionId'] is None
   value=raw.get('result',raw)
   if row['sourceId']=='client_knowledge_monday':
    record=next(r for r in value['records'] if r['recordId']==row['nativeRecordId'])
    assert row['authority']=='derived' and row['sourceVersionId'] is None and row['sourceProof'] is None
    assert row['versionStatus']=='unavailable-unversioned'; assert row['mondayMetadata']['provenance']==record['provenance']
    assert row['status']==record['payload']['status'] and row['owner']==record['payload']['owners']
    assert row['mondayMetadata']['origin']==record['payload']['origin'] and row['mondayMetadata']['updates']==record['payload']['updates']
   else:
    record=next(r for r in value['tasks' if row['sourceId']=='tasks' else 'actions'] if r['id']==row['nativeRecordId'])
    assert row['authority']=='authoritative' and row['sourceProof']==record['sourceProof']
    assert row['sourceVersionId']==record['sourceProof']['sourceVersion'] and row['versionStatus']=='native-source-assertion-unverified'
    assert row['nativeCompletion']==record['nativeCompletion']; assert record['nativeCompletion']['establishesDeliveryOrAcceptance'] is False
    assert row['status']==record['status'] and row['owner']==record['ownerUserId'] and row['clientId']==record['clientId']
    assert record['sourceProof']['sourceRecordId']==record['id'] and record['sourceProof']['currentClientId']==record['clientId']
    content={k:v for k,v in record.items() if k not in ['recordKind','recommendation','acceptedAsTask','nativeCompletion','sourceProof']}
    native_digest=hashlib.sha256(json.dumps(content,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    assert native_digest==record['sourceProof']['contentSha256'], 'Native metadata digest differs from retained fields'
   observations.append({'sourceId':row['sourceId'],'nativeRecordId':row['nativeRecordId'],'sourceVersionId':row['sourceVersionId'],'sourceProof':row['sourceProof'],'resultSha256':row['receipt']['resultSha256'],'authority':row['authority'],'deliveryVerified':False,'acceptanceVerified':False})
  checked.append({'directory':str(directory),'label':label,'tracking':observations})
output.write_text(json.dumps({'status':'PASS','documents':checked,'scope':'Literal retained typed native assertions only; no authenticity/current policy/semantic qualification'},indent=2)+'\n')
print(json.dumps({'status':'PASS','documents':len(checked),'nativeRows':sum(len(d['tracking']) for d in checked)}))
