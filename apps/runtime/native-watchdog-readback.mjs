import {assertNativeObserver,assertNativeObserverPlacement,assertNativeObserverInput,nativeObserverDeadline} from '../../packages/contracts/native-observer.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REGION=/^[a-z]{2}-[a-z]+-[0-9]$/u,ACCOUNT=/^[0-9]{12}$/u;
const ARN=/^arn:aws:states:([a-z]{2}-[a-z]+-[0-9]):([0-9]{12}):stateMachine:([A-Za-z0-9_-]{1,80}):([0-9]{1,8})$/u;
const EXECUTION=/^arn:aws:states:([a-z]{2}-[a-z]+-[0-9]):([0-9]{12}):execution:([A-Za-z0-9_-]{1,80}):([A-Za-z0-9_-]{1,80})$/u;
const fault=(message,error)=>Object.assign(Error(message,error===undefined?undefined:{cause:error}),{code:message});

/** Read back the EXISTING prearmed watchdog execution. This owner never starts, stops or replaces an execution. */
export function createManagedWatchdogReadback({stateMachineVersionArn,definitionSha256,qualificationEvidenceSha256,
 now=Date.now}) {
 const machine=ARN.exec(stateMachineVersionArn??'');
 if(!machine||typeof definitionSha256!=='string'||!/^[0-9a-f]{64}$/u.test(definitionSha256)||
  typeof qualificationEvidenceSha256!=='string'||!/^[0-9a-f]{64}$/u.test(qualificationEvidenceSha256))
  throw fault('NATIVE_WATCHDOG_CONFIGURATION');
 const region=machine[1],accountId=machine[2],name=machine[3];
 const stateMachineArn=stateMachineVersionArn.replace(/:[1-9][0-9]*$/u,'');
 const executionName=(hostId,generation)=>`${hostId}-g${generation}`;
 const executionArn=(hostId,generation)=>`arn:aws:states:${region}:${accountId}:execution:${name}:${executionName(hostId,generation)}`;
 const sha=async value=>{const {canonicalSha256}=await import('../../packages/contracts/validate.mjs');return canonicalSha256(value);};
 async function makeIntent({hostId,generation,t0Ms,deadlineMs,leaseDeadlineMs,cleanupCeilingMs,
  allocationSha256,sourceCommit,imageDigest,bootstrapSha256,nativeHelperSha256,placementSha256,launchSha256,
  controlPolicySha256,provisionToken,physicalObserver,placement,launch}){
  if(physicalObserver===undefined)throw fault('NATIVE_WATCHDOG_REFUSED');
  const cleanup=cleanupCeilingMs===undefined?deadlineMs:cleanupCeilingMs;
  const lease=leaseDeadlineMs===undefined?cleanup:leaseDeadlineMs;
  if(!UUID.test(hostId??'')||!Number.isSafeInteger(generation)||generation<1||!Number.isSafeInteger(t0Ms)||
   !Number.isSafeInteger(cleanup)||cleanup<=t0Ms||cleanup<=now()||!Number.isSafeInteger(lease)||
   lease<=t0Ms||lease>cleanup||
   typeof allocationSha256!=='string'||!/^[0-9a-f]{64}$/u.test(allocationSha256)||
   typeof sourceCommit!=='string'||!/^[0-9a-f]{40}$/u.test(sourceCommit)||
   typeof imageDigest!=='string'||!/^sha256:[0-9a-f]{64}$/u.test(imageDigest)||
   typeof bootstrapSha256!=='string'||!/^[0-9a-f]{64}$/u.test(bootstrapSha256)||
   (nativeHelperSha256!==undefined&&!/^[0-9a-f]{64}$/u.test(nativeHelperSha256))||
   typeof placementSha256!=='string'||!/^[0-9a-f]{64}$/u.test(placementSha256)||
   typeof launchSha256!=='string'||!/^[0-9a-f]{64}$/u.test(launchSha256)||
   typeof controlPolicySha256!=='string'||!/^[0-9a-f]{64}$/u.test(controlPolicySha256)||
   (provisionToken!==undefined&&(typeof provisionToken!=='string'||!/^[0-9a-f]{64}$/u.test(provisionToken))))
   throw fault('NATIVE_WATCHDOG_REFUSED');
  const v2=physicalObserver!==undefined;
  let observer,protectedInput;
  if(v2){
   observer=assertNativeObserver(physicalObserver,{accountId,region});
   protectedInput=assertNativeObserverPlacement(placement,launch);
   if(await sha(placement)!==placementSha256||await sha(launch)!==launchSha256||
    cleanup!==nativeObserverDeadline(lease)||provisionToken===undefined)throw fault('NATIVE_WATCHDOG_REFUSED');
  }else if(placement!==undefined||launch!==undefined)throw fault('NATIVE_WATCHDOG_REFUSED');
  const input=Object.freeze({schema:v2?'meri-native-watchdog-input/2':'meri-native-watchdog-input/1',hostId,generation,accountId,region,
   ...(v2?{physicalObserver:observer,...protectedInput}:{}),
   allocationSha256,sourceCommit,imageDigest,bootstrapSha256,
   ...(nativeHelperSha256!==undefined?{nativeHelperSha256}:{}),placementSha256,launchSha256,controlPolicySha256,
   ...(provisionToken!==undefined?{provisionToken}:{}),originalT0Ms:t0Ms,deadlineMs:cleanup,
   leaseDeadlineMs:lease,cleanupCeilingMs:cleanup,executionName:executionName(hostId,generation)});
  return Object.freeze({schema:'meri-native-watchdog-intent/1',executionName:executionName(hostId,generation),
   executionArn:executionArn(hostId,generation),stateMachineVersionArn,definitionSha256,
   qualificationEvidenceSha256,t0Ms,deadlineMs:cleanup,leaseDeadlineMs:lease,cleanupCeilingMs:cleanup,
   inputSha256:await sha(input),input});
 }
 async function validateIntentStructure(intent){
  if(intent?.input?.schema==='meri-native-watchdog-input/2')assertNativeObserverInput(intent.input);
  if(!intent||intent.schema!=='meri-native-watchdog-intent/1'||intent.stateMachineVersionArn!==stateMachineVersionArn||
   intent.definitionSha256!==definitionSha256||intent.qualificationEvidenceSha256!==qualificationEvidenceSha256||
   intent.executionArn!==executionArn(intent.input?.hostId,intent.input?.generation)||
   intent.executionName!==executionName(intent.input?.hostId,intent.input?.generation)||
   intent.input?.executionName!==intent.executionName||intent.input?.originalT0Ms!==intent.t0Ms||
   intent.input?.deadlineMs!==intent.deadlineMs||intent.input?.leaseDeadlineMs!==intent.leaseDeadlineMs||
   intent.input?.cleanupCeilingMs!==intent.cleanupCeilingMs||await sha(intent.input)!==intent.inputSha256)
   throw fault('NATIVE_WATCHDOG_REFUSED');
  if(!Number.isSafeInteger(intent.t0Ms)||!Number.isSafeInteger(intent.leaseDeadlineMs)||
   !Number.isSafeInteger(intent.cleanupCeilingMs)||intent.leaseDeadlineMs<=intent.t0Ms||
   intent.cleanupCeilingMs<intent.leaseDeadlineMs)throw fault('NATIVE_WATCHDOG_REFUSED');
  return true;
 }
 async function validateIntent(intent){
  await validateIntentStructure(intent);
  if(intent.cleanupCeilingMs<=now())throw fault('NATIVE_WATCHDOG_REFUSED');
  return true;
 }
 async function boundedCall({stepFunctions,command,signal,timeoutMs=10000}){
  const life=new AbortController();let listener,timer;
  const cancelled=new Promise((_,reject)=>{listener=()=>reject(fault('NATIVE_WATCHDOG_CANCELLED'));
   life.signal.addEventListener('abort',listener,{once:true});});
  const onAbort=()=>life.abort();signal?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>life.abort(),timeoutMs);timer.unref?.();
  if(signal?.aborted)life.abort();
  try{
   const value=await Promise.race([stepFunctions.send(command,{abortSignal:life.signal}),cancelled]);
   if(life.signal.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
   return value;
  }finally{clearTimeout(timer);life.signal.removeEventListener('abort',listener);
   signal?.removeEventListener('abort',onAbort);}
 }
 async function acceptedDefinition({stepFunctions,signal}){
  const sdk=stepFunctions.sdk??await import('@aws-sdk/client-sfn');
  const version=await boundedCall({stepFunctions,command:new sdk.DescribeStateMachineCommand({
   stateMachineArn:stateMachineVersionArn}),signal});
  if(!version||version.type!=='STANDARD'||version.status!=='ACTIVE'||
   version.stateMachineArn!==stateMachineVersionArn||typeof version.revisionId!=='string'||
   typeof version.definition!=='string')throw fault('NATIVE_WATCHDOG_REFUSED');
  const {createHash}=await import('node:crypto');
  if(createHash('sha256').update(version.definition,'utf8').digest('hex')!==definitionSha256)
   throw fault('NATIVE_WATCHDOG_REFUSED');
  return version;
 }
 async function readbackIntentAt({stepFunctions,intent,signal}){
  await validateIntent(intent);
  const sdk=stepFunctions.sdk??await import('@aws-sdk/client-sfn');
  const [raw,version]=await Promise.all([
   boundedCall({stepFunctions,command:new sdk.DescribeExecutionCommand({executionArn:intent.executionArn}),signal}),
   acceptedDefinition({stepFunctions,signal}),
  ]);
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  await validateIntent(intent);
  if(!raw||raw.executionArn!==intent.executionArn||raw.stateMachineArn!==stateMachineArn||
   raw.stateMachineVersionArn!==stateMachineVersionArn||raw.status!=='RUNNING'||
   typeof raw.input!=='string'||Buffer.byteLength(raw.input)>65536)throw fault('NATIVE_WATCHDOG_REFUSED');
  const started=raw.startDate instanceof Date?raw.startDate.getTime():NaN;
  if(!Number.isSafeInteger(started)||started<intent.t0Ms-1000||started>now()+1000)throw fault('NATIVE_WATCHDOG_REFUSED');
  let input;try{input=JSON.parse(raw.input);}catch{throw fault('NATIVE_WATCHDOG_REFUSED');}
  if(await sha(input)!==intent.inputSha256)throw fault('NATIVE_WATCHDOG_REFUSED');
  return Object.freeze({armed:true,executionArn:intent.executionArn,status:'RUNNING',hostId:intent.input.hostId,
   generation:intent.input.generation,t0Ms:intent.t0Ms,deadlineMs:intent.cleanupCeilingMs,
   leaseDeadlineMs:intent.leaseDeadlineMs,cleanupCeilingMs:intent.cleanupCeilingMs,startDateMs:started,
   definitionSha256,qualificationEvidenceSha256,stateMachineVersionArn});
 }
 async function arm({stepFunctions,intent,signal}){
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  if(intent?.input?.schema!=='meri-native-watchdog-input/2')throw fault('NATIVE_WATCHDOG_REFUSED');
  await validateIntent(intent);
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  const sdk=stepFunctions.sdk??await import('@aws-sdk/client-sfn');
  // The accepted immutable definition is checked BEFORE any StartExecution and again on retained readback.
  await acceptedDefinition({stepFunctions,signal});
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  await validateIntent(intent);
  let retained=null,missing=false;
  try{retained=await boundedCall({stepFunctions,command:new sdk.DescribeExecutionCommand({
   executionArn:intent.executionArn}),signal});}
  catch(error){
   if(error?.name!=='ExecutionDoesNotExist'&&error?.code!=='ExecutionDoesNotExist')throw error;
   missing=true;
  }
  if(retained!==null&&retained!==undefined){
   if(retained.status!=='RUNNING')throw fault('NATIVE_WATCHDOG_REFUSED');
   return readbackIntentAt({stepFunctions,intent,signal});
  }
  if(!missing)throw fault('NATIVE_WATCHDOG_REFUSED');
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  await validateIntent(intent);
  let startError=null;
  try{
   const raw=await boundedCall({stepFunctions,command:new sdk.StartExecutionCommand({name:intent.executionName,
    stateMachineArn:stateMachineVersionArn,input:JSON.stringify(intent.input)}),signal});
   if(!raw||raw.executionArn!==intent.executionArn)throw fault('NATIVE_WATCHDOG_REFUSED');
  }catch(error){
   if(error?.name!=='ExecutionAlreadyExists'&&error?.code!=='ExecutionAlreadyExists')startError=error;
  }
  if(startError)throw startError;
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  await validateIntent(intent);
  return readbackIntentAt({stepFunctions,intent,signal});
 }
 async function verify(args){
  if(args?.intent!==undefined)return readbackIntentAt({stepFunctions:args.stepFunctions,intent:args.intent,signal:args.signal});
  const {stepFunctions,hostId,generation,t0Ms,deadlineMs,signal}=args??{};
  if(!UUID.test(hostId??'')||!Number.isSafeInteger(generation)||generation<1||!Number.isSafeInteger(t0Ms)||
   !Number.isSafeInteger(deadlineMs)||deadlineMs<=t0Ms||deadlineMs<=now())throw fault('NATIVE_WATCHDOG_REFUSED');
  const executionNameValue=executionName(hostId,generation),executionArnValue=executionArn(hostId,generation);
  const life=new AbortController();let listener;
  const cancelled=new Promise((_,reject)=>{listener=()=>reject(fault('NATIVE_WATCHDOG_CANCELLED'));
   life.signal.addEventListener('abort',listener,{once:true});});
  const onAbort=()=>life.abort();signal?.addEventListener('abort',onAbort,{once:true});
  try{
   const sdk=stepFunctions.sdk??await import('@aws-sdk/client-sfn');
   const raw=await Promise.race([stepFunctions.send(new sdk.DescribeExecutionCommand({executionArn:executionArnValue}),
    {abortSignal:life.signal}),cancelled]);
   if(life.signal.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
   if(!raw||raw.executionArn!==executionArnValue||raw.stateMachineArn!==stateMachineArn||
    raw.stateMachineVersionArn!==stateMachineVersionArn||raw.status!=='RUNNING'||
    typeof raw.input!=='string')throw fault('NATIVE_WATCHDOG_REFUSED');
   const started=raw.startDate instanceof Date?raw.startDate.getTime():NaN;
   if(!Number.isSafeInteger(started)||started<t0Ms-1000||started>now()+1000)throw fault('NATIVE_WATCHDOG_REFUSED');
   const input=JSON.parse(raw.input);
   if(input?.schema!=='meri-native-watchdog-input/1'&&input?.schema!=='meri-d005-host-watchdog-input/2')
    throw fault('NATIVE_WATCHDOG_REFUSED');
   if(input.hostId!==hostId||input.generation!==generation||input.originalT0Ms!==t0Ms||input.deadlineMs!==deadlineMs)
    throw fault('NATIVE_WATCHDOG_REFUSED');
   return Object.freeze({armed:true,executionArn:executionArnValue,status:'RUNNING',hostId,generation,t0Ms,deadlineMs,
    startDateMs:started,definitionSha256,qualificationEvidenceSha256,stateMachineVersionArn});
  }finally{signal?.removeEventListener('abort',onAbort);life.signal.removeEventListener('abort',listener);}
 }
 async function readResult({stepFunctions,intent,signal}){
  await validateIntentStructure(intent);
  if(signal?.aborted)throw fault('NATIVE_WATCHDOG_CANCELLED');
  const sdk=stepFunctions.sdk??await import('@aws-sdk/client-sfn');
  let raw;
  try{raw=await boundedCall({stepFunctions,command:new sdk.DescribeExecutionCommand({
   executionArn:intent.executionArn}),signal});}
  catch(error){
   return Object.freeze({status:'UNKNOWN',quarantine:true,executionArn:intent.executionArn,
    executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],
    reason:error?.code??error?.name??'execution_read_failed'});
  }
  if(!raw||raw.executionArn!==intent.executionArn||raw.stateMachineArn!==stateMachineArn||
   raw.stateMachineVersionArn!==stateMachineVersionArn||typeof raw.input!=='string'){
   return Object.freeze({status:'UNKNOWN',quarantine:true,executionArn:intent.executionArn,
    executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],reason:'execution_unreadable'});
  }
  let input;try{input=JSON.parse(raw.input);}catch{
   return Object.freeze({status:'UNKNOWN',quarantine:true,executionArn:intent.executionArn,
    executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],reason:'input_malformed'});
  }
  if(await sha(input)!==intent.inputSha256)return Object.freeze({status:'UNKNOWN',quarantine:true,
   executionArn:intent.executionArn,executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],
   reason:'input_mismatch'});
  if(raw.status!=='SUCCEEDED'||typeof raw.output!=='string')return Object.freeze({status:'UNKNOWN',quarantine:true,
   executionArn:intent.executionArn,executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],
   reason:'execution_not_succeeded'});
  let output;try{output=JSON.parse(raw.output);}catch{return Object.freeze({status:'UNKNOWN',quarantine:true,
   executionArn:intent.executionArn,executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],
   reason:'output_malformed'});}
  try{
   const {validateManagedWatchdogResult}=await import('./native-watchdog-result.mjs');
   const checked=validateManagedWatchdogResult(output,{intent,nowMs:now()});
   return Object.freeze({...checked,executionArn:intent.executionArn,executionName:intent.executionName});
  }catch{return Object.freeze({status:'UNKNOWN',quarantine:true,executionArn:intent.executionArn,
   executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,
   owned:Array.isArray(output?.owned)?output.owned:[],reason:'result_refused'});}
 }
 return Object.freeze({region,accountId,makeIntent,arm,verify,readResult});
}
/** Own the low-level client for the duration of one provisioning attempt. A read-only DescribeExecution has no effect. */
export async function withManagedWatchdogReadback(config,run){
 const sdk=await import('@aws-sdk/client-sfn');
 const client=new sdk.SFNClient({region:config.region,maxAttempts:2});
 try{return await run({stepFunctions:client,...createManagedWatchdogReadback(config)});}
 finally{client.destroy();}
}
