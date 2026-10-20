#!/usr/bin/env node
/** Offline renderer. Exit 0: rendered/help; exit 2: invalid arguments/input. Never deploys or reads private material. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {observabilityBindingFromDeployment,synthesizeFirstChatObservability} from './first-chat-observability.mjs';

const defaultInputs=new URL('./first-chat/deployment-inputs.json',import.meta.url);
export const HELP='Usage: node infra/product-preview/render-observability.mjs [--deployment-inputs FILE] [--environment Preview|Production] [--alarm-email EMAIL]\nWrites CloudFormation JSON to stdout. Exit codes: 0 success/help, 2 invalid input. No AWS access.\n';
export async function main(argv=process.argv.slice(2),{read=readFile,write=text=>process.stdout.write(text),error=text=>process.stderr.write(text)}={}){
 try{
  if(argv.length===1&&['--help','-h'].includes(argv[0])){write(HELP);return 0;}
  const options={};
  for(let i=0;i<argv.length;i+=2){const key=argv[i];if(!['--deployment-inputs','--environment','--alarm-email'].includes(key)||!argv[i+1]||argv[i+1].startsWith('--')||Object.hasOwn(options,key))throw Error();options[key]=argv[i+1];}
  if(options['--environment']!==undefined&&!['Preview','Production'].includes(options['--environment']))throw Error();
  const deployment=JSON.parse(await read(options['--deployment-inputs']??defaultInputs,'utf8'));
  const binding=observabilityBindingFromDeployment(deployment,{environment:options['--environment'],alarmEmail:options['--alarm-email']});
  write(JSON.stringify(synthesizeFirstChatObservability(binding),null,2)+'\n');return 0;
 }catch{error('OBSERVABILITY_CONFIGURATION\n');return 2;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
