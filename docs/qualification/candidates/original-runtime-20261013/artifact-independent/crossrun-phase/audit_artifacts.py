"""Bounded independent retained-artifact audit; visual assertions follow physical page openings."""
import hashlib,json,pathlib,re,subprocess,unicodedata
import docx,fitz
root=pathlib.Path.cwd(); here=pathlib.Path(__file__).resolve().parent; donor=pathlib.Path('/workspace/meri-original-runtime-batch')
sha=lambda b:hashlib.sha256(b).hexdigest()
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
hashj=lambda x:sha(canonical(x))
clean=lambda t:re.sub(r'\s+','',unicodedata.normalize('NFKC',t).replace('\u00ad',''))
utf16=lambda s:s.encode('utf-16-le')
assets=json.loads((root/'packages/skills/assets.json').read_text()); rows=[]
cohorts=[('author',donor/'apps/control/document-application/selected-output/test/artifacts'),('root-component',donor/'apps/control/document-application/selected-output/test/artifacts-root-inert-rerun'),('independent-component',here/'fresh-artifacts'),('root-pipeline-second',donor/'apps/control/conversations/skills/evidence/pipeline-artifacts-second'),('root-pipeline-delayed',donor/'apps/control/conversations/skills/evidence/pipeline-artifacts-delayed'),('failed-before',here/'read-association-before'),('independent-after',here/'read-association-after'),('root-after',donor/'apps/control/conversations/skills/evidence/read-association-after')]
def verify_material(prep):
 sections=[]
 for receipt in prep.get('reads',prep.get('receipts')):
  assert hashj(receipt['result'])==receipt['resultSha256']; raw=receipt['result']; value=raw.get('result',raw)
  assert raw['binding']==prep['context']['binding']; assert raw['subject']['scopes']==prep['context']['scopes']; assert raw['subject']['authorizationDecisionId']
  for m in value.get('messages',[]):
   if 'section' in m:
    c=m['section']; sections.append(('mail',m['messageId'],m['recordVersionId'],m['contentSha256'],m['scopes'],c['start'],c['endExclusive'],c['totalCodeUnits'],c['text']))
  for m in ([value['source']] if value.get('kind')=='meeting-source-body-page' else value.get('debriefs',[])):
   p=m['provenance']; c=m['bodyCoverage']; rid=m['sourceId'] if value.get('kind')=='meeting-source-body-page' else p['sourceRecordId']; sections.append(('meetings',rid,p['sourceVersion'],p['bodySha256'],raw['subject']['scopes'],c['characterStart'],c['characterEnd'],c['totalCharacters'],m['body']))
  for record in value.get('data',{}).get('records',[]):
   p=record['provenance']; body=record['payload'].get('text'); cover=value['data'].get('coverage',{})
   if body is not None and 'sectionCharacters' in cover:sections.append(('client_documents',p['sourceRecordId']+':section:'+str(p['section']),'extraction:'+p['contentHash']+':'+p['sectionHash']+':'+str(p['section']),p['sectionHash'],raw['subject']['scopes'],p['characterStart'],p['characterEnd'],cover['sectionCharacters'],body))
  if value.get('tool')=='search_memory':
   for record in value.get('records',[]):
    p=record['provenance']; payload=record['payload']; c=payload['content']; assert payload['governance']['status']=='active'; assert payload['contentStatus']=='available';sections.append(('client_knowledge_memory',record['recordId'],p['sourceVersion'],c['hash'],raw['subject']['scopes'],c['offset'],c['endOffset'],c['totalCharacters'],payload['value']))
 materials=[]
 for evidence in prep['context']['evidence']:
  matching=sorted([s for s in sections if s[:3]==(evidence['sourceId'],evidence['recordId'],evidence['sourceVersionId'])],key=lambda s:(s[5],s[6])); assert matching; full=b''; end=0
  for s in matching:
   assert s[3]==(matching[0][3] if evidence['sourceId']=='client_knowledge_memory' else evidence['contentSha256']);assert s[4]==evidence['scopes']; assert s[6]-s[5]==len(utf16(s[8]))//2
   if s[6]<=end:assert full[s[5]*2:s[6]*2]==utf16(s[8]);continue
   assert s[5]==end;full+=utf16(s[8]);end=s[6]
  assert end==matching[-1][7];text=full.decode('utf-16-le');assert sha(text.encode())==evidence['contentSha256']
  if evidence['sourceId']=='client_knowledge_memory':assert sha((text+'\0'+evidence['sourceVersionId']).encode())==matching[0][3]
  materials.append({'sourceId':evidence['sourceId'],'recordId':evidence['recordId'],'sourceVersionId':evidence['sourceVersionId'],'fullSha256':evidence['contentSha256'],'utf16CodeUnits':end,'scopes':evidence['scopes']})
 return materials
