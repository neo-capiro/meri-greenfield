import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
if(!root)throw Error('exact source root required');
const require=createRequire(join(root,'apps/runtime/package.json'));
const {parse}=require('pg-connection-string');
const source=await readFile(join(root,'apps/runtime/control.mjs'),'utf8');
async function start(connectionString,{signal}={}){
 const observed={pools:0,temporal:0,ended:0,ssl:null};
 class Pool{constructor(options){observed.pools++;observed.ssl=parse(options.connectionString).ssl;}async end(){observed.ended++;}}
 const context=vm.createContext({Buffer,URL,Date});
 const modules=new Map(),main=new vm.SourceTextModule(source,{context,identifier:join(root,'apps/runtime/control.mjs')});
 await main.link(async(specifier)=>{
  if(modules.has(specifier))return modules.get(specifier);
  let exports;
  if(specifier==='pg')exports={Pool};
  else if(specifier==='@temporalio/client')exports={Connection:{async connect(){observed.temporal++;throw Error('synthetic stop before any connection');}},Client:class{}};
  else if(specifier==='./config.mjs')exports={readSecret:async path=>Buffer.from(path==='/synthetic/database'?connectionString:'synthetic'),fault:code=>Object.assign(Error(code),{code})};
  else{
   const escaped=specifier.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
   const match=source.match(new RegExp("import \\{([^}]+)\\} from ['\"]"+escaped+"['\"]"));
   if(!match)throw Error('unexpected import '+specifier);
   exports=Object.fromEntries(match[1].split(',').map(name=>[name.trim(),()=>{throw Error('unexpected synthetic owner invocation');}]));
  }
  const names=Object.keys(exports),module=new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,exports[name]);},{context,identifier:specifier});modules.set(specifier,module);return module;
 });
 await main.evaluate();
 const configuration={database:{connectionFile:'/synthetic/database'},native:{capabilityFile:'/synthetic/capability'},temporal:{tls:{caFile:'/synthetic/ca',certFile:'/synthetic/cert',keyFile:'/synthetic/key'},address:'synthetic.invalid:7233'},limits:{requestMs:100,startupMs:100}};
 if(signal?.aborted)await assert.rejects(main.namespace.startControl(configuration,{signal}));
 else await assert.rejects(main.namespace.startControl(configuration),/CONTROL_STARTUP_FAILED/u);
 return observed;
}
test('duplicate sslmode cannot disable TLS verification before any Pool or Temporal allocation',async()=>{
 const text='postgresql://synthetic:synthetic@database.invalid/meri?sslmode=verify-full&sslmode=no-verify';
 assert.equal(new URL(text).searchParams.get('sslmode'),'verify-full');
 assert.equal(parse(text).ssl.rejectUnauthorized,false,'actual locked upstream parser demonstrates the divergent interpretation');
 const result=await start(text);assert.equal(result.pools,0,JSON.stringify(result));assert.equal(result.temporal,0);
});
test('one exact verify-full mode reaches the controlled allocation and closes owned Pool on startup failure',async()=>{
 const result=await start('postgresql://synthetic:synthetic@database.invalid/meri?sslmode=verify-full');
 assert.equal(result.pools,1);assert.equal(result.temporal,1);assert.equal(result.ended,1);assert.notEqual(result.ssl.rejectUnauthorized,false);
});
test('pre-aborted control initialization refuses before Pool or Temporal allocation',async()=>{
 const controller=new AbortController();controller.abort();
 const result=await start('postgresql://synthetic:synthetic@database.invalid/meri?sslmode=verify-full',{signal:controller.signal});
 assert.equal(result.pools,0,JSON.stringify(result));assert.equal(result.temporal,0);
});
