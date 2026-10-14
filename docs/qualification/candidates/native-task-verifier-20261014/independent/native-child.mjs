import {join} from 'node:path';
const [workspace,config,session]=process.argv.slice(2);setInterval(()=>{},1000);process.stdin.setEncoding('utf8');
process.stdin.on('data',()=>{
 const project=workspace.replace(/[^a-zA-Z0-9]/gu,'-');
 process.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:session,claude_code_version:'2.1.295'})+'\n');
 process.stdout.write(JSON.stringify({type:'transcript_mirror',filePath:join(config,'projects',project,session+'.jsonl'),entries:[{type:'system',marker:'independent synthetic task'}]})+'\n');
});
