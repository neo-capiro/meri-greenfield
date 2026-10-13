/** Real-pg forwarding fault: never simulates SQL or retries a statement. */
import {method,options,deny} from '../binding.mjs';
const kinds=Object.freeze({
 claim:"INSERT INTO meri_task_lookup.lookups(",
 dispatch:"UPDATE meri_task_lookup.lookups SET state='DISPATCHING'",
 result:"UPDATE meri_task_lookup.lookups SET state='RESULT'",
});
export function createCommitAckFault(configuration){
 const {pool,phase}=options(configuration,['pool','phase']);
 if(!Object.hasOwn(kinds,phase))deny('LOCAL_FAULT_CONFIGURATION');
 const connect=method(pool,'connect');let fired=false,commits=0,evictions=0;
 const wrapped=Object.freeze({async connect(){
  const client=await connect(),query=method(client,'query'),release=method(client,'release');let selected=false;
  return Object.freeze({async query(...args){
   const sql=args[0];
   if(sql==='BEGIN')selected=false;
   if(typeof sql==='string'&&sql.startsWith(kinds[phase]))selected=true;
   const result=await query(...args);
   if(sql==='COMMIT'){
    commits++;
    if(selected&&!fired){fired=true;throw Object.assign(new Error('LOCAL_COMMIT_ACK_LOST'),{code:'LOCAL_COMMIT_ACK_LOST'});}
    selected=false;
   }else if(sql==='ROLLBACK')selected=false;
   return result;
  },release(error){if(error)evictions++;return release(error);}});
 }});
 return Object.freeze({pool:wrapped,receipt:()=>Object.freeze({phase,fired,commits,evictions})});
}
