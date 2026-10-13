/** Borrowed qualification connections: public application tables precede explicit pg_temp. */
export function createQualificationPoolFacade(pool){
 if(!pool||typeof pool.connect!=='function')throw Error('QUALIFICATION_POOL_REQUIRED');
 return Object.freeze({async connect(){
  const client=await pool.connect();
  return Object.freeze({async query(sql,...args){
   const result=await client.query(sql,...args);
   if(sql==='BEGIN')await client.query('SET LOCAL search_path TO pg_catalog, public, pg_temp');
   return result;
  },release:error=>client.release(error)});
 }});
}
