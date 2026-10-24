/** Actual local document/session/storage owners over scripted intent-preparation SQL. */
import {randomUUID} from 'node:crypto';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalArtifactExecutor} from '../../../artifacts/local-executor.mjs';
import {createLocalArtifactStore} from '../../../artifacts/local-store.mjs';
import {nativePreparationsFixture} from '../../../artifacts/test/native-preparations-fixture.mjs';
import {createLocalDocumentPorts} from './ports.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const uuid=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
export async function createLocalDocumentFixture({mode,pythonExecutable,operation='create_word',pptxModulePath,skillManifest,mailboxIds=[],identityIds}){
 if(mode!=='synthetic-local'||typeof pythonExecutable!=='string'||!isAbsolute(pythonExecutable)||
  !['create_word','create_excel','create_powerpoint','run_analysis'].includes(operation)||
  operation==='create_powerpoint'&&(typeof pptxModulePath!=='string'||!isAbsolute(pptxModulePath))||
  !Array.isArray(mailboxIds)||mailboxIds.length>8||new Set(mailboxIds).size!==mailboxIds.length||
  mailboxIds.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id))||
  !process.env.MERI_REVIEW_SOURCE_ROOT||resolve(process.env.MERI_REVIEW_SOURCE_ROOT)!==resolve(root))throw Error('LOCAL_DOCUMENT_CONFIGURATION');
 const ids=identityIds===undefined?{tenantId:uuid(2),actorId:uuid(3)}:artifactValidators.snapshot(identityIds);
 if(Object.keys(ids).sort().join(',')!=='actorId,tenantId'||Object.values(ids).some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)))throw Error('LOCAL_DOCUMENT_CONFIGURATION');
 const binding={...ids,conversationId:uuid(1),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1},clientId=uuid(9),policyRevision='a'.repeat(64);
 const scopes=[{tenantId:ids.tenantId,kind:'client',resourceId:clientId,policyRevision},...mailboxIds.map(resourceId=>({tenantId:ids.tenantId,kind:'mailbox',resourceId,policyRevision}))];
 const now=Date.now,deadlineMs=now()+25000,context={binding,scopes,evidence:[],assets:[],deadlineMs,maxBytes:1048576};
 let manifest=null;if(skillManifest!==undefined){manifest=artifactValidators.snapshot(skillManifest);validateShape('SkillManifest',manifest);
  if(!manifest.allowedOperations.some(x=>x.id===operation&&x.version==='0.2.0')||!manifest.subjectKinds.includes('client'))throw Error('LOCAL_DOCUMENT_CONFIGURATION');}
 const preparations=nativePreparationsFixture(),state={closed:false,revoked:false,generations:0,artifactChecks:0,processReceipts:[],cleanup:null};
 const ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state});let directory,store;
 try{
  directory=await mkdtemp(join(tmpdir(),'meri-document-fixture-'));store=await createLocalArtifactStore({root:join(directory,'store'),canonicalSha256});
  const executor=createLocalArtifactExecutor({pythonExecutable,nodeExecutable:process.execPath,pptxModulePath:pptxModulePath??join(directory,'pptx-not-configured'),tempRoot:directory,timeoutMs:15000});
  const artifactOptions={pool:preparations.pool,context,validators:artifactValidators,authorize:ports.authorize,versions:store.versions,objects:store.objects,
   executor:{async execute(call){state.generations++;const result=await executor.execute(call);state.processReceipts.push(result.processReceipt);return result;}},now,
   ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})};
  const stats=()=>({mode,sourceConnected:false,nativeDatabase:false,nativeQualified:false,generations:state.generations,artifactChecks:state.artifactChecks,
   deliveries:preparations.state.rows.size,prepared:[...preparations.state.rows.values()].filter(r=>r.state==='PREPARED').length,
   unknown:[...preparations.state.rows.values()].filter(r=>r.state==='UNKNOWN').length,pending:[...preparations.state.rows.values()].filter(r=>r.state==='PENDING').length,
   skillId:manifest?.skillId??null,skillVersion:manifest?.skillVersion??null,manifestSha256:manifest?canonicalSha256(manifest):null,
   processReceipts:structuredClone(state.processReceipts),closed:state.closed,revoked:state.revoked,cleanup:state.cleanup});
  return {mode,artifactOptions,preparations,sessions:ports.sessions,selectedClientId:clientId,nativeCredential:ports.nativeCredential,now,
   limits:{maxRequestMs:15000,maxRequestBytes:131072,maxResponseBytes:1048576},directory,stats,revoke(){state.revoked=true;},
   async close(){if(state.closed)return;state.closed=true;ports.sessions.close();const remaining=await readdir(directory);
    state.cleanup={executorDirectoriesAbsent:remaining.every(name=>name==='store'),storeRemoved:false};await store.dispose();await rm(directory,{recursive:true,force:true});state.cleanup.storeRemoved=true;}};
 }catch(error){ports.sessions.close();if(store)await store.dispose();if(directory)await rm(directory,{recursive:true,force:true});throw error;}
}
