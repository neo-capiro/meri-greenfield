#!/usr/bin/env node
import {configuration,usage} from './configuration.mjs';
async function main(){
 try{
  const config=configuration(process.argv.slice(2));
  if(config.mode==='help'){process.stdout.write(usage);return;}
  if(config.mode==='plan'){process.stdout.write(JSON.stringify({...config,status:'PLAN_ONLY_NO_AUTHORITY_NO_IO',executionRequiresFutureApproval:true},null,2)+'\n');return;}
  const {qualify}=await import('./run.mjs');process.exitCode=await qualify(config);
 }catch(error){process.stderr.write((error.code==='USAGE'?error.message:'QUALIFICATION_FAILED_PRIVATE_DETAIL_WITHHELD')+'\n');if(error.code==='USAGE')process.stderr.write(usage);process.exitCode=error.code==='USAGE'?2:1;}
}
await main();
