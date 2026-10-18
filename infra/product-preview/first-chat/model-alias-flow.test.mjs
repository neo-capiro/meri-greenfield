/** Offline request-shape check with the pinned SDK/CLI and a local HTTPS Messages stand-in.
 * This never calls a model or qualifies the retained N21 image. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PRODUCT_PROXY_MODEL_ALIAS} from '../../../apps/proxy/product/startup-config.mjs';
import {SOURCE_ROOT} from './render-material.mjs';
import {startProviderStandIn} from '../../../scripts/qualification/first-chat-rehearsal/provider-standin.mjs';

test('pinned SDK sends the product alias to the offline Messages stand-in',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'meri-model-alias-'));
 const ssl=args=>execFileSync('openssl',args,{cwd:directory,stdio:['ignore','ignore','ignore']});
 let standIn;
 try{
  ssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=meri-standin-test-ca','-keyout','ca.key','-out','ca.crt','-addext','basicConstraints=critical,CA:TRUE']);
  ssl(['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','server.key','-out','server.csr']);
  writeFileSync(join(directory,'ext.cnf'),'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
  ssl(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','ext.cnf','-out','server.crt']);
  standIn=await startProviderStandIn({certFile:join(directory,'server.crt'),keyFile:join(directory,'server.key'),port:0});
  for(const name of ['config','secure','work'])mkdirSync(join(directory,name));
  const sdk=await import(pathToFileURL(join(SOURCE_ROOT,'apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs')).href);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort('offline probe deadline'),15_000);
  let outcome=null;
  try{
   const run=sdk.query({prompt:'Return a short greeting.',options:{cwd:join(directory,'work'),model:PRODUCT_PROXY_MODEL_ALIAS,maxTurns:1,maxBudgetUsd:1,
    permissionMode:'default',settingSources:[],tools:[],allowedTools:[],abortController:controller,
    env:{PATH:process.env.PATH,HOME:directory,ANTHROPIC_BASE_URL:`https://127.0.0.1:${standIn.port}/`,
     ANTHROPIC_AUTH_TOKEN:'synthetic-offline-model-alias-token',NODE_EXTRA_CA_CERTS:join(directory,'ca.crt'),
     CLAUDE_CONFIG_DIR:join(directory,'config'),CLAUDE_SECURESTORAGE_CONFIG_DIR:join(directory,'secure'),
     CLAUDE_CODE_MAX_OUTPUT_TOKENS:'8192',MAX_THINKING_TOKENS:'0',CLAUDE_CODE_ENTRYPOINT:'sdk-ts',
     CLAUDE_AGENT_SDK_VERSION:'0.3.295',CLAUDE_CODE_SDK_READS_SESSION_STATE:'1',
     CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1'}}});
   try{for await(const event of run)if(event.type==='result'){outcome={subtype:event.subtype,isError:event.is_error};break;}}
   finally{await run.close();}
  }finally{clearTimeout(timer);}
  assert.deepEqual(outcome,{subtype:'success',isError:false});
  const messages=standIn.calls.filter(call=>call.pathname==='/v1/messages');
  assert.deepEqual(messages.map(call=>({method:call.method,model:call.model,stream:call.stream})),
   [{method:'POST',model:PRODUCT_PROXY_MODEL_ALIAS,stream:true}]);
 }finally{if(standIn)await standIn.close();rmSync(directory,{recursive:true,force:true});}
});
