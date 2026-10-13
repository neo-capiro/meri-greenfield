"""Offline pack/install and public-only consumer, bounded by outer capture owner."""
import json,os,pathlib,shutil,subprocess,tempfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[5]; PKG=ROOT/'packages/contracts'; HERE=pathlib.Path(__file__).resolve().parent
out={'scope':'offline isolated npm package + public TypeScript consumer; no scripts/provider/runtime','steps':[]}
def run(argv,cwd):
 p=subprocess.run(argv,cwd=cwd,text=True,capture_output=True,timeout=100)
 out['steps'].append({'argv':argv,'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
 if p.returncode:raise RuntimeError('consumer step failed: '+argv[0])
 return p.stdout
try:
 with tempfile.TemporaryDirectory(prefix='meri-document-public-consumer-') as name:
  tmp=pathlib.Path(name);pack=json.loads(run(['npm','pack','--ignore-scripts','--json','--pack-destination',name],PKG))[0];tar=tmp/pack['filename'];out['tar']={'sha256':hashlib.sha256(tar.read_bytes()).hexdigest(),'bytes':tar.stat().st_size,'files':[x['path'] for x in pack['files']]}
  if any(x.startswith(('apps/','retrieval-0.2/','commands-0.2/','artifacts-0.2/')) for x in out['tar']['files']):raise RuntimeError('private files packed')
  consumer=tmp/'consumer';consumer.mkdir();(consumer/'package.json').write_text('{"name":"document-contract-independent-consumer","version":"1.0.0","private":true,"type":"module"}\n');modules=consumer/'node_modules';modules.mkdir()
  # Existing exact runtime dependencies avoid any registry acquisition. npm validates installation offline.
  for dep in ['ajv','ajv-formats','canonicalize','fast-uri','fast-deep-equal','json-schema-traverse','require-from-string']:shutil.copytree(PKG/'node_modules'/dep,modules/dep,symlinks=True)
  run(['npm','install','--offline','--ignore-scripts','--no-package-lock','--no-audit','--no-fund',str(tar)],consumer)
  (consumer/'consumer.mjs').write_text("import assert from 'node:assert/strict';\nimport {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,DocumentResponseError} from '@capiro/meri-contracts/document-application';\nimport {receiveActionResponse} from '@capiro/meri-contracts/action-application';\nimport * as old from '@capiro/meri-contracts';\nimport schema from '@capiro/meri-contracts/document-application/schema' with {type:'json'};\nassert.equal(typeof receiveActionResponse,'function');assert.equal(typeof receiveDocumentDownload,'function');assert.equal(typeof receiveDocumentResponse,'function');assert.equal(typeof DocumentResponseError,'function');assert.ok(Object.keys(old).length);assert.ok(schema.$id);const value=receiveDocumentRequest('inspect',new TextEncoder().encode(JSON.stringify({versionId:'00000000-0000-4000-8000-000000000001'})));assert.equal(value.versionId,'00000000-0000-4000-8000-000000000001');await assert.rejects(()=>import('@capiro/meri-contracts/artifacts-0.2/artifact-validation.mjs'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});console.log('isolated public exports and private-subpath denial PASS');\n")
  run(['node','consumer.mjs'],consumer)
  shutil.copyfile(PKG/'test/document-application-independent-types.ts',consumer/'consumer.ts')
  run(['node',str((PKG/'node_modules/typescript/lib/tsc.js').resolve()),'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','consumer.ts'],consumer)
 out['ownedTemporaryDirectoryRemoved']=True;out['passed']=True
except Exception as e:out['passed']=False;out['failure']=str(e)
finally:(HERE/'portable-consumer-result.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'passed':out['passed'],'steps':len(out['steps']),'failure':out.get('failure')}));raise SystemExit(0 if out['passed'] else 1)
