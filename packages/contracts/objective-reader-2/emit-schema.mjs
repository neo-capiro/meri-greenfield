/** Explicit contract artifact generator; import performs no filesystem writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {objectiveReaderSchema} from './schema.mjs';
import {candidateSchema} from '../strategy-operations-candidate/schema.mjs';
const base=JSON.parse(readFileSync(new URL('../meri.schema.json',import.meta.url)));
export function emitObjectiveReaderSchema(){
 const candidate=candidateSchema(),registry=new Map([base,candidate,objectiveReaderSchema].map(s=>[s.$id,s]));
 function expand(value,current,seen=[]){
  if(Array.isArray(value))return value.map(v=>expand(v,current,seen));
  if(!value||typeof value!=='object')return value;
  if(value.$ref){
   const [id,pointer]=value.$ref.split('#'),root=id?registry.get(id):current;
   if(!root||!pointer?.startsWith('/'))throw Error('Unknown contract reference');
   const stamp=root.$id+'#'+pointer;if(seen.includes(stamp))throw Error('Cyclic contract reference');
   const selected=pointer.slice(1).split('/').reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],root);
   if(!selected)throw Error('Absent contract reference');
   return expand(selected,root,[...seen,stamp]);
  }
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v,current,seen)]));
 }
 return expand(objectiveReaderSchema,objectiveReaderSchema);
}
if(process.argv[1]===fileURLToPath(import.meta.url))writeFileSync(new URL('./reader.schema.json',import.meta.url),JSON.stringify(emitObjectiveReaderSchema(),null,2)+'\n');
