"""Independent literal DOCX/PDF/source inspection; no producer/native qualification."""
import hashlib, json, pathlib, re, sys, unicodedata
import docx, fitz
sha=lambda b:hashlib.sha256(b).hexdigest()
clean=lambda t:re.sub(r'\s+', '', unicodedata.normalize('NFKC',t).replace('\u00ad',''))
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
utf16=lambda s:s.encode('utf-16-le')
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); rows=[]
assets=json.loads((root/'packages/skills/assets.json').read_text())
for domain, directory in [('commitments_audit',sys.argv[3]),('relationship_brief',sys.argv[4])]:
 directory=pathlib.Path(directory); saved=json.loads((directory/'provenance.json').read_text()); originals=[]
 asset=next(a for a in assets['assets'] if a['skillId']=='quick_skill.'+domain and a['skillVersion']=='1.0.0')
 prose=root/'packages/skills'/asset['prosePath']; manifest=json.loads((root/'packages/skills'/asset['manifestPath']).read_text())
 assert sha(prose.read_bytes())==asset['proseSha256']; assert sha(canonical(manifest))==asset['manifestSha256']
 for number,label in enumerate(['original','revision']):
  prep=saved['preparations'][number]; version=saved['versions'][number]; pin=prep['provenance']['skill']
  assert pin=={k:asset[k] for k in ['skillId','skillVersion','manifestSha256','proseSha256']}|{'catalogSha256':assets['catalogSha256']}
  data=(directory/(label+'.docx')).read_bytes(); document=docx.Document(directory/(label+'.docx'))
  paragraphs=[p.text for p in document.paragraphs]; expected=[''.join(r['text'] for r in b['runs']) for b in prep['request']['content']['blocks']]
  assert paragraphs==expected, 'Actual editable paragraph text differs from typed Word request'
  assert not document.tables; assert sha(data)==version['object']['sha256']; assert len(data)==version['object']['bytes']
  all_text='\n'.join(paragraphs); assert 'Coverage and verification appendix' in all_text
  for source in manifest['requiredSources']: assert source['sourceId'] in all_text
  pdf=fitz.open(directory/(label+'-preview.pdf')); inspection=json.loads((directory/(label+'-inspection.json')).read_text())
  assert len(pdf)==len(inspection['visual']['pages']); assert len(pdf)>0
  # PyMuPDF's supported geometric reading order retains inline color-emoji placement.
  rendered='\n'.join(page.get_text(sort=True) for page in pdf)
  assert clean(all_text)==clean(rendered), 'PDF loses or changes literal DOCX text'
  images=[]
  for page_num,page in enumerate(pdf,1):
   image=directory/(label+f'-preview-{page_num}.png'); expected_image=inspection['visual']['pages'][page_num-1]
   assert sha(image.read_bytes())==expected_image['sha256']; assert page.get_text().strip()
   images.append({'page':page_num,'path':str(image),'sha256':sha(image.read_bytes()),'bytes':image.stat().st_size,'visuallyOpened':True})
  receipts=prep.get('reads',prep.get('receipts')); sections=[]
  for receipt in receipts:
   assert sha(canonical(receipt['result']))==receipt['resultSha256']
   raw=receipt['result']; value=raw.get('result',raw)
   assert raw['binding']==prep['context']['binding']; assert raw['subject']['scopes']==prep['context']['scopes']
   assert raw['subject']['authorizationDecisionId']
   for m in value.get('messages',[]):
    if 'section' in m:
     c=m['section']; sections.append(('mail',m['messageId'],m['recordVersionId'],m['contentSha256'],m['scopes'],c['start'],c['endExclusive'],c['totalCodeUnits'],c['text']))
   material=([value['source']] if value.get('kind')=='meeting-source-body-page' else value.get('debriefs',[]))
   for m in material:
    p=m['provenance']; c=m['bodyCoverage']; source_record_id=m['sourceId'] if value.get('kind')=='meeting-source-body-page' else p['sourceRecordId']
    sections.append(('meetings',source_record_id,p['sourceVersion'],p['bodySha256'],raw['subject']['scopes'],c['characterStart'],c['characterEnd'],c['totalCharacters'],m['body']))
   for record in value.get('data',{}).get('records',[]):
    p=record['provenance']; body=record['payload'].get('text'); cover=value['data'].get('coverage',{})
    if body is not None and 'sectionCharacters' in cover:
     assert 'content-addressed-extraction' in all_text
     sections.append(('client_documents',p['sourceRecordId']+':section:'+str(p['section']),'extraction:'+p['contentHash']+':'+p['sectionHash']+':'+str(p['section']),p['sectionHash'],raw['subject']['scopes'],p['characterStart'],p['characterEnd'],cover['sectionCharacters'],body))
   if value.get('tool')=='search_memory':
    for record in value.get('records',[]):
     p=record['provenance']; payload=record['payload']; c=payload['content']
     assert payload['governance']['status']=='active'; assert payload['contentStatus']=='available'
     sections.append(('client_knowledge_memory',record['recordId'],p['sourceVersion'],c['hash'],raw['subject']['scopes'],c['offset'],c['endOffset'],c['totalCharacters'],payload['value']))
  material_hashes=[]
  for evidence in prep['context']['evidence']:
   matching=sorted([s for s in sections if s[:3]==(evidence['sourceId'],evidence['recordId'],evidence['sourceVersionId'])],key=lambda s:(s[5],s[6]))
   assert matching, 'Artifact evidence has no actual typed material receipt'; full=b''; end=0
   for s in matching:
    if evidence['sourceId']!='client_knowledge_memory': assert s[3]==evidence['contentSha256']
    else: assert s[3]==matching[0][3]
    assert s[4]==evidence['scopes']; assert s[6]-s[5]==len(utf16(s[8]))//2
    if s[6]<=end: assert full[s[5]*2:s[6]*2]==utf16(s[8]); continue
    assert s[5]==end, 'Missing or overlapping body section'; full+=utf16(s[8]); end=s[6]
   assert end==matching[-1][7]; text=full.decode('utf-16-le'); assert sha(text.encode())==evidence['contentSha256']
   if evidence['sourceId']=='client_knowledge_memory':
    assert sha((text+'\0'+evidence['sourceVersionId']).encode())==matching[0][3]
    assert matching[0][3] in all_text; assert 'bound-derived-memory' in all_text; assert 'upstreamExcerptVerified' in all_text
   material_hashes.append({'sourceId':evidence['sourceId'],'recordId':evidence['recordId'],'sourceVersionId':evidence['sourceVersionId'],'fullSha256':evidence['contentSha256'],'utf16CodeUnits':end,'scopes':evidence['scopes']})
  if number==0: assert version['parentVersionId'] is None; assert prep['baseVersionId'] is None; originals.append(version)
  else:
   original=originals[0]; assert prep['baseVersionId']==original['versionId']; assert version['parentVersionId']==original['versionId']; assert version['artifactId']==original['artifactId']
   assert prep['provenance']['parent']['objectSha256']==original['object']['sha256']; assert sha((directory/'original.docx').read_bytes())==original['object']['sha256']
  for p in inspection['processes']: assert p['leaderClosed'] and p['groupAbsent'] and p['exitCode']==0
  rows.append({'domain':domain,'label':label,'directory':str(directory),'docxSha256':sha(data),'docxBytes':len(data),'editableParagraphs':len(paragraphs),'pdfSha256':sha((directory/(label+'-preview.pdf')).read_bytes()),'pages':len(pdf),'images':images,'materialEvidence':material_hashes,'pin':pin,'literalTextPreserved':True,'exactParentAndOriginalPreserved':True,'nativeQualified':False})
 receipt=json.loads((directory/'flow-receipt.json').read_text()); assert receipt['status']=='PASS'
 assert receipt['cleanup']['executorDirectoriesAbsent']; assert receipt['cleanup']['storeRemoved']; assert receipt['result']['stats']['generations']==2
 for p in receipt['result']['stats']['processReceipts']: assert p['leaderClosed'] and p['groupAbsent'] and p['exitCode']==0
out.write_text(json.dumps({'status':'PASS','scope':'Independent literal artifact/source correlation and visual opening only; source freeze pending','artifacts':rows},indent=2)+'\n')
print(json.dumps({'status':'PASS','artifacts':len(rows),'pages':sum(r['pages'] for r in rows),'report':str(out)}))
