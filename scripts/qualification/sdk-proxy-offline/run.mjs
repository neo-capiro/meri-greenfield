#!/usr/bin/env node
/** Exact installed SDK/CLI -> real LiteLLM -> local native stub qualification.
 * Product owner HTTPS/RFC1918 and genuine PostgreSQL remain separate OPEN gates. */
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {request as httpsRequest} from 'node:https';
import {buildConversationOptions} from '../../../apps/worker/conversation/options.mjs';
import {PRODUCT_PROXY_MODEL_ALIAS} from '../../../apps/proxy/product/startup-config.mjs';
import {QUALIFICATION_BUDGET_MICRO_USD,STRUCTURED_OUTPUT_SCHEMA_JSON} from './model_ledger_fixture.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const modes=new Set(['complete','truncated','cached','missing-usage','reservation-ack-lost',
 'settlement-ack-committed','settlement-ack-unresolved']);
const usage='node scripts/qualification/sdk-proxy-offline/run.mjs --python /absolute/pinned/python --out /absolute/receipt.json [--mode complete] [--client sdk|minimal-messages] [--output-format none|json-schema]\nExit 0: executed partition passed; 2: refused, failed or blocked. Full owner HTTPS is always an explicit separate OPEN gate here.\n';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ended=child=>child.exitCode!==null||child.signalCode!==null||child.pid===undefined;
async function shaFile(path){const hash=createHash('sha256');for await(const part of createReadStream(path))hash.update(part);return hash.digest('hex');}
async function stop(child){if(ended(child))return;child.stdin?.end('\n');
 for(let n=0;n<50;n++){if(ended(child))return;await pause(100);}child.kill('SIGTERM');
 for(let n=0;n<20;n++){if(ended(child))return;await pause(100);}
 const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await Promise.race([closed,pause(3000)]);}
