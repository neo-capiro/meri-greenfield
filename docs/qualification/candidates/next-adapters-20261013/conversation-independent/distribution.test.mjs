/** Exact generated/packed receiving contract checks, no package registry access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../../../../',import.meta.url)),CONTRACTS=join(ROOT,'packages','contracts');
const BASE='a2aef4a5fcd3c19cec974dc62b69222836d71b3e';
const sha=value=>createHash('sha256').update(value).digest('hex');

test('every existing wire/action/document distribution byte and public wire schema remains exact PR60',async()=>{
 const old=execFileSync('git',['ls-tree','-r','--name-only',BASE,'packages/contracts/dist/'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n');
 for(const path of [...old,'packages/contracts/meri.schema.json']){
  const baseline=execFileSync('git',['show',BASE+':'+path],{cwd:ROOT,maxBuffer:4*1024*1024});assert.equal(sha(await readFile(join(ROOT,path))),sha(baseline),path);
 }
 const packageJson=JSON.parse(await readFile(join(CONTRACTS,'package.json'),'utf8'));
 assert.equal(packageJson.version,'0.1.3');
 assert.deepEqual(Object.keys(packageJson.exports).sort(),['.','./browser','./node','./metadata','./schema','./action-application','./action-application/schema','./document-application','./document-application/schema','./conversation-application','./conversation-application/schema'].sort());
});

test('standalone browser receiver evaluates without Node or imports and has deliberate exports',()=>{
 const script=`import {readFileSync} from 'node:fs';import {SourceTextModule,createContext} from 'node:vm';
 const source=readFileSync(${JSON.stringify(join(CONTRACTS,'dist/conversation-application.mjs'))},'utf8');
 const context=createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer});const module=new SourceTextModule(source,{context});
 await module.link(()=>{throw Error('EXTERNAL_IMPORT')});await module.evaluate({timeout:3000});
 const expected=['ConversationResponseError','conversationApplicationMetadata','conversationReconnect','createConversationCursor','receiveConversationEvent','receiveConversationRequest','receiveConversationResponse'].sort();
 if(JSON.stringify(Object.getOwnPropertyNames(module.namespace).sort())!==JSON.stringify(expected))throw Error('EXPORT_DRIFT');
 const req=module.namespace.receiveConversationRequest('events',new TextEncoder().encode(JSON.stringify({command:{conversationId:'70000000-0000-4000-8000-000000000001',intent:'view.subscribe'}})));
 if(req.command.intent!=='view.subscribe'||!Object.isFrozen(req.command)||'process' in context||'Buffer' in context)throw Error('BROWSER_BOUNDARY');`;
 const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{encoding:'utf8',timeout:10000,maxBuffer:65536});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
});

test('self-contained public schema and metadata bind exact canonical source bytes',async()=>{
 const metadata=JSON.parse(await readFile(join(CONTRACTS,'dist/conversation-application.metadata.json'),'utf8'));
 const schemaBytes=await readFile(join(CONTRACTS,'dist/conversation-application.schema.json'));
 assert.equal(metadata.packageVersion,'0.1.3');assert.equal(metadata.schemaSha256,sha(schemaBytes));
 for(const source of metadata.sources){const bytes=await readFile(join(CONTRACTS,source.path));assert.equal(source.sha256,sha(bytes),source.path);assert.equal(source.bytes,bytes.length);}
 const stack=[JSON.parse(schemaBytes)];while(stack.length){const value=stack.pop();if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){if(key==='$ref')assert.match(child,/^#\//u);else stack.push(child);}}
});

test('offline packed package resolves exact installed browser exports/types and blocks private implementations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'meri-public-independent-'));
 try{
  const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--offline','--json','--cache',join(dir,'cache'),'--pack-destination',dir],{cwd:CONTRACTS,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}))[0];assert.equal(packed.version,'0.1.3');
  const target=join(dir,'node_modules','@capiro','meri-contracts');await mkdir(target,{recursive:true});execFileSync('tar',['-xzf',join(dir,packed.filename),'-C',target,'--strip-components=1']);
  await writeFile(join(dir,'package.json'),JSON.stringify({type:'module',private:true}));
  const script=`import {receiveConversationRequest,conversationApplicationMetadata} from '@capiro/meri-contracts/conversation-application';
 import {validateUIEvent} from '@capiro/meri-contracts/browser';import {receiveDocumentRequest} from '@capiro/meri-contracts/document-application';import {receiveActionResponse} from '@capiro/meri-contracts/action-application';
 if(conversationApplicationMetadata.packageVersion!=='0.1.3'||typeof validateUIEvent!=='function'||typeof receiveDocumentRequest!=='function'||typeof receiveActionResponse!=='function')throw Error('PUBLIC_EXPORTS');
 receiveConversationRequest('cancel',new TextEncoder().encode('{}'));
 for(const path of ['@capiro/meri-contracts/retrieval-0.2/catalog.json','@capiro/meri-contracts/conversation-application/receive.mjs','@capiro/meri-contracts/commands-0.2/validate.mjs']){let denied=false;try{await import(path);}catch(error){denied=error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED';}if(!denied)throw Error('PRIVATE_EXPORT');}`;
  await writeFile(join(dir,'installed.mjs'),script);
  const node=spawnSync(process.execPath,[join(dir,'installed.mjs')],{cwd:dir,encoding:'utf8',timeout:10000,maxBuffer:65536});assert.equal(node.error,undefined);assert.equal(node.status,0,node.stderr);
  await copyFile(new URL('./installed-receiving.mts',import.meta.url),join(dir,'receiving.mts'));
  const tsc=spawnSync(process.execPath,[join(CONTRACTS,'node_modules','typescript','bin','tsc'),'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(dir,'receiving.mts')],{cwd:dir,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(tsc.error,undefined);assert.equal(tsc.status,0,tsc.stdout+tsc.stderr);
 }finally{await rm(dir,{recursive:true,force:true});}
});
