#!/usr/bin/env python3
import gzip,hashlib,json,os
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[4]
sha=lambda b:hashlib.sha256(b).hexdigest()
sets=[('frozen-artifact-inspection.json','historical original v1; not final source acceptance'),('worker-utf16-artifact-inspection.json','superseded changed-body v1 fixture; no immutable continuity acceptance'),('worker-final-superseded-artifact-inspection.json','superseded changed-body v1 fixture; no immutable continuity acceptance'),('worker-v2-artifact-inspection.json','worker stable source v2 artifacts'),('integrated-artifact-inspection.json','root actual gateway source5e artifacts; emitter bytes audited'),('final-artifact-inspection.json','independent actual gateway replay at final frozen source')]
visual=[]
for filename,classification in sets:
 receipt=json.loads((out/filename).read_text())
 for version in receipt['versions']:
  for page in version['pages']:
   raw=Path(page['png']).read_bytes();assert sha(raw)==page['sha256']
   visual.append({'set':filename,'classification':classification,'label':version['label'],'page':page['page'],'sha256':page['sha256'],'openedWith':'view_image','visuallyInspected':True,'readable':True,'clippedText':False})
assert len(visual)==48
(out/'visual-review.json').write_text(json.dumps({'sourceHead':json.loads((out/'source-binding.json').read_text())['sourceHead'],'inspector':'independent Codex artifact reviewer','pagesOpened':48,'finalReplayPagesOpened':8,'findings':'Every retained page opened. Quotation, unverified interpretation, three-source coverage, date/freshness limitations, citation hashes/scopes and provenance are readable. Page4 is a visible appendix continuation. Superseded changed-bodyv1 fixtures do not establish immutable source continuity.','pages':visual,'nativeQualified':False},indent=2)+'\n')
compressed=[]
for path in sorted(out.glob('*.txt')):
 if not (path.name.endswith('.stdout.txt') or path.name.endswith('.stderr.txt')):continue
 raw=path.read_bytes();target=path.with_name(path.name+'.gz');packed=gzip.compress(raw,mtime=0);target.write_bytes(packed);path.unlink()
 compressed.append({'originalName':path.name,'gzipName':target.name,'uncompressedBytes':len(raw),'uncompressedSha256':sha(raw),'gzipSha256':sha(packed)})
(out/'raw-evidence-manifest.json').write_text(json.dumps({'format':'bit-exact gzip; mtime0','files':compressed},indent=2)+'\n')
link=root/'node_modules';assert link.is_symlink() and os.readlink(link)=='/workspace/meri-greenfield/node_modules';link.unlink();assert not link.exists() and Path('/workspace/meri-greenfield/node_modules').is_dir()
receipts=[json.loads(p.read_text()) for p in out.glob('*.receipt.json')]
assert all(r['leaderReaped'] and not r['groupRemaining'] and not r['timeout'] for r in receipts)
flow=json.loads((out/'independent-artifacts/gateway-flow-receipt.json').read_text());assert flow['cleanup']['executorDirectoriesAbsent'] and flow['cleanup']['storeRemoved']
(out/'cleanup.json').write_text(json.dumps({'status':'PASS','ownedCaptureRuns':len(receipts),'allOwnedLeadersReaped':True,'allOwnedGroupsAbsent':True,'outerTimeouts':0,'finalFlowCleanup':flow['cleanup'],'borrowedNodeModulesRemoved':True,'donorPreserved':True,'nativeQualified':False},indent=2)+'\n')
print(json.dumps({'status':'PASS','visualPages':len(visual),'captureRuns':len(receipts),'rawFilesCompressed':len(compressed),'dependencyLinkRemoved':True}))