async function ready(child){return new Promise((resolve,reject)=>{
 const lines=createInterface({input:child.stdout}),timer=setTimeout(()=>done(Error('OFFLINE_STARTUP_DEADLINE')),30000);
 const exited=()=>done(Error('OFFLINE_STARTUP_REFUSED'));
 function done(error,value){clearTimeout(timer);lines.close();child.off('exit',exited);error?reject(error):resolve(value);}
 child.once('exit',exited);lines.on('line',line=>{try{const value=JSON.parse(line);if(value.ready===true)done(null,value);}catch{}});
});}
async function minimalMessages(port,ca){
 // A small request independently characterizes the accounting boundary. The
 // SDK keeps its production 8192-token setting in the same admitted fixture.
 const body=JSON.stringify({model:PRODUCT_PROXY_MODEL_ALIAS,max_tokens:16,
  messages:[{role:'user',content:'Return one short greeting.'}],stream:true,temperature:0});
 return new Promise((resolve,reject)=>{
  const request=httpsRequest({hostname:'127.0.0.1',port,path:'/v1/messages?beta=true',method:'POST',ca,
   headers:{'content-type':'application/json','content-length':Buffer.byteLength(body),
    authorization:'Bearer synthetic-offline-sdk-proxy-key-000001','anthropic-version':'2023-06-01'},timeout:20000},response=>{
   const hash=createHash('sha256');let bytes=0,pending='',events=[];
   response.on('data',part=>{hash.update(part);bytes+=part.length;pending+=part.toString('utf8');
    let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at).trimEnd();pending=pending.slice(at+1);
     if(line.startsWith('event: '))events.push(line.slice(7));}
    if(bytes>262144)request.destroy(Error('OFFLINE_RESPONSE_BOUND'));
   });
   response.once('end',()=>resolve({status:response.statusCode,bytes,sha256:hash.digest('hex'),events}));
   response.once('error',()=>reject(Error('OFFLINE_RESPONSE_INTERRUPTED')));
  });
  request.once('error',error=>reject(error));request.once('timeout',()=>request.destroy(Error('OFFLINE_CLIENT_DEADLINE')));
  request.end(body);
 });
}
export async function main(argv){
 let python,out,mode='complete',client='sdk',format='none';for(let n=0;n<argv.length;n++){
  const arg=argv[n];if(arg==='--help'){process.stdout.write(usage);return 0;}
  if(arg==='--python')python=argv[++n];else if(arg==='--out')out=argv[++n];
  else if(arg==='--mode')mode=argv[++n];else if(arg==='--client')client=argv[++n];
  else if(arg==='--output-format')format=argv[++n];
  else{process.stderr.write(usage);return 2;}}
 if(!python?.startsWith('/')||!out?.startsWith('/')||!modes.has(mode)||!['sdk','minimal-messages'].includes(client)||!['none','json-schema'].includes(format)||
  (client==='minimal-messages'&&format!=='none')){process.stderr.write(usage);return 2;}
 const directory=mkdtempSync(join(tmpdir(),'meri-sdk-proxy-offline-'));
 const receipt={scope:'OFFLINE_PARTITION_ONLY',mode,client,outputFormat:format,fullOwnerHttps:'OPEN_RFC1918_INTERFACES_UNAVAILABLE',
  productImage:'UNRUN',postgresql:'UNRUN',providerCalls:0,sdkResults:[],sdkSpawns:0};
 let child,run,timer;const sdkChildren=[];
 try{
  receipt.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  receipt.sourceFiles=Object.fromEntries(await Promise.all(['run.mjs','native_proxy.py','provider_stub.py',
   'owner_peer.mjs','model_ledger_fixture.mjs'].map(async name=>[name,await shaFile(join(here,name))])));
  receipt.productConfigSha256=await shaFile(join(root,'apps/proxy/product/litellm-product-config.yaml'));
  const ssl=args=>execFileSync('openssl',args,{cwd:directory,stdio:['ignore','ignore','ignore'],timeout:10000});
  ssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=offline-proxy-ca',
   '-keyout','ca.key','-out','ca.crt','-addext','basicConstraints=critical,CA:TRUE']);
  ssl(['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','server.key','-out','server.csr']);
  writeFileSync(join(directory,'ext.cnf'),'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
  ssl(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1',
   '-extfile','ext.cnf','-out','server.crt']);
  const baseEnv={PATH:process.env.PATH,HOME:directory,PYTHONPATH:root,PYTHONDONTWRITEBYTECODE:'1',
   LITELLM_LOCAL_MODEL_COST_MAP:'True',LITELLM_TELEMETRY:'False',DO_NOT_TRACK:'1',
   AWS_EC2_METADATA_DISABLED:'true',AWS_SHARED_CREDENTIALS_FILE:'/dev/null',AWS_CONFIG_FILE:'/dev/null',
   AWS_ACCESS_KEY_ID:'synthetic-offline',AWS_SECRET_ACCESS_KEY:'synthetic-offline-never-an-account-key',AWS_DEFAULT_REGION:'us-east-1'};
  const nativeReceipt=join(directory,'native-receipt.json');
  child=spawn(python,[join(here,'native_proxy.py'),'--cert',join(directory,'server.crt'),
   '--key',join(directory,'server.key'),'--receipt',nativeReceipt,'--mode',mode,
   '--output-format',format,...(format==='json-schema'?['--schema-json',STRUCTURED_OUTPUT_SCHEMA_JSON]:[])],
   {cwd:root,env:baseEnv,stdio:['pipe','pipe','pipe']});
  child.stderr.on('data',()=>{});
  child.stdin.on('error',()=>{});
  const endpoint=await ready(child),sdkDirectory=join(root,'apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk');
  const manifest=JSON.parse(readFileSync(join(sdkDirectory,'package.json'),'utf8'));
  if(manifest.version!=='0.3.295'||manifest.claudeCodeVersion!=='2.1.295')throw Error('OFFLINE_SDK_PIN_REFUSED');
  receipt.versions={sdk:manifest.version,cli:manifest.claudeCodeVersion,node:process.version};
  const executable=realpathSync(join(root,'apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude'));
  receipt.executableSha256=await shaFile(executable);
  if(client==='minimal-messages'){
   try{receipt.clientResult=await minimalMessages(endpoint.port,readFileSync(join(directory,'ca.crt')));}
   catch(error){receipt.clientResult={interrupted:true,failure:/^[A-Z][A-Z0-9_]+$/u.test(error?.message)?error.message:error?.name??'Error'};}
  }else{
  const {query}=await import(pathToFileURL(join(sdkDirectory,'sdk.mjs')).href);
  const conversationId='00000001-0000-4000-8000-000000000000',work=join(directory,conversationId);
  for(const path of [work,join(directory,'config'),join(directory,'secure')])mkdirSync(path);
  const controller=new AbortController();timer=setTimeout(()=>controller.abort('OFFLINE_SDK_DEADLINE'),30000);
  const options=buildConversationOptions({binding:{conversationId},versions:{sdk:'0.3.295',cli:'2.1.295'},cwd:work,
   proxyUrl:`https://127.0.0.1:${endpoint.port}/`,proxyCredential:'synthetic-offline-sdk-proxy-key-000001',
   model:PRODUCT_PROXY_MODEL_ALIAS,sessionStore:{async load(){return null;},async append(){}},
   deadlineMs:Date.now()+30000,maxTurns:1,maxCostMicroUSD:QUALIFICATION_BUDGET_MICRO_USD,maxOutputBytes:262144,
   sdkConfigDirectory:join(directory,'config'),sdkSecureStorageDirectory:join(directory,'secure')},controller,
   undefined,undefined,undefined,undefined,undefined,undefined,
   format==='json-schema'?{type:'json_schema',schema:JSON.parse(STRUCTURED_OUTPUT_SCHEMA_JSON)}:undefined);
  const fixtureEnv={PATH:process.env.PATH,HOME:directory,NODE_EXTRA_CA_CERTS:join(directory,'ca.crt'),
   CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1'};
  const allowed=new Set([...Object.keys(options.env),...Object.keys(fixtureEnv),
   'CLAUDE_CODE_ENTRYPOINT','CLAUDE_AGENT_SDK_VERSION','CLAUDE_CODE_SDK_READS_SESSION_STATE']);
  run=query({prompt:'Return one short greeting.',options:{...options,env:{...options.env,...fixtureEnv},
   spawnClaudeCodeProcess:spec=>{
    if(realpathSync(spec.command)!==executable)throw Error('OFFLINE_CLI_EXECUTABLE_REFUSED');
    receipt.sdkSpawns++;
    const env=Object.fromEntries(Object.entries(spec.env).filter(([name])=>allowed.has(name)));
    const process=spawn(spec.command,spec.args,{cwd:spec.cwd,env,stdio:['pipe','pipe','pipe']});
    process.stdin.on('error',()=>{});sdkChildren.push(process);return process;
   }}});
  try{for await(const event of run){if(event.type==='result'){
   const result={subtype:event.subtype,isError:event.is_error};
   if(format==='json-schema'){
    const output=event.structured_output;
    result.structuredOutputPresent=output!==undefined;
    result.structuredOutputMatchesSchema=output!==null&&typeof output==='object'&&!Array.isArray(output)&&
     Object.keys(output).length===1&&typeof output.reply==='string'&&output.reply==='Offline synthetic reply.';
    if(output!==undefined)result.structuredOutputSha256=createHash('sha256').update(JSON.stringify(output)).digest('hex');
   }
   receipt.sdkResults.push(result);
  }}}
  catch(error){receipt.sdkIterationFailure=error?.name??'Error';}
  await run.close();run=null;clearTimeout(timer);timer=null;
  }
  await stop(child);receipt.native=JSON.parse(readFileSync(nativeReceipt,'utf8'));
  const positive=['complete','settlement-ack-committed'].includes(mode);
  const n=receipt.native,l=n.ledger,ops=n.ownerOperations??{};
  const reportedSuccess=client!=='minimal-messages'?receipt.sdkResults.some(r=>r.subtype==='success'&&r.isError===false):
   receipt.clientResult.status===200&&receipt.clientResult.events.includes('message_stop');
  const succeeded=reportedSuccess&&(format==='none'||receipt.sdkResults.some(r=>r.subtype==='success'&&
   r.isError===false&&r.structuredOutputMatchesSchema===true));
  receipt.sdkSuccessObserved=client==='minimal-messages'?null:reportedSuccess;
  const expectedHold=client==='minimal-messages'?'344':'135248';
  const channelDenials=(n.errors??[]).filter(error=>error?.operation==='wire'&&error.code==='PRODUCT_OWNER_CHANNEL_DENIED').length;
  const attemptsBound=client==='minimal-messages'||positive
   ?n.countRequests===1&&ops.reserve===1
   :ops.reserve===n.countRequests&&(n.countRequests===1||n.countRequests===2&&channelDenials===1&&
    n.ownerHostGateAvailable===false&&n.ownerExchangeAborted===true);
  receipt.partitionPassed=positive
   ?succeeded&&n.providerExecutions===1&&n.countRequests===1&&
    l.reservationInserts===1&&l.settlementUpdates===1&&l.requests[0]?.state==='SETTLED'&&l.consumedMicroUSD==='90'
   :!reportedSuccess&&l.reservationInserts===1&&l.requests.length===1&&
    n.providerExecutions===(mode==='reservation-ack-lost'?0:1)&&
    l.requests[0].state===(mode==='settlement-ack-unresolved'?'SETTLED':'UNKNOWN')&&
    l.settlementUpdates===(mode==='settlement-ack-unresolved'?1:0)&&
    l.requests[0].holdMicroUSD===expectedHold&&
    l.consumedMicroUSD===(mode==='settlement-ack-unresolved'?'90':'0');
  receipt.partitionPassed&&=n.nativeStarted===true&&n.nativeStopped===true&&l.quarantined===false&&
   n.ownerBridge==='actual-ProductOwnerBridge-and-JS-owner-channel'&&
   n.ownerTlsEvidence==='SYNTHETIC_NOT_HTTPS_QUALIFICATION'&&
   attemptsBound&&(ops.settle??0)===(positive||mode==='settlement-ack-unresolved'?1:0)&&
   (ops.outcome??0)===(mode.startsWith('settlement-ack-')?1:0);
  if(positive)receipt.partitionPassed&&=n.ownerHostGateAvailable===true&&!n.ownerExchangeAborted;
  if(['reservation-ack-lost','settlement-ack-unresolved'].includes(mode))
   receipt.partitionPassed&&=n.ownerHostGateAvailable===false&&n.ownerExchangeAborted===true;
  return receipt.partitionPassed?0:2;
 }catch(error){receipt.partitionPassed=false;receipt.failure=/^[A-Z][A-Z0-9_]+$/u.test(error?.message)?error.message:error?.name??'Error';return 2;}
 finally{
  clearTimeout(timer);if(run)try{await run.close();}catch{}
  await Promise.all(sdkChildren.map(stop));
  if(child){await stop(child);try{receipt.native=JSON.parse(readFileSync(join(directory,'native-receipt.json'),'utf8'));}catch{}}
  writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');rmSync(directory,{recursive:true,force:true});
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main(process.argv.slice(2));
