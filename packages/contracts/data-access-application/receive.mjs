import {validators} from './generated-validator.mjs';
import {dataAccessMetadata} from './generated-protocol.mjs';
import {parseBytes} from '../document-application/boundary.mjs';
export {dataAccessVersion} from './protocol.mjs';
export {dataAccessMetadata};
export class DataAccessResponseError extends Error {constructor(code){super(code);this.name='DataAccessResponseError';this.code=code;}}
const fail=code=>{throw new DataAccessResponseError(code);};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function parseText(value,cap){
 if(typeof value!=='string')fail('DATA_ACCESS_JSON');
 if(value.length>cap)fail('DATA_ACCESS_LIMIT');
 if(!value.isWellFormed())fail('DATA_ACCESS_JSON');
 try{return parseBytes(new TextEncoder().encode(value),cap);}catch(error){fail(['BYTE_LIMIT','JSON_LIMIT'].includes(error.code)?'DATA_ACCESS_LIMIT':'DATA_ACCESS_JSON');}
}
const check=(name,value)=>{if(!validators[name](value))fail('DATA_ACCESS_SHAPE');return value;};
/** The caller's own request text, validated before it is sent. It carries no identity; the server takes that only from its admission. */
export function receiveDataAccessRequest(jsonText){
 return freeze(check('DataAccessRequest',parseText(jsonText,dataAccessMetadata.limits.requestBytes)));
}
/** Read Response.text(). The captured request is mandatory: an answer is admitted only as the answer to exactly that request. */
export function receiveDataAccessResponse(httpStatus,jsonText,request){
 if(!Number.isInteger(httpStatus))fail('DATA_ACCESS_STATUS');
 const expected=check('DataAccessRequest',parseText(JSON.stringify(request),dataAccessMetadata.limits.requestBytes));
 const value=parseText(jsonText,dataAccessMetadata.limits.responseBytes);
 if(httpStatus!==200){
  check('DataAccessErrorResponse',value);
  if(dataAccessMetadata.errorStatuses[value.error.code]!==httpStatus||httpStatus===502&&Object.hasOwn(value.error,'field'))fail('DATA_ACCESS_STATUS');
  return freeze(value);
 }
 check('DataAccessResponse',value);
 if(value.clientId!==expected.clientId)fail('DATA_ACCESS_CORRELATION');
 const families=value.families.map(row=>row.family);
 if(new Set(families).size!==families.length||families.some((family,index)=>index>0&&family<=families[index-1]))fail('DATA_ACCESS_CORRELATION');
 const relations=value.relations.map(row=>row.source+'/'+row.name);
 if(new Set(relations).size!==relations.length)fail('DATA_ACCESS_CORRELATION');
 // A family or relation can only be available while general reads are admitted at all.
 if(value.generalReads===false&&[...value.families,...value.relations].some(row=>row.state==='available'||row.state==='client_required'))fail('DATA_ACCESS_CORRELATION');
 return freeze(value);
}
