/** Shared model choice data. Provider credentials and qualification remain runtime/deployment owners. */
export const MODEL_PROVIDERS=Object.freeze(['bedrock','claude-api']);
export const MODEL_EFFORTS=Object.freeze(['low','medium','high','xhigh','max']);
export const HISTORICAL_MODEL_SELECTION=Object.freeze({provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:null});
const id={type:'string',pattern:'^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$'},effort={anyOf:[{type:'null'},{type:'string',enum:MODEL_EFFORTS}]};
export const MODEL_SELECTION_SCHEMA=Object.freeze({type:'object',properties:{provider:{enum:MODEL_PROVIDERS},modelId:id,effort},required:['provider','modelId','effort'],additionalProperties:false});
export const MODEL_CATALOG_SCHEMA=Object.freeze({type:'object',properties:{defaultSelection:MODEL_SELECTION_SCHEMA,models:{type:'array',minItems:1,maxItems:128,items:{type:'object',properties:{provider:{enum:MODEL_PROVIDERS},modelId:id,label:{type:'string',minLength:1,maxLength:200},efforts:{type:'array',items:effort,minItems:1,maxItems:6,uniqueItems:true},available:{type:'boolean'},unavailableReason:{enum:[null,'provider_unconfigured','model_unqualified']}},required:['provider','modelId','label','efforts','available','unavailableReason'],additionalProperties:false}}},required:['defaultSelection','models'],additionalProperties:false});
const fail=code=>{throw Object.assign(new Error(code),{code});};
function fields(value,names){
 if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('MODEL_SELECTION_INVALID');
 const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
 if(keys.length!==names.length||keys.some(k=>typeof k!=='string'||!names.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail('MODEL_SELECTION_INVALID');
 return Object.fromEntries(names.map(k=>[k,d[k].value]));
}
const modelId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/u.test(value);
export function assertModelSelection(value){const s=fields(value,['provider','modelId','effort']);if(!MODEL_PROVIDERS.includes(s.provider)||!modelId(s.modelId)||s.effort!==null&&!MODEL_EFFORTS.includes(s.effort))fail('MODEL_SELECTION_INVALID');return Object.freeze(s);}
export function assertModelCatalog(value){
 const c=fields(value,['defaultSelection','models']),defaultSelection=assertModelSelection(c.defaultSelection);
 if(!Array.isArray(c.models)||c.models.length<1||c.models.length>128)fail('MODEL_CATALOG_INVALID');
 const seen=new Set(),models=c.models.map(raw=>{const m=fields(raw,['provider','modelId','label','efforts','available','unavailableReason']),key=m.provider+'\0'+m.modelId;
  if(!MODEL_PROVIDERS.includes(m.provider)||!modelId(m.modelId)||seen.has(key)||typeof m.label!=='string'||!m.label.trim()||m.label.length>200||!Array.isArray(m.efforts)||m.efforts.length<1||m.efforts.length>6||new Set(m.efforts).size!==m.efforts.length||m.efforts.some(e=>e!==null&&!MODEL_EFFORTS.includes(e))||typeof m.available!=='boolean'||(m.available?m.unavailableReason!==null:!['provider_unconfigured','model_unqualified'].includes(m.unavailableReason)))fail('MODEL_CATALOG_INVALID');
  seen.add(key);return Object.freeze({...m,efforts:Object.freeze([...m.efforts])});});
 const row=models.find(m=>m.provider===defaultSelection.provider&&m.modelId===defaultSelection.modelId);
 if(!row?.available||!row.efforts.includes(defaultSelection.effort))fail('MODEL_CATALOG_INVALID');
 return Object.freeze({defaultSelection,models:Object.freeze(models)});
}
export function availableModelSelection(catalog,value){const c=assertModelCatalog(catalog),s=assertModelSelection(value),row=c.models.find(m=>m.provider===s.provider&&m.modelId===s.modelId);if(!row?.available||!row.efforts.includes(s.effort))fail('MODEL_SELECTION_UNAVAILABLE');return s;}
/** Absence is only the known pre-MP persisted request format, never today's configurable default. */
export function storedModelSelection(request){return Object.hasOwn(request,'modelSelection')?assertModelSelection(request.modelSelection):HISTORICAL_MODEL_SELECTION;}
