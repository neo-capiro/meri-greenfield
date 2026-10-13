/** Independent observation of real canonical HTTP flow; no credentials/private bodies retained. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const evidence=fileURLToPath(new URL('./',import.meta.url));
const outputDirectory=join(evidence,'observed-artifacts');
const sha=value=>createHash('sha256').update(value).digest('hex');
const absent=async path=>{try{await stat(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}};
const procGroups=async groups=>{
 const found=[];
 for(const name of await readdir('/proc'))if(/^\d+$/u.test(name))try{
  const fields=(await readFile('/proc/'+name+'/stat','utf8')).split(') ')[1].trim().split(/\s+/u);
  if(groups.includes(Number(fields[2])))found.push({pid:Number(name),state:fields[0],parentPid:Number(fields[1]),group:Number(fields[2])});
 }catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw error;}
 return found;
};
process.env.MERI_REVIEW_SOURCE_ROOT=root;
const [{createLocalDocumentFixture},{mountLocalDocumentApplication},{runLocalResearchBriefFlow},{briefManifest},{listenActionApplication}]=await Promise.all([
 import('../../../../../apps/control/document-application/local/fixture.mjs'),import('../../../../../apps/control/document-application/local/mount.mjs'),
 import('../../../../../apps/control/document-application/research-brief/local/flow.mjs'),import('../../../../../apps/control/document-application/research-brief/skill.mjs'),
 import('../../../../../apps/control/action-application/node-http.mjs')]);
let fixture,other,server,app,result,failure,listenerPort,revoked=false,reconfigurations=0;
const trace=[],storage=[];
async function observe(response,path,body,channel){
 const bytes=Buffer.from(await response.clone().arrayBuffer());
 let decoded;try{decoded=JSON.parse(bytes);}catch{}
 trace.push({sequence:trace.length+1,phase:revoked?'revoked':'current',channel,path,deliveryId:body.deliveryId??null,
  requestedVersionId:body.versionId??body.baseVersionId??null,status:response.status,bodyBytes:bytes.length,bodySha256:sha(bytes),
  errorCode:decoded?.error?.code??null,errorOutcome:decoded?.error?.outcome??null,returnedVersionId:decoded?.version?.versionId??null,
  currentBytesVerified:decoded?.inspection?.currentBytesVerified??null,
  downloadHeaders:path.endsWith('/download')?Object.fromEntries(['content-type','content-disposition','cache-control','x-content-type-options'].map(name=>[name,response.headers.get(name)])):null});
 return response;
}
try{
 await mkdir(outputDirectory,{mode:0o700});
 fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:process.argv[2],skillManifest:briefManifest()});
 other=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:process.argv[2],skillManifest:briefManifest()});
 assert.notEqual(fixture.directory,other.directory);
 const originalRevoke=fixture.revoke;fixture.revoke=()=>{revoked=true;originalRevoke();};
 app=mountLocalDocumentApplication(fixture);const otherApp=mountLocalDocumentApplication(other);
 server=await listenActionApplication({app:{handle:request=>app.handle(request)},host:'127.0.0.1',port:0,lifetimeMs:25000});
 listenerPort=Number(new URL(server.origin).port);
 const send=async(path,body,credential)=>observe(await fetch(server.origin+path,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}),path,body,'loopback-http');
 result=await runLocalResearchBriefFlow({fixture,send,pythonExecutable:process.argv[2],sofficeExecutable:process.argv[3],outputDirectory,
  reconfigure:async prepared=>{reconfigurations++;app=mountLocalDocumentApplication({...fixture,artifactOptions:{...fixture.artifactOptions,context:prepared.context}},{researchBrief:prepared});},
  checkIsolation:async({versionId,credential})=>{
   const otherSend=async(path,body,token)=>observe(await otherApp.handle(new Request('https://isolated.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)})),path,body,'separate-store');
   assert.equal((await otherSend('/api/documents/download',{versionId},credential)).status,403);
   const own=await otherSend('/api/action-followthrough/session',{},other.nativeCredential);assert.equal(own.status,200);const session=await own.json();
   assert.notEqual(session.credential,credential);
   assert.equal((await otherSend('/api/documents/download',{versionId},session.credential)).status,502);
   assert.equal(other.stats().generations,0);assert.equal(other.stats().consumedMicroUsd,'0');
  }});
 for(const item of [fixture,other])storage.push({directory:item.directory,existedBeforeClose:!await absent(item.directory),contentsBeforeClose:await readdir(item.directory)});
 assert.equal(reconfigurations,3);
 const successfulDownloads=trace.filter(item=>item.path.endsWith('/download')&&item.status===200);
 assert.equal(successfulDownloads.length,3);
 assert.deepEqual(successfulDownloads.map(item=>item.bodySha256),[result.versions[0].object.sha256,result.versions[0].object.sha256,result.versions[1].object.sha256]);
 assert.equal(trace.filter(item=>item.phase==='revoked'&&item.path.endsWith('/inspect')).length,2);
 assert.equal(trace.filter(item=>item.phase==='revoked'&&item.path.endsWith('/download')).length,2);
 assert.ok(trace.filter(item=>item.phase==='revoked').every(item=>item.status===403));
 const inspected=trace.filter(item=>item.currentBytesVerified!==null);assert.ok(inspected.length>=3);assert.ok(inspected.every(item=>item.currentBytesVerified===true));
 assert.deepEqual(storage.map(item=>item.contentsBeforeClose),[['store'],['store']]);
}catch(error){failure={name:error.name,code:error.code??null,message:String(error.message),receipt:error.receipt??null};}
finally{
 for(const resource of [server,other,fixture])try{await resource?.close();}catch(error){failure??={message:'cleanup '+String(error.message)};}
 delete process.env.MERI_REVIEW_SOURCE_ROOT;
}
const stats=[fixture,other].filter(Boolean).map(item=>item.stats());
for(const record of storage)record.absentAfterClose=await absent(record.directory);
const processIds=[...stats.flatMap(item=>item.processReceipts.map(process=>process.pid)),...(result?.rendered??[]).flatMap(item=>item.processes.map(process=>process.pid))];
const remainingProcessGroups=await procGroups(processIds);
const processPaths=await Promise.all(processIds.map(async pid=>({pid,procAbsent:await absent('/proc/'+pid)})));
const listeners=[];
if(listenerPort)for(const name of ['/proc/net/tcp','/proc/net/tcp6']){
 const lines=(await readFile(name,'utf8')).trim().split('\n').slice(1);
 for(const line of lines){const fields=line.trim().split(/\s+/u);if(parseInt(fields[1].split(':')[1],16)===listenerPort&&fields[3]==='0A')listeners.push({source:name,line});}
}
const cleanup={http:server?.status()??null,listenerPort,rawListenerMatches:listeners,storage,processIds,processPaths,remainingProcessGroups,fixtureStats:stats};
const passed=!failure&&processPaths.every(item=>item.procAbsent)&&!remainingProcessGroups.length&&!listeners.length&&storage.every(item=>item.absentAfterClose)&&stats.every(item=>item.closed&&item.cleanup?.executorDirectoriesAbsent&&item.cleanup?.storeRemoved)&&cleanup.http?.closed&&!cleanup.http?.listening&&cleanup.http?.activeSockets===0;
const report={status:passed?'PASS':'FAIL',nativeQualified:false,nativeDatabase:false,productionActivated:false,transport:'loopback-http',sourceRoot:root,
 dependencyResolution:'Existing installed dependencies read via review-only loader; no install',reconfigurations,trace,cleanup,result:result??null,failure:failure??null};
await writeFile(join(evidence,'observed-lifecycle.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:report.status,traceEntries:trace.length,cleanup,reconfigurations,failure:report.failure}));
process.exitCode=passed?0:1;
