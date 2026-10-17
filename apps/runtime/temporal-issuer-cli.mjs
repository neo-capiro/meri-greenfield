/** Executable owner of the dedicated Temporal issuer registration Pool.
 * Importing performs no IO. Configuration names no module, callback or authority. */
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {types} from 'node:util';
import {Pool} from 'pg';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {fault,readSecret} from './config.mjs';
import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {createTemporalIssuerEntrypoint,parseTemporalIssuerEntrypointConfiguration} from './temporal-issuer/entrypoint.mjs';

const CONFIGURATION='TEMPORAL_ISSUER_RUNTIME_CONFIGURATION',UNAVAILABLE='TEMPORAL_ISSUER_RUNTIME_UNAVAILABLE';
const CLEANUP='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN',MAX_BYTES=32768,MAX_RETIREMENT_MS=30000;
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const callable=value=>typeof value==='function'&&!types.isProxy(value);
const parsedConfigurations=new WeakSet();
function refuse(){throw fault(CONFIGURATION);}
function path(value){if(typeof value!=='string'||!isAbsolute(value)||value.length>4096||value.includes('\0')||value.split(/[\\/]/u).some(part=>part==='.'||part==='..'))refuse();return value;}
function enabled(environment){if(environment===null||typeof environment!=='object'||types.isProxy(environment)||Object.getOwnPropertyDescriptor(environment,'MERI_TEMPORAL_ISSUER_REQUIRED')?.value!=='1')refuse();}

/** Pure closed configuration; the Core owner validates every issuer authority join. */
export function parseTemporalIssuerRuntimeConfiguration(raw){
 if(raw!==null&&typeof raw==='object'&&parsedConfigurations.has(raw))return raw;
 try{
  const c=own(data(raw),['schemaVersion','issuer','database']),database=own(c.database,['connectionFile','connectionSha256']);
  if(c.schemaVersion!==1||!hex64(database.connectionSha256))refuse();path(database.connectionFile);
  const parsed=Object.freeze({schemaVersion:1,issuer:parseTemporalIssuerEntrypointConfiguration(c.issuer),database:Object.freeze({...database})});
  parsedConfigurations.add(parsed);return parsed;
 }catch{refuse();}
}
function admitted(bytes,expected,environment){
 enabled(environment);if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_BYTES||!hex64(expected)||sha(bytes)!==expected)refuse();
 try{return parseTemporalIssuerRuntimeConfiguration(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{refuse();}
}
function databaseUri(bytes,c){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_BYTES||sha(bytes)!==c.database.connectionSha256)refuse();
 try{
  const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim(),url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.pathname.length<2||/[\0\r\n\t]/u.test(value)||
     decodeURIComponent(url.username)!==c.issuer.registrationRole||url.search!=='?sslmode=verify-full'||url.hash||value.includes('#'))refuse();
  decodeURIComponent(url.password);return value;
 }catch{refuse();}
}

/** Raw bytes and the required flag are checked again here before DB/TLS material.
 * The three test factories are trusted function ports, never configuration data. */
export async function startTemporalIssuerRuntime(options={}){
 const o=own(options,['configurationBytes','configurationSha256'],['environment','signal','testOwners']);nativeSignal(o.signal);
 const environment=o.environment??process.env,c=admitted(o.configurationBytes,o.configurationSha256,environment);
 const test=own(o.testOwners??{},[],['readMaterial','createPool','createEntrypoint']);if(Object.values(test).some(value=>!callable(value)))refuse();
 const material=test.readMaterial??readSecret,createPool=test.createPool??(options=>new Pool(options)),createEntrypoint=test.createEntrypoint??createTemporalIssuerEntrypoint;
 const retirementMs=Math.min(MAX_RETIREMENT_MS,c.issuer.startupTimeoutMs),controller=new AbortController();
 const life=createOperationLifetime({now:Date.now,signal:controller.signal,deadlineMs:Date.now()+c.issuer.startupTimeoutMs,errorFactory:()=>fault(UNAVAILABLE)});
 let pool,entrypoint,endPool,closeEntrypoint,availableEntrypoint,closing,closed=false,running=false;
 function close(){
  if(closing)return closing;closed=true;running=false;controller.abort();o.signal?.removeEventListener('abort',abort);
  closing=(async()=>{
   const outcomes=[],pending=new Set(),retirement=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+retirementMs,errorFactory:()=>temporalCleanupUnknown(fault('TEMPORAL_ISSUER_RETIREMENT_TIMEOUT'))});
   async function step(owner,method){
    if(!owner)return;
    try{if(!method)throw fault('TEMPORAL_ISSUER_OWNER_CLEANUP_UNAVAILABLE');const work=Promise.resolve(method());pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));
     const value=await retirement.run(()=>work);outcomes.push({status:'fulfilled',value});}
    catch(reason){outcomes.push({status:'rejected',reason});}
   }
   try{
    // The Core owner borrows this Pool. Do not end it before retiring that owner.
    await step(entrypoint,closeEntrypoint);await step(pool,endPool);
   }finally{outcomes.push({status:'fulfilled',value:{unsettledOperations:pending.size}},{status:'fulfilled',value:retirement.close()},{status:'fulfilled',value:life.close()});}
   assertTemporalRuntimeCleanup(outcomes);
  })();return closing;
 }
 function abort(){void close().catch(()=>{});}
 o.signal?.addEventListener('abort',abort,{once:true});
 try{
  o.signal?.throwIfAborted();
  await life.run(async signal=>{
   let bytes;
   try{bytes=await material(c.database.connectionFile,{signal});life.check();const connectionString=databaseUri(bytes,c);
    life.check();pool=createPool({connectionString,max:2,connectionTimeoutMillis:Math.min(c.issuer.startupTimeoutMs,3000),
     query_timeout:c.issuer.service.maxRequestMs,statement_timeout:c.issuer.service.maxRequestMs,idleTimeoutMillis:1000});
    endPool=storageMethod(pool,'end');storageMethod(pool,'connect');life.check();
    entrypoint=createEntrypoint({configuration:c.issuer,registrationPool:pool});closeEntrypoint=storageMethod(entrypoint,'close');
    const start=storageMethod(entrypoint,'start');availableEntrypoint=storageMethod(entrypoint,'available');life.check();
    await start();life.check();if(closed||availableEntrypoint()!==true)throw fault(UNAVAILABLE);running=true;
   }finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
  });life.check();
  return Object.freeze({available(){try{return !closed&&running&&availableEntrypoint()===true;}catch{return false;}},close});
 }catch(error){
  try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'TEMPORAL_ISSUER_STARTUP_AND_CLEANUP_FAILED'));}
  if(error?.code===CONFIGURATION||error?.code===CLEANUP)throw error;throw Object.assign(fault(UNAVAILABLE),{cause:error});
 }finally{life.close();}
}

