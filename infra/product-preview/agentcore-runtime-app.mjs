import {readFile,writeFile} from 'node:fs/promises';
import {synthesizeAgentCoreRuntime} from './agentcore-runtime.mjs';

if(process.argv.length!==4)throw Error('Usage: node agentcore-runtime-app.mjs <binding.json> <template.json>');
const template=synthesizeAgentCoreRuntime(JSON.parse(await readFile(process.argv[2],'utf8')));
await writeFile(process.argv[3],JSON.stringify(template,null,2)+'\n',{flag:'wx'});
