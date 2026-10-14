#!/usr/bin/env node
/** Capture the real pinned SDK's launch descriptor for the product option set and run it through the
 * remote launch gates without spawning anything. Writes a receipt with secret values redacted.
 * No network, provider, database or process is created; the SDK is interrupted at its spawn hook. */
import {mkdtempSync,mkdirSync,rmSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const usage='Usage: node scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs --out FILE [--options-module PATH]\nExit: 0 receipt written (gate outcomes inside); 2 usage/configuration; 3 the SDK produced no descriptor.\n--options-module points at an alternative copy of apps/worker/conversation/options.mjs (for example an exact historical revision) to compare option builders.\n';
const secretKeys=new Set(['ANTHROPIC_AUTH_TOKEN','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN']);
export function redactEnvironment(env){return Object.fromEntries(Object.entries(env).map(([k,v])=>[k,v===undefined?{absentValue:'undefined'}:secretKeys.has(k)?{redacted:true,sha256:createHash('sha256').update(String(v)).digest('hex')}:v]));}
export function gateOutcomes({descriptor,data,compileNativeLaunch,binding,versions,workspace,executableSha256}){
 const outcomes={};
 try{data({command:descriptor.command,args:descriptor.args,cwd:descriptor.cwd,env:descriptor.env});outcomes.inertJsonDescriptor='PASS';}catch(e){outcomes.inertJsonDescriptor='FAIL: '+(e.message??e.code);}
 outcomes.hasClaudeConfigDir=Object.hasOwn(descriptor.env,'CLAUDE_CONFIG_DIR')?'PASS':'FAIL: descriptor env carries no CLAUDE_CONFIG_DIR; the task-side admission requires it under the approved config parent';
 outcomes.hasSecureStorageDir=Object.hasOwn(descriptor.env,'CLAUDE_SECURESTORAGE_CONFIG_DIR')?'PASS':'FAIL: descriptor env carries no CLAUDE_SECURESTORAGE_CONFIG_DIR';
 outcomes.secretInsideDescriptorEnv=Object.keys(descriptor.env).some(k=>secretKeys.has(k)&&descriptor.env[k]!==undefined)?'OBSERVED: the proxy credential is part of the descriptor env, so a static launch template would have to contain it':'absent';
 const configDirectory=join(workspace,'..','config');
 try{compileNativeLaunch({binding,workspace,configDirectory,versions:{sdk:versions.sdk,cli:versions.cli},expiresAtMs:Date.now()+60000,executableSha256,launch:{command:descriptor.command,args:descriptor.args,env:{...descriptor.env,CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory}},enabled:true,shutdownMs:1000});outcomes.compileNativeLaunchWithInjectedDirectories='PASS';}catch(e){outcomes.compileNativeLaunchWithInjectedDirectories='FAIL: '+(e.code??e.message);}
 return outcomes;
}
async function main(argv){
 let out=null,optionsModule=join(root,'apps/worker/conversation/options.mjs');for(let i=0;i<argv.length;i++){if(argv[i]==='--help')return process.stdout.write(usage),0;if(argv[i]==='--out')out=resolve(argv[++i]??'');else if(argv[i]==='--options-module')optionsModule=resolve(argv[++i]??'');else return process.stderr.write('unknown argument\n'+usage),2;}
 if(!out)return process.stderr.write(usage),2;
 for(const name of Object.keys(process.env))if(/^(CLAUDE|ANTHROPIC_|AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_)/u.test(name))delete process.env[name];
 const {buildConversationOptions}=await import(pathToFileURL(optionsModule).href);
 const {projectNativeSdkOptions}=await import(pathToFileURL(join(root,'apps/runtime/native-authority/sdk-option-projection.mjs')).href);
 const {compileNativeLaunch}=await import(pathToFileURL(join(root,'apps/runtime/native-authority/launch-configuration.mjs')).href);
 const {data}=await import(pathToFileURL(join(root,'packages/contracts/commands-0.2/execution-boundary.mjs')).href);
 const {canonicalSha256:hash}=await import(pathToFileURL(join(root,'packages/contracts/validate.mjs')).href);
 const {binding,versions}=await import(pathToFileURL(join(root,'apps/control/conversations/test/store-fixture.mjs')).href);
 const sdkDir=join(root,'apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk'),sdkVersion=JSON.parse(readFileSync(join(sdkDir,'package.json'),'utf8')).version;
 const {query}=await import(pathToFileURL(join(sdkDir,'sdk.mjs')).href);
 const taskRoot=mkdtempSync(join(tmpdir(),'meri-descriptor-capture-')),workspace=join(taskRoot,binding.conversationId);mkdirSync(workspace);
 const v={...versions,sdk:'0.3.295',cli:'2.1.295'},abort=new AbortController();
 const options=buildConversationOptions({binding,versions:v,cwd:workspace,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'synthetic-task-proxy-credential',model:'meri-local-no-provider',sessionStore:{async load(){throw Error('FRESH_LOAD_REFUSED');},async append(){}},deadlineMs:Date.now()+60000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:4096},abort);
 let descriptor=null;
 try{query({prompt:'/status',options:{...options,spawnClaudeCodeProcess(request){descriptor={command:request.command,args:[...request.args],cwd:request.cwd,env:{...request.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 try{
  if(!descriptor){process.stderr.write('the SDK did not call the spawn hook\n');return 3;}
  const cli=realpathSync(descriptor.command),executableSha256=createHash('sha256').update(readFileSync(cli)).digest('hex');
  const receipt={schema:'meri.sdk-descriptor-capture.v1',capturedAt:new Date().toISOString(),optionsModule:{path:optionsModule,sha256:createHash('sha256').update(readFileSync(optionsModule)).digest('hex')},sdkVersion,sdkDeclaredPins:v,cli:{path:cli,sha256:executableSha256,packageVersion:JSON.parse(readFileSync(join(dirname(cli),'package.json'),'utf8')).version},
   productOptions:{projectionSha256:hash(projectNativeSdkOptions(options)),model:options.model,maxTurns:options.maxTurns,maxBudgetUsd:options.maxBudgetUsd,permissionMode:options.permissionMode,settingSources:options.settingSources,envKeys:Object.keys(options.env)},
   descriptor:{command:descriptor.command,args:descriptor.args,cwd:descriptor.cwd,env:redactEnvironment(descriptor.env)},
   gates:gateOutcomes({descriptor,data,compileNativeLaunch,binding,versions:v,workspace,executableSha256}),
   scope:'No process was spawned, no provider or network request was made, no credential value is recorded; the proxy credential is a synthetic string hashed above.'};
  writeFileSync(out,JSON.stringify(receipt,null,1)+'\n');process.stdout.write(JSON.stringify({out,gates:receipt.gates})+'\n');return 0;
 }finally{rmSync(taskRoot,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main(process.argv.slice(2));
