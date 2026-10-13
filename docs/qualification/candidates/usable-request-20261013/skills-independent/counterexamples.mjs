import {fixture} from '../../../../../packages/skills/test/commitments-fixture.mjs';
import {compileCommitmentsAudit} from '../../../../../packages/skills/commitments/index.mjs';
const results=[];
for(const [name,edit]of [
 ['operation-source-substitution',f=>f.reads[0].operation={id:'query_tasks',version:'0.2.0'}],
 ['monday-authority-upgrade',f=>f.reads.at(-1).sources[0].authority='authoritative'],
 ['source-authority-visibility',()=>{}]
]){
 const f=fixture();edit(f);
 try{results.push({name,accepted:true,inputContext:f.context,reads:f.reads,input:f.input,output:compileCommitmentsAudit(f.input,{context:f.context,reads:f.reads})});}
 catch(error){results.push({name,accepted:false,error:error.message});}
}
process.stdout.write(JSON.stringify({synthetic:true,nativeQualified:false,results},null,2)+'\n');
