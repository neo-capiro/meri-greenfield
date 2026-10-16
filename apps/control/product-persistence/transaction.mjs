/** One owned PostgreSQL transaction over a borrowed pg-compatible pool (never ended here). Bounded statement/lock waits; an
 * unknown BEGIN, failed rollback or unacknowledged COMMIT evicts the client and surfaces as uncertainty, never as rollback. */
import {ProductError,productFailure} from '../product-access/errors.mjs';
export function assertPool(pool){if(!pool||typeof pool.connect!=='function')throw new ProductError('PRODUCT_CONFIGURATION');return pool;}
/** `operation(client)` runs inside BEGIN…COMMIT. Owned ProductErrors thrown by it are preserved after rollback. */
export async function transact(pool,operation,{check=()=>{},readOnly=false,unavailable='STORE_UNAVAILABLE',uncertain='STORE_COMMIT_UNKNOWN'}={}){
 let client,begun=false,committing=false,reusable=false,failure,result;
 try{
  check();client=await pool.connect();check();
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');begun=true;check();
  await client.query("SET LOCAL statement_timeout = '5s'");await client.query("SET LOCAL lock_timeout = '2s'");check();
  result=await operation(client);check();
  committing=true;await client.query('COMMIT');reusable=true;
 }catch(error){
  if(committing)failure=new ProductError(uncertain,'UNKNOWN');
  else{
   if(begun){try{await client.query('ROLLBACK');reusable=true;}catch{}}
   failure=productFailure(error)?error:new ProductError(unavailable);
  }
 }finally{
  if(client){try{client.release(reusable?undefined:failure??new Error('evict'));}catch{failure??=new ProductError(uncertain,'UNKNOWN');}}
 }
 if(failure)throw failure;
 return result;
}
