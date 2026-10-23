// In-image generation smoke: the fixed executor over the image's own paths, as the node user, read-only root, /tmp tmpfs, no network.
import {createLocalArtifactExecutor} from '/opt/meri/apps/artifacts/local-executor.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.equal(process.platform,'linux');assert.equal(process.arch,'arm64');
assert.equal(process.getuid(),1000);assert.equal(process.getgid(),1000);
const rootMount=fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').map(line=>line.split(' ')).find(fields=>fields[4]==='/');
assert(rootMount?.[5].split(',').includes('ro'),'Generation smoke requires a read-only root mount');
const executor=createLocalArtifactExecutor({pythonExecutable:'/usr/bin/python3.13',nodeExecutable:'/usr/local/bin/node',pptxModulePath:'/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs',tempRoot:'/tmp',timeoutMs:30000});
const chart={kind:'bar',title:'Totals',categories:['a','b'],series:[{name:'s',values:[1,2]}]};
const requests={
 txt:{operation:'create_word',format:'txt',title:'Note',content:{text:'hello from the image\n'}},
 docx:{operation:'create_word',format:'docx',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Normal',runs:[{text:'Hello ',bold:true},{text:'world',italic:true}]},{kind:'table',rows:[['A','B'],['1','2']]},{kind:'chart',chart}]}},
 xlsx:{operation:'create_excel',format:'xlsx',title:'Book',content:{sheets:[{name:'Data',rows:[[{value:'x'},{value:1}],[{value:'y'},{value:2}],[{value:'sum'},{formula:'=SUM(B1:B2)',numberFormat:'0.00'}]],charts:[chart]}]}},
 pptx:{operation:'create_powerpoint',format:'pptx',title:'Deck',content:{slides:[{title:'Summary',bullets:['First','Second']},{title:'Table',table:[['A','B'],['1','2']]},{title:'Chart',chart},{title:'Notes',bullets:['x'],notes:'speaker'}]}},
 zip:{operation:'analyze_data',format:'zip',title:'Totals',content:{tables:[{name:'Data',columns:['value'],rows:[[1],[2]]}],source:'Data',steps:[{kind:'aggregate',function:'sum',column:'value',groupBy:[],name:'total'}]}},
};
const out={};
for(const [format,request] of Object.entries(requests)){
 const started=Date.now();
 const {bytes,inspection,processReceipt}=await executor.execute({request,assets:[],base:null,deadlineMs:Date.now()+60000,maxBytes:8388608,signal:undefined});
 assert.equal(processReceipt.exitCode,0);assert.equal(processReceipt.groupAbsent,true);
 if(createHash('sha256').update(bytes).digest('hex')!==inspection.sha256)throw Error('sha mismatch '+format);
 out[format]={bytes:bytes.length,sha256:inspection.sha256,members:inspection.members.length,details:inspection.details,exitCode:processReceipt.exitCode,stderrBytes:processReceipt.stderrBytes,groupAbsent:processReceipt.groupAbsent,ms:Date.now()-started};
}
console.log(JSON.stringify({phase:'in-image-generation',user:process.getuid(),readOnlyRootChecked:true,results:out}));
