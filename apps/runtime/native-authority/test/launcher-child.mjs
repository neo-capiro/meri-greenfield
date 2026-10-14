/** Synthetic native-format child, no SDK/model/provider or authority. */
import {createInterface} from 'node:readline';
import {join} from 'node:path';
const [workspace,config,session,mode]=process.argv.slice(2);
const init={type:'system',subtype:'init',session_id:session,claude_code_version:'2.1.295'};
const main={type:'transcript_mirror',filePath:join(config,'projects',workspace.replace(/[^a-zA-Z0-9]/gu,'-'),session+'.jsonl'),entries:[{type:'user',content:'Synthetic ☕ bytes'}]};
const reader=createInterface({input:process.stdin});
reader.on('line',line=>{
 if(line==='emit')process.stdout.write(mode==='bad'?'malformed\n':JSON.stringify(init)+'\n'+JSON.stringify(main)+'\n');
 if(line==='env')process.stdout.write(JSON.stringify({type:'fixture',ambient:process.env.MERI_LAUNCH_AMBIENT??null})+'\n');
 if(line==='exit')process.exit(0);
});
reader.on('close',()=>{if(mode==='stubborn')setInterval(()=>{},1000);else process.exit(0);});
if(mode==='stubborn')process.on('SIGTERM',()=>{});
