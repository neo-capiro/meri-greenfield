/** Final binder regression through canonical current authority + real HTTP graph; creates no DOCX. */
import assert from 'node:assert/strict';
import {GatewayDenied} from '../../../../../../apps/gateway/dispatch/operation-result.mjs';
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../../../',import.meta.url));
const here=fileURLToPath(new URL('./',import.meta.url));
process.env.MERI_REVIEW_SOURCE_ROOT=root;
const [{createLocalDocumentFixture},{mountLocalDocumentApplication},{createCongressionalBriefCompiler},{syntheticInput,syntheticRead},{bindPreparedBriefArtifactOptions},{briefManifest},{listenActionApplication}]=await Promise.all([
 import('../../../../../../apps/control/document-application/local/fixture.mjs'),import('../../../../../../apps/control/document-application/local/mount.mjs'),
 import('../../../../../../apps/control/document-application/research-brief/compose.mjs'),import('../../../../../../apps/control/document-application/research-brief/local/synthetic.mjs'),
 import('../../../../../../apps/control/document-application/research-brief/binding.mjs'),import('../../../../../../apps/control/document-application/research-brief/skill.mjs'),
 import('../../../../../../apps/control/action-application/node-http.mjs')]);
let fixture,server,failure,stats,port,directory;const checks=[],trace=[];
const denied=error=>error.code==='ACCESS_DENIED';
try{
 fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:process.argv[2],skillManifest:briefManifest()});directory=fixture.directory;
 const compiler=createCongressionalBriefCompiler({now:fixture.now,readSource:async call=>syntheticRead(call)});
 const prepared=await compiler.prepare(syntheticInput(new Date(fixture.now()).toISOString()),fixture.artifactOptions.context);
 const original=fixture.artifactOptions.authority,signal=new AbortController().signal;let delegated=0,expectedCall;
 const authority={marker:'borrowed-owner',async check(value){assert.equal(this,authority);assert.equal(value,expectedCall);assert.equal(value.signal,signal);delegated++;return original.check(value);}};
 const bound=bindPreparedBriefArtifactOptions(prepared,{...fixture.artifactOptions,context:prepared.context,authority});
 const call=()=>({credential:fixture.credential,descriptor:fixture.artifactOptions.descriptor,input:{request:structuredClone(prepared.request),context:structuredClone(prepared.context),baseVersionId:null},signal,limitDeadline:()=>{}});
 expectedCall=call();const receipt=await bound.authority.check(expectedCall);assert.equal(receipt.decision.decision,'allowed');assert.equal(delegated,1);
 checks.push('Exact borrowed authority receiver/call/signal preserved; canonical current authority allowed exact intent');
 const hash=prepared.context.evidence[0].contentSha256;prepared.context.evidence[0].contentSha256='a'.repeat(64);
 expectedCall=call();await assert.rejects(bound.authority.check(expectedCall),denied);assert.equal(delegated,1);prepared.context.evidence[0].contentSha256=hash;
 checks.push('Mutating aliased prepared/returned context after binding rejected before borrowed owner');
 const title=prepared.request.content.blocks[0].runs[0].text;prepared.request.content.blocks[0].runs[0].text='Mutated prepared request';
 expectedCall=call();await assert.rejects(bound.authority.check(expectedCall),denied);assert.equal(delegated,1);prepared.request.content.blocks[0].runs[0].text=title;
 checks.push('Mutating returned prepared request cannot replace immutable original request pin');
 expectedCall=call();expectedCall.input.baseVersionId='00000000-0000-4000-8000-000000000077';await assert.rejects(bound.authority.check(expectedCall),denied);assert.equal(delegated,1);
 checks.push('Wrong exact parent rejected before borrowed owner');
 authority.check=()=>{throw Error('REPLACED_BORROWED_METHOD');};expectedCall=call();const retained=await bound.authority.check(expectedCall);assert.equal(retained.decision.decision,'allowed');assert.equal(delegated,2);
 checks.push('Original validated authority method captured even if borrowed object method later replaced');
 let accessorReads=0;const accessor={get check(){accessorReads++;return original.check;}};
 assert.throws(()=>bindPreparedBriefArtifactOptions(prepared,{...fixture.artifactOptions,context:prepared.context,authority:accessor}),/BRIEF_CONFIGURATION/u);assert.equal(accessorReads,0);
 assert.throws(()=>bindPreparedBriefArtifactOptions(prepared,{...fixture.artifactOptions,context:prepared.context,authority:new Proxy(original,{})}),/BRIEF_CONFIGURATION/u);
 checks.push('Accessor/proxy authority configuration refused without invoking accessor');
 const app=mountLocalDocumentApplication({...fixture,artifactOptions:{...fixture.artifactOptions,context:prepared.context}},{researchBrief:prepared});
 server=await listenActionApplication({app:{handle:request=>app.handle(request)},host:'127.0.0.1',port:0,lifetimeMs:25000});port=Number(new URL(server.origin).port);
 const send=async(path,body,credential)=>{const response=await fetch(server.origin+path,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});const decoded=await response.json();trace.push({path,status:response.status,deliveryId:body.deliveryId??null,errorCode:decoded.error?.code??null,errorOutcome:decoded.error?.outcome??null,generations:fixture.stats().generations,reservations:fixture.stats().versionCharges});return {response,decoded};};
 const issued=await send('/api/action-followthrough/session',{},fixture.nativeCredential);assert.equal(issued.response.status,200);const credential=issued.decoded.credential;
 const substituted=structuredClone(prepared.request);substituted.content.blocks[0].runs[0].text='Post-bind request substitution';
 for(const [route,body]of [['create',{deliveryId:'final-substitution',request:substituted}],['revise',{deliveryId:'final-wrong-parent',baseVersionId:'00000000-0000-4000-8000-000000000077',request:prepared.request}]]){
  const result=await send('/api/documents/'+route,body,credential);assert.equal(result.response.status,403);assert.equal(result.decoded.error.code,'ACCESS_DENIED');assert.equal(result.decoded.error.outcome,'UNKNOWN');assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);
 }
 checks.push('Real unchanged HTTP graph substitution/wrong-parent deny with zero reservation/generation');
 const missing='00000000-0000-4000-8000-000000000099';for(const route of ['inspect','download'])assert.equal((await send('/api/documents/'+route,{versionId:missing},credential)).response.status,502);
 fixture.revoke();for(const route of ['inspect','download'])assert.equal((await send('/api/documents/'+route,{versionId:missing},credential)).response.status,403);
 const revoked=await send('/api/documents/revise',{deliveryId:'final-revoked',baseVersionId:missing,request:prepared.request},credential);assert.equal(revoked.response.status,403);
 expectedCall=call();await assert.rejects(bound.authority.check(expectedCall),error=>error instanceof GatewayDenied&&error.message==='ACCESS_DENIED');assert.equal(delegated,3);
 checks.push('Existing inspect/download remain routed; revoked graph and original current-authority policy still deny');
 assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);assert.equal(fixture.stats().processReceipts.length,0);
 checks.push('No DOCX generated, no generator process, no reservation/settlement/unknown accounting allocated');
}catch(error){failure={name:error.name,code:error.code??null,message:String(error.message)};}
finally{try{await server?.close();await fixture?.close();}catch(error){failure??={message:'cleanup '+String(error.message)};}stats=fixture?.stats();delete process.env.MERI_REVIEW_SOURCE_ROOT;}
let storeAbsent=false;if(directory)try{await stat(directory);}catch(error){if(error.code==='ENOENT')storeAbsent=true;else throw error;}
const listeners=[];if(port)for(const path of ['/proc/net/tcp','/proc/net/tcp6'])for(const line of (await readFile(path,'utf8')).trim().split('\n').slice(1)){const fields=line.trim().split(/\s+/u);if(parseInt(fields[1].split(':')[1],16)===port&&fields[3]==='0A')listeners.push({path,line});}
const cleanup={http:server?.status()??null,port,listeners,directory,storeAbsent,stats};
const pass=!failure&&storeAbsent&&!listeners.length&&cleanup.http?.closed&&!cleanup.http?.listening&&cleanup.http?.activeSockets===0&&stats?.closed&&stats.cleanup?.executorDirectoriesAbsent&&stats.cleanup?.storeRemoved&&stats.generations===0&&stats.versionCharges===0;
const report={status:pass?'PASS':'FAIL',reviewedCommit:'086cb8960a8cd314d97b484198660c171d63272f',reviewedTree:'05f5f71e3eb93cd0096f0b14d16ea6b011d87dae',checks,trace,cleanup,failure:failure??null,scope:'Final binder/canonical current authority and HTTP graph only; prior exact rendered DOCX evidence transferred by byte audit',nativeQualified:false,nativeDatabase:false,productionActivated:false};
await writeFile(here+'guard-and-graph-rerun.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(report));process.exitCode=pass?0:1;
