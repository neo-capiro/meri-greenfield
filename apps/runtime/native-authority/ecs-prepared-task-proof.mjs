/** Borrowed ECS reads bind the running task to the approved immutable image.
 * The runner pin measures the local image's entrypoint bytes, never an environment
 * echo. The runner also measures those bytes at startup. This is not a remote
 * filesystem attestation; source closure/dependencies are pinned by image digest. */
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DescribeTasksCommand,DescribeTaskDefinitionCommand} from '@aws-sdk/client-ecs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileEcsTaskBinding,assertEcsOwnedTask,assertEcsRunningTask} from './ecs-task-binding.mjs';
import {executionFault} from './execution-broker.mjs';
const fields=['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'],digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),refuse=()=>{throw executionFault('ECS_PREPARATION_REFUSED');};
export const productRunnerMeasurement=Object.freeze({contract:'meri.runner-entrypoint.v1',path:'apps/runtime/conversation-runner.mjs'});
const imageRoot=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
/** SHA-256 of the complete raw entrypoint file bytes, without newline conversion,
 * BOM removal, path metadata or a JSON wrapper. Image digest pins all other files.
 * root is a trusted caller/test boundary; no ambient environment/config is read. */
export async function measureProductRunner({root=imageRoot,signal}={}){
 nativeSignal(signal);if(typeof root!=='string'||root!==resolve(root)||signal?.aborted)refuse();
 const target=join(root,...productRunnerMeasurement.path.split('/'));
 let cursor=parse(target).root;
 for(const part of target.slice(cursor.length).split(/[\\/]/u)){cursor=join(cursor,part);const stat=await lstat(cursor);if(stat.isSymbolicLink())refuse();}
 let file;try{file=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));const before=await file.stat();
  if(!before.isFile()||before.size<1||before.size>1024*1024||signal?.aborted)refuse();
  // One bounded extra byte detects growth without allowing readFile to allocate
  // arbitrarily after the initial stat. Every positional read rechecks cancel.
  const buffer=Buffer.alloc(before.size+1);let length=0;
  while(length<buffer.length){if(signal?.aborted)refuse();const read=await file.read(buffer,length,buffer.length-length,length);if(read.bytesRead===0)break;length+=read.bytesRead;}
  const bytes=buffer.subarray(0,length),after=await file.stat();
  if(length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||signal?.aborted)refuse();
  return Object.freeze({...productRunnerMeasurement,runnerSha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 }finally{await file?.close();}
}
export async function assertProductRunnerMeasurement(value){
 const c=own(value,['expectedSha256'],['root','signal']);if(!digest(c.expectedSha256))refuse();
 const measured=await measureProductRunner({...(c.root===undefined?{}:{root:c.root}),signal:c.signal});
 if(measured.runnerSha256!==c.expectedSha256)refuse();return measured;
}
function metadata(value){const v=data(own(value,fields,['grantFactsJsons','launchBinding','physicalStopProven']));return Object.fromEntries(fields.map(k=>[k,v[k]]));}
function environment(rows){if(!Array.isArray(rows))refuse();const result=new Map();for(const row of rows){if(!row||typeof row.name!=='string'||typeof row.value!=='string'||result.has(row.name))refuse();result.set(row.name,row.value);}return result;}
export function createEcsPreparedTaskProof(configuration){
 const c=own(configuration,['client','original','metadata','imageSha256','runnerSha256'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,m=metadata(c.metadata),binding=compileEcsTaskBinding({...m,original:c.original,enabled:true,now,maxRequestMs}),original=binding.original,send=storageMethod(c.client,'send');
 if(!digest(c.imageSha256)||!digest(c.runnerSha256)||original.versions.imageDigest!=='sha256:'+c.imageSha256||binding.prefix!=='arn:aws:ecs:us-east-1:967807252336:')refuse();
 const image='sha256:'+c.imageSha256;
 function fresh(signal){if(signal?.aborted||now()>=original.expiresAtMs)refuse();}
 function taskPins(task){assertEcsOwnedTask(task,binding);assertEcsRunningTask(task,binding);if(task.containers[0].imageDigest!==image||!task.containers[0].image.endsWith('@'+image))refuse();
  const overrides=task.overrides?.containerOverrides;if(overrides!==undefined){if(!Array.isArray(overrides)||overrides.length>1)refuse();for(const worker of overrides){if(worker.name!==binding.containerName)refuse();const env=environment(worker.environment??[]);for(const [name,pin] of [['MERI_RUNNER_SHA256',c.runnerSha256],['MERI_IMAGE_SHA256',c.imageSha256]])if(env.has(name)&&env.get(name)!==pin)refuse();}}
 }
 async function verifyTask(value){const v=own(value,['original','resource'],['signal']);nativeSignal(v.signal);if(hash(data(v.original))!==hash(original)||hash(metadata(v.resource))!==hash(m))refuse();fresh(v.signal);
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(now()+maxRequestMs,original.expiresAtMs),errorFactory:()=>executionFault('ECS_PREPARATION_UNKNOWN')});
  const call=command=>life.run(signal=>send(command,{abortSignal:signal}));
  async function describe(){const response=await call(new DescribeTasksCommand({cluster:binding.clusterArn,tasks:[binding.taskArn],include:['TAGS']}));if(!Array.isArray(response.tasks)||response.tasks.length!==1||response.failures?.length)refuse();taskPins(response.tasks[0]);fresh(life.signal);}
  try{const measured=await life.run(signal=>assertProductRunnerMeasurement({expectedSha256:c.runnerSha256,signal}));await describe();const response=await call(new DescribeTaskDefinitionCommand({taskDefinition:binding.taskDefinitionArn})),definition=response.taskDefinition;
   if(!definition||definition.taskDefinitionArn!==binding.taskDefinitionArn||definition.status!=='ACTIVE'||definition.networkMode!=='awsvpc'||!Array.isArray(definition.requiresCompatibilities)||!definition.requiresCompatibilities.includes('FARGATE')||definition.runtimePlatform?.operatingSystemFamily!==undefined&&definition.runtimePlatform.operatingSystemFamily!=='LINUX'||!Array.isArray(definition.containerDefinitions)||definition.containerDefinitions.length!==1)refuse();
   const worker=definition.containerDefinitions[0],env=environment(worker?.environment);if(worker.name!==binding.containerName||typeof worker.image!=='string'||!worker.image.endsWith('@'+image)||env.get('MERI_RUNNER_SHA256')!==c.runnerSha256||env.has('MERI_IMAGE_SHA256')&&env.get('MERI_IMAGE_SHA256')!==c.imageSha256||worker.secrets?.some(row=>row.name==='MERI_RUNNER_SHA256'||row.name==='MERI_IMAGE_SHA256'))refuse();
   await describe();life.check();fresh(life.signal);return data({taskArn:binding.taskArn,imageSha256:c.imageSha256,runnerSha256:measured.runnerSha256,checkedAtMs:now(),expiresAtMs:original.expiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({verifyTask});
}
