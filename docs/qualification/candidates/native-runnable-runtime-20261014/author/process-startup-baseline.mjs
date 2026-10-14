import {fork} from 'node:child_process';import {once} from 'node:events';
const started=Date.now(),child=fork(new URL('file:///workspace/meri-pr77-startup-baseline-20261014/apps/runtime/test/process-fixture.mjs'),[],{execArgv:[],stdio:['ignore','pipe','pipe','ipc']});let stderr='',ready=false;
child.stderr.on('data',bytes=>stderr+=bytes);child.stdout.resume();child.on('message',message=>{if(message.type==='ready'){ready=true;process.stdout.write(JSON.stringify({phase:'ready',durationMs:Date.now()-started})+'\n');child.send('close');}});
const timer=setTimeout(()=>{process.stdout.write(JSON.stringify({phase:'startup-timeout',durationMs:Date.now()-started})+'\n');child.kill('SIGTERM');},20000),hard=setTimeout(()=>child.kill('SIGKILL'),25000);
const [code,signal]=await once(child,'exit');clearTimeout(timer);clearTimeout(hard);process.stdout.write(JSON.stringify({ready,code,signal,durationMs:Date.now()-started,stderr})+'\n');if(!ready||code!==0)process.exitCode=1;
