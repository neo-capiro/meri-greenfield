/** Retained upload identity selected by the user; never a status, locator or permission. */
export const MAX_INPUT_UPLOADS=8;
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const digest={type:'string',pattern:'^[0-9a-f]{64}$'};
export const UPLOAD_SELECTIONS_SCHEMA=Object.freeze({type:'array',minItems:1,maxItems:MAX_INPUT_UPLOADS,uniqueItems:true,items:{type:'object',properties:{uploadId:uuid,sha256:digest},required:['uploadId','sha256'],additionalProperties:false}});
/** Receivers call this only after immutable JSON parsing; Node callers snapshot first. */
export function assertUploadSelections(value){
 const fail=()=>{throw Object.assign(Error('UPLOAD_SELECTION'),{code:'UPLOAD_SELECTION'});};
 if(!Array.isArray(value)||value.length<1||value.length>MAX_INPUT_UPLOADS)fail();
 const arrayKeys=Reflect.ownKeys(value);if(arrayKeys.length!==value.length+1||arrayKeys.some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9][0-9]*)$/u.test(key)||Number(key)>=value.length)))fail();
 const seen=new Set(),result=[];
 for(let i=0;i<value.length;i++){
  const item=Object.getOwnPropertyDescriptor(value,String(i));if(!item||!Object.hasOwn(item,'value'))fail();
  const selection=item.value;if(!selection||typeof selection!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(selection)))fail();
  const descriptors=Object.getOwnPropertyDescriptors(selection),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==2||keys.some(key=>!['uploadId','sha256'].includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))fail();
  const uploadId=descriptors.uploadId.value,sha256=descriptors.sha256.value;
  if(typeof uploadId!=='string'||!new RegExp(uuid.pattern,'u').test(uploadId)||typeof sha256!=='string'||!new RegExp(digest.pattern,'u').test(sha256)||seen.has(uploadId))fail();
  seen.add(uploadId);result.push(Object.freeze({uploadId,sha256}));
 }
 return Object.freeze(result);
}
