/** Request-owned use of a borrowed canonical pool. Cancellation evicts clients;
 * a late checkout can never run a statement or re-enter the pool as reusable.
 * SQL classification here tracks unresolved work, not authorization. Only the
 * owner's existing, trusted statements reach this adapter; unknown verbs are
 * conservatively treated as writes. No new connection or resource at import. */
export function createOwnerRequestWork({pool,onUnresolvedMutation=()=>{},readOnly=false}){
 if(typeof pool?.connect!=='function'||typeof onUnresolvedMutation!=='function'||typeof readOnly!=='boolean')
  throw Error('PRODUCT_OWNER_REQUEST_WORK_CONFIGURATION');
 const clients=new Set(),stopped=()=>Error('PRODUCT_OWNER_REQUEST_STOPPED');
 let closed=false;
 function check(){if(closed)throw stopped();}
 function release(record,error){
  if(record.released)return;
  record.released=true;clients.delete(record);
  try{record.client.release(error);}catch(caught){
   if(record.dirty||record.mutating)onUnresolvedMutation();
   throw caught;
  }
 }
 const scoped=Object.freeze({async connect(){
  check();const client=await pool.connect();
  const record={client,released:false,transaction:false,dirty:false,mutating:0};
  if(closed){try{client.release(stopped());}catch{}throw stopped();}
  clients.add(record);
  return Object.freeze({async query(...args){
   check();if(record.released)throw stopped();
   const text=typeof args[0]==='string'?args[0]:args[0]?.text;
   const verb=typeof text==='string'?/^\s*([A-Za-z]+)/u.exec(text)?.[1]?.toUpperCase():undefined;
   const control=['BEGIN','START','COMMIT','ROLLBACK','SET'].includes(verb);
   const writes=!control&&verb!=='SELECT'&&verb!=='SHOW';
   if(readOnly&&writes)throw Error('PRODUCT_OWNER_READ_ONLY');
   if(verb==='BEGIN'||verb==='START')record.transaction=true;
   if(writes){record.dirty=true;record.mutating++;}
   try{
    const result=await client.query(...args);
    if(verb==='COMMIT'||verb==='ROLLBACK'){record.transaction=false;record.dirty=false;}
    else if(writes&&!record.transaction)record.dirty=false;
    check();if(record.released)throw stopped();return result;
   }finally{if(writes)record.mutating--;}
  },release(error){return release(record,error);}});
 }});
 return Object.freeze({pool:scoped,get closed(){return closed;},close(){
  if(closed)return;closed=true;
  const outstanding=[...clients];
  if(outstanding.some(record=>record.dirty||record.mutating))onUnresolvedMutation();
  for(const record of outstanding)try{release(record,stopped());}catch{}
 }});
}
