import {join} from 'node:path';
const [workspace,config,session,mode]=process.argv.slice(2);
const init={type:'system',subtype:'init',session_id:session,claude_code_version:'2.1.295'};
const mirror={type:'transcript_mirror',filePath:join(config,'projects',workspace.replace(/[^a-zA-Z0-9]/gu,'-'),session+'.jsonl'),entries:[{type:'user',text:'independent synthetic child'}]};
const write=x=>process.stdout.write(JSON.stringify(x)+'\n');
if(mode==='natural'){
 write(init);setTimeout(()=>{write(mirror);write({type:'result',subtype:'success',is_error:false});process.stdout.end();},30);
}else{
 if(mode==='stubborn')process.on('SIGTERM',()=>{});
 setInterval(()=>{},1000);
 process.stdin.setEncoding('utf8');let pending='';
 process.stdin.on('data',chunk=>{pending+=chunk;let p;while((p=pending.indexOf('\n'))>=0){const command=pending.slice(0,p);pending=pending.slice(p+1);if(command==='frames'){write(init);write(mirror);}if(command==='bad')process.stdout.write('{malformed}\n');if(command==='exit')process.exit(0);}});
}
