"""Pack only local files; unpack as an isolated consumer, no install or network."""
from pathlib import Path
import hashlib,json,shutil,subprocess,tarfile,tempfile
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
work=Path(tempfile.mkdtemp(prefix='meri-wire-review-consumer-',dir='/tmp'))
def run(args,cwd=root):
 r=subprocess.run(args,cwd=cwd,text=True,capture_output=True,timeout=60)
 print(json.dumps({'command':args,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}))
 if r.returncode:raise RuntimeError('consumer check failed')
 return r.stdout
try:
 packed=json.loads(run(['npm','pack','./packages/contracts','--ignore-scripts','--offline','--json','--cache',str(work/'cache'),'--pack-destination',str(work)]))[0]
 archive=work/packed['filename'];consumer=work/'consumer';target=consumer/'node_modules/@capiro/meri-contracts';target.mkdir(parents=True)
 with tarfile.open(archive) as tar:
  for item in tar.getmembers():
   assert item.name.startswith('package/') and '..' not in Path(item.name).parts and not item.issym() and not item.islnk()
   path=target/item.name[len('package/'):]
   if item.isdir():path.mkdir(parents=True,exist_ok=True)
   else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(tar.extractfile(item).read())
 assert not (target/'retrieval-0.2').exists() and not (target/'commands-0.2').exists() and not (target/'action-application').exists()
 (consumer/'package.json').write_text('{"type":"module"}\n')
 shutil.copyfile(root/'packages/contracts/test/action-application-independent-types.ts',consumer/'consumer.ts')
 script="import{receiveActionResponse,ActionResponseError}from'@capiro/meri-contracts/action-application';import{validateUIEvent}from'@capiro/meri-contracts';import schema from'@capiro/meri-contracts/action-application/schema'with{type:'json'};const x=await receiveActionResponse('execute',502,JSON.stringify({error:{code:'COMMAND_OUTCOME_UNKNOWN',outcome:'UNKNOWN'}}));if(x.error.outcome!=='UNKNOWN'||typeof validateUIEvent!=='function'||!schema.$defs.ActionQueryResponse)throw Error('receiving export missing');try{await import('@capiro/meri-contracts/commands-0.2/validate.mjs');throw Error('private export exposed')}catch(e){if(e.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw e}console.log('isolated public export PASS');"
 (consumer/'check.mjs').write_text(script)
 run(['node','check.mjs'],consumer)
 run(['node',str(root/'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','consumer.ts'],consumer)
 result={'package':packed['name'],'version':packed['version'],'filename':packed['filename'],'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'integrity':packed['integrity'],'files':[x['path'] for x in packed['files']],'isolatedRuntime':'PASS','isolatedStrictTypes':'PASS','privateSourceAbsent':True,'npmInstall':False,'network':False}
 (evidence/'artifact.json').write_text(json.dumps(result,indent=2)+'\n')
finally:
 shutil.rmtree(work)
 print(json.dumps({'ownedConsumerDirectoryRemoved':not work.exists()}))
