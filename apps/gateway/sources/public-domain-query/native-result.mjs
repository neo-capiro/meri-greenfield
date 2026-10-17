/** Native analytics success includes generated SQL; it never belongs in the frozen public result. */
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export function projectNativeQueryResult(_current,nativeResult){
 try{
  const data=frozenData(nativeResult);
  // Errors keep their native values; the unchanged closed receiving contract validates them.
  if(Object.hasOwn(data,'ok'))return data;
  const {sql,...result}=ownFields(data,['tool','generatedAt','dataset','sql','rowCount','rows'],['truncated','note']);
  if(typeof sql!=='string'||sql.length===0)deny('INVALID_RESULT');
  return result;
 }catch{deny('INVALID_RESULT');}
}