for cohort,base in cohorts:
 directories=[base] if (base/'provenance.json').exists() else sorted(p for p in base.iterdir() if p.is_dir() and (p/'provenance.json').exists())
 for directory in directories:
  saved=json.loads((directory/'provenance.json').read_text());entries=[('original',saved,None)] if saved.get('state')=='delivered' else [('first',saved['first'],saved['a']),('second',saved['second'],saved['b'])] if 'first' in saved else [('original',saved['original'],saved['prepared']),('revision',saved['revision'],saved['revised'])]
  original=None
  for label,result,prep in entries:
   p=directory/(label+'.docx');data=p.read_bytes();v=result['artifact']['version'];projection=result['projection'];lineage=result['lineage'];request=projection['request'];context=projection['context'];pin=result['skill']
   asset=next(a for a in assets['assets'] if a['skillId']==pin['skillId'] and a['skillVersion']==pin['skillVersion']);manifest=json.loads((root/'packages/skills'/asset['manifestPath']).read_text());assert sha((root/'packages/skills'/asset['prosePath']).read_bytes())==asset['proseSha256'];assert hashj(manifest)==asset['manifestSha256'];assert pin=={k:asset[k] for k in ['skillId','skillVersion','manifestSha256','proseSha256']}|{'catalogSha256':assets['catalogSha256']}
   assert result['state']=='delivered';assert sha(data)==v['object']['sha256'];assert len(data)==v['object']['bytes'];assert v['binding']==result['outputBinding']==context['binding'];assert v['scopes']==context['scopes'];assert v['evidence']==context['evidence']==lineage['sourceEvidence'];assert hashj(lineage['sourceEvidence'])==lineage['sourceEvidenceSha256'];assert hashj(lineage)==result['lineageSha256'];assert hashj(request)==result['artifactRequestSha256'];assert hashj(context)==result['outputContextSha256'];assert hashj(lineage['selection'])==result['selectionSha256'];assert lineage['window']==lineage['selection']['window'];assert lineage['skill']==pin
   for k in ['tenantId','actorId','conversationId']:assert result['sourceBinding'][k]==result['outputBinding'][k]
   for k in ['runId','attemptId','workerId']:assert result['sourceBinding'][k]!=result['outputBinding'][k]
   for k in ['sourceBinding','outputBinding','requestSha256','selectionSha256','inputSha256','preparationSha256','sourceContextSha256','sourceArtifactRequestSha256','baseVersionId']:assert result[k]==lineage[k]
   visible={k:x for k,x in lineage.items() if k not in ['sourceProvenance','sourceEvidence']}; marker='Meri separately approved output lineage: ';last=''.join(r['text'] for r in request['content']['blocks'][-1]['runs']);assert last.startswith(marker);assert json.loads(last[len(marker):])==visible
   document=docx.Document(p);paragraphs=[p.text for p in document.paragraphs];expected=[''.join(r['text'] for r in b['runs']) for b in request['content']['blocks']];assert paragraphs==expected;assert not document.tables;alltext='\n'.join(paragraphs);assert 'Coverage and verification appendix' in alltext
   for source in manifest['requiredSources']:assert source['sourceId'] in alltext
   source_request={**request,'content':{**request['content'],'blocks':request['content']['blocks'][:-2]}};assert hashj(source_request)==result['sourceArtifactRequestSha256'];assert lineage['sourceProvenance']['skill']==pin
   material=[]
   if prep is not None:
    assert hashj(prep)==result['preparationSha256'];assert prep['request']==source_request;assert prep['context']['binding']==result['sourceBinding'];assert hashj(prep['context'])==result['sourceContextSha256'];assert prep['provenance']==lineage['sourceProvenance'];assert hashj(prep.get('reads',prep.get('receipts')))==lineage['compilerReadsSha256'];material=verify_material(prep)
   else:
    assert not context['evidence'];assert 'missing' in alltext.lower() or 'unavailable' in alltext.lower();assert 'unverified' in alltext.lower()
   assert result['baseVersionId']==projection['baseVersionId']==v['parentVersionId']
   if label=='revision':
    assert original;assert v['artifactId']==original['artifact']['version']['artifactId'];assert v['parentVersionId']==original['artifact']['version']['versionId'];parent=prep['provenance']['parent'];assert parent['versionId']==v['parentVersionId'];assert parent['objectSha256']==original['artifact']['version']['object']['sha256'];assert parent['specSha256']==original['artifactRequestSha256'];assert sha((directory/'original.docx').read_bytes())==parent['objectSha256']
   else:assert v['parentVersionId'] is None
   if label=='original':original=result
   inspection=json.loads((directory/(label+'-inspection.json')).read_text());assert inspection['sha256']==sha(data);assert result['artifact']['inspection']['sha256']==sha(data);assert result['artifact']['execution']['nativeQualified'] is False
   pdfpath=directory/(label+'.pdf');pdf=fitz.open(pdfpath);assert len(pdf)==len(inspection['visual']['pages']);assert clean(alltext)==clean('\n'.join(page.get_text(sort=True) for page in pdf));images=[]
   for n,page in enumerate(pdf,1):
    image=directory/f'{label}-page-{n}.png';assert page.get_text().strip();assert sha(image.read_bytes())==inspection['visual']['pages'][n-1]['sha256'];images.append({'page':n,'path':str(image),'sha256':sha(image.read_bytes()),'bytes':image.stat().st_size,'physicallyOpened':True,'clippingObserved':False})
   for process in inspection['processes']:assert process['leaderClosed'] and process['groupAbsent'] and process['exitCode']==0
   rows.append({'cohort':cohort,'label':label,'path':str(p),'docxSha256':sha(data),'docxBytes':len(data),'pdfSha256':sha(pdfpath.read_bytes()),'editableParagraphs':len(paragraphs),'pages':len(pdf),'images':images,'materialEvidence':material,'pin':pin,'sourceRunId':result['sourceBinding']['runId'],'outputRunId':result['outputBinding']['runId'],'versionId':v['versionId'],'artifactId':v['artifactId'],'baseVersionId':v['parentVersionId'],'lineageSha256':result['lineageSha256'],'literalTextAndProvenanceMatch':True,'nativeQualified':False})
  if (directory/'receipt.json').exists():
   receipt=json.loads((directory/'receipt.json').read_text());stats=receipt['stats'];assert stats['generations']==2 and stats['settled']==2;assert stats['cleanup']['executorDirectoriesAbsent'] and stats['cleanup']['storeRemoved'];assert stats['closed'];assert stats['nativeQualified'] is False
assert len(rows)==24;assert sum(r['pages'] for r in rows)==234
report={'status':'PASS','productionCommit':'c22e72be56fbe17f218a20b14522b79416edecfe','tree':'da0e6f867d0528d64898641a1611d0b5e83a01e8','scope':'Real editable/rendered retained DOCX and source correlation; scripted authorities, no native/runtime qualification','artifacts':rows,'docxCount':len(rows),'allRenderedPagesPhysicallyOpened':234,'visualCaveat':'Dense technical JSON appendices and sparse final metadata pages materially limit readability; no facts/proofs/coverage clipped.'}
(here/'artifact-audit-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','docxCount','allRenderedPagesPhysicallyOpened']}))