/** Exit 0: help/known graceful stop; 2: closed argument/config admission;
 * 3: startup/runtime/cleanup failure. UNKNOWN keeps a referenced retirement
 * watchdog: waiting less time is never evidence that native work stopped. */
export async function main(argv=process.argv.slice(2),options={}){
 const o=own(options,[],['environment','testOwners']),environment=o.environment??process.env;
 if(argv.length===1&&['--help','-h'].includes(argv[0])){
  process.stdout.write('Usage: node apps/runtime/temporal-issuer-cli.mjs --config /absolute/config.json --config-sha256 RAW_SHA256\nExit: 0 help/graceful stop; 2 arguments/configuration; 3 startup/runtime/cleanup failure.\n');return 0;
 }
 let file,pin;
 try{if(argv.length!==4||argv[0]!=='--config'||argv[2]!=='--config-sha256')refuse();file=path(argv[1]);pin=argv[3];if(!hex64(pin))refuse();enabled(environment);}catch{process.stderr.write(CONFIGURATION+'\n');return 2;}
 const test=own(o.testOwners??{},[],['readMaterial','createPool','createEntrypoint']);if(Object.values(test).some(value=>!callable(value)))refuse();
 const controller=new AbortController();let runtime,watchdog,startupWatchdog,retirementMs=MAX_RETIREMENT_MS,unknown=false,code=0,admission=true;
 const force=()=>{process.stderr.write(CLEANUP+'\n');process.exit(3);};
 const retire=()=>{watchdog??=setTimeout(force,retirementMs);};
 const stop=()=>{retire();controller.abort();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 try{
  startupWatchdog=setTimeout(force,MAX_RETIREMENT_MS);
  const bytes=await (test.readMaterial??readSecret)(file,{signal:controller.signal});controller.signal.throwIfAborted();
  const c=admitted(bytes,pin,environment);retirementMs=Math.min(MAX_RETIREMENT_MS,c.issuer.startupTimeoutMs);admission=false;
  // Includes cleanup if startup fails before the runtime facade can be returned.
  clearTimeout(startupWatchdog);startupWatchdog=setTimeout(force,c.issuer.startupTimeoutMs+retirementMs);
  runtime=await startTemporalIssuerRuntime({configurationBytes:bytes,configurationSha256:pin,environment,signal:controller.signal,testOwners:test});
  clearTimeout(startupWatchdog);startupWatchdog=null;
  if(!controller.signal.aborted){
   if(!runtime.available())throw fault(UNAVAILABLE);
   process.stdout.write(JSON.stringify({event:'runtime.listening',role:'temporal-issuer'})+'\n');
   await new Promise(resolve=>{controller.signal.addEventListener('abort',resolve,{once:true});if(controller.signal.aborted)resolve();});
  }
 }catch(error){unknown=error?.code===CLEANUP;code=unknown?3:admission||error?.code===CONFIGURATION?2:controller.signal.aborted?0:3;process.stderr.write((unknown?CLEANUP:code===2?CONFIGURATION:UNAVAILABLE)+'\n');}
 finally{
  if(runtime){retire();try{await runtime.close();}catch{unknown=true;code=3;process.stderr.write(CLEANUP+'\n');}}
  if(unknown)retire();else{clearTimeout(watchdog);clearTimeout(startupWatchdog);}
  process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
 }
 return code;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
