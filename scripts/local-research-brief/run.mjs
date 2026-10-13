#!/usr/bin/env node
/** Opt-in synthetic demonstration of the production brief compiler and document owners. */
import assert from 'node:assert/strict';
import {mkdir,stat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const usage='Usage: node scripts/local-research-brief/run.mjs --run --python /absolute/python --soffice /absolute/soffice --output /absolute/new-directory | --help\nCreate/revise and inspect/download actual DOCX via unchanged loopback HTTP routes; reopen and render every page of retained synthetic downloads. Sources/identity/SQL synthetic; no model/database/cloud or native qualification. Exit0 success/help;1 run/cleanup failure;2 invalid usage.\n';
export async function main(args=process.argv.slice(2),write=text=>process.stdout.write(text)){
  if(args.length===1&&args[0]==='--help'){write(usage);return 0;}
  if(args.length!==7||args[0]!=='--run'||args[1]!=='--python'||args[3]!=='--soffice'||args[5]!=='--output'||![args[2],args[4],args[6]].every(isAbsolute)){write(usage);return 2;}
  const root=fileURLToPath(new URL('../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;let fixture,other,server,app,result,failure,cleanupFailure;
  try{
    if(previous!==undefined&&resolve(previous)!==resolve(root))throw Error('LOCAL_BRIEF_CONFIGURATION');
    for(const executable of [args[2],args[4]])if(!(await stat(executable)).isFile())throw Error('LOCAL_BRIEF_CONFIGURATION');
    await mkdir(args[6],{mode:0o700});process.env.MERI_REVIEW_SOURCE_ROOT=root;
    const [{createLocalDocumentFixture},{mountLocalDocumentApplication},{runLocalResearchBriefFlow},{briefManifest},{listenActionApplication}]=await Promise.all([
      import('../../apps/control/document-application/local/fixture.mjs'),import('../../apps/control/document-application/local/mount.mjs'),
      import('../../apps/control/document-application/research-brief/local/flow.mjs'),import('../../apps/control/document-application/research-brief/skill.mjs'),import('../../apps/control/action-application/node-http.mjs')]);
    fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:args[2],skillManifest:briefManifest()});
    other=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:args[2],skillManifest:briefManifest()});assert.notEqual(fixture.directory,other.directory);
    app=mountLocalDocumentApplication(fixture);const otherApp=mountLocalDocumentApplication(other);
    server=await listenActionApplication({app:{handle:request=>app.handle(request)},host:'127.0.0.1',port:0,lifetimeMs:25000});
    const send=(path,body,credential)=>fetch(server.origin+path,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
    result=await runLocalResearchBriefFlow({fixture,send,pythonExecutable:args[2],sofficeExecutable:args[4],outputDirectory:args[6],
      reconfigure:async prepared=>{app=mountLocalDocumentApplication({...fixture,artifactOptions:{...fixture.artifactOptions,context:prepared.context}},{researchBrief:prepared});},
      checkIsolation:async({versionId,credential})=>{
        const otherSend=(path,body,token)=>otherApp.handle(new Request('https://isolated.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
        assert.equal((await otherSend('/api/documents/download',{versionId},credential)).status,403);
        const own=await otherSend('/api/action-followthrough/session',{},other.nativeCredential);assert.equal(own.status,200);const session=await own.json();assert.notEqual(session.credential,credential);
        assert.notEqual((await otherSend('/api/documents/download',{versionId},session.credential)).status,200);
        assert.equal(other.stats().generations,0);assert.equal(other.stats().consumedMicroUsd,'0');
      }});
  }catch(error){failure={name:error?.name??'Error',code:error?.code??'LOCAL_BRIEF_FAILURE',message:String(error?.message??'').slice(0,2048),...(error?.receipt?{process:error.receipt}:{})};}
  finally{
    for(const resource of [server,other,fixture])try{await resource?.close();}catch{cleanupFailure=true;}
    if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;
  }
  const stats=[fixture,other].filter(Boolean).map(x=>x.stats()),http=server?.status();
  if(stats.some(x=>!x.closed||!x.cleanup?.executorDirectoriesAbsent||!x.cleanup?.storeRemoved)||http&&(!http.closed||http.listening||http.activeSockets))cleanupFailure=true;
  write(JSON.stringify({status:failure||cleanupFailure?'FAIL':'PASS',mode:'synthetic-local',transport:'loopback-http',nativeDatabase:false,nativeQualified:false,productionActivated:false,outputDirectory:args[6],...(result?{result}:{}),...(failure?{failure}:{}),cleanup:{failed:Boolean(cleanupFailure),http:http??null,fixtures:stats}})+'\n');
  return failure||cleanupFailure?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
