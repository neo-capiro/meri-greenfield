"""Owned isolated package install smoke; no publish, application or service launch."""
import hashlib,json,os,pathlib,subprocess,tempfile,time,shutil
root=pathlib.Path(__file__).resolve().parents[5]
packet=pathlib.Path(__file__).resolve().parent
work=pathlib.Path(tempfile.mkdtemp(prefix='meri-action-wire-package-'))
records=[]
def run(label,args,cwd):
    started=time.time();p=subprocess.Popen(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,env={**os.environ,'npm_config_update_notifier':'false','npm_config_audit':'false','npm_config_fund':'false','npm_config_cache':str(work/'npm-cache')})
    out,err=p.communicate(timeout=240)
    (packet/(label+'.stdout.txt')).write_bytes(out);(packet/(label+'.stderr.txt')).write_bytes(err)
    records.append({'label':label,'argv':args,'exit':p.returncode,'seconds':time.time()-started,'pid':p.pid,'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrSha256':hashlib.sha256(err).hexdigest()})
    if p.returncode: raise RuntimeError(label+' failed')
    return out
try:
    raw=run('pack',['npm','pack',str(root/'packages/contracts'),'--ignore-scripts','--json','--pack-destination',str(work)],root)
    pack=json.loads(raw)[0];tgz=work/pack['filename'];tarhash=hashlib.sha256(tgz.read_bytes()).hexdigest()
    (work/'package.json').write_text('{"name":"isolated-action-receiver","private":true,"type":"module"}\n')
    run('install',['npm','install','--ignore-scripts','--omit=dev','--no-audit','--no-fund',str(tgz)],work)
    fixture=root/'docs/qualification/candidates/action-wiring-20261013/integration/wire-fixtures.json'
    (work/'smoke.mjs').write_text("import{readFile}from'node:fs/promises';import{receiveActionResponse}from'@capiro/meri-contracts/action-application';import{metadata}from'@capiro/meri-contracts/metadata';const f=JSON.parse(await readFile("+json.dumps(str(fixture))+"));for(const s of f.steps)await receiveActionResponse(s.route,s.httpStatus,JSON.stringify(s.response));if(metadata.contractVersion!=='0.1.0')throw Error('old drift');console.log(JSON.stringify({steps:f.steps.length,packageVersion:'0.1.1',oldWire:'0.1.0'}));\n")
    run('installed-smoke',['node','smoke.mjs'],work)
    shutil.copyfile(root/'packages/contracts/test/action-application-public-types.ts',work/'consumer.ts')
    run('installed-types',['node',str(root/'packages/contracts/node_modules/typescript/bin/tsc'),'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','consumer.ts'],work)
    result={'status':'PASS','package':pack['name'],'version':pack['version'],'tarballSha256':tarhash,'tarballBytes':tgz.stat().st_size,'packIntegrity':pack['integrity'],'records':records,'noPublish':True,'noSourceApplicationExecution':True}
finally:
    shutil.rmtree(work)
    result=locals().get('result',{'status':'FAIL','records':records})
    result['ownedTempAbsent']=not work.exists()
    (packet/'install-verification.json').write_text(json.dumps(result,indent=2)+'\n')
