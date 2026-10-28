/** Compose synthetic SQL fixtures for metadata preparation. No PostgreSQL durability claim. */
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
export function preparationPool(base){
 const metadata=createMetadataPoolFixture(),state={afterMetadata:null};
 const pool={options:metadata.pool.options,async connect(){
  const b=await base.connect(),m=await metadata.pool.connect();
  return {async query(config,values){
   if(typeof config==='object'&&config.text.includes('meri_commands.approval_metadata')){
    const result=await m.query(config);await state.afterMetadata?.();return result;
   }
   return b.query(config,values);
  },release(error){b.release(error);m.release(error);}};
 }};
 return {pool,metadata,state};
}
