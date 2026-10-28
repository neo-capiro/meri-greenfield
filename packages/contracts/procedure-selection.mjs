/** Immutable procedure identity only. Instructions and execution policy come from the current Core owner. */
export const BUILTIN_PROCEDURE_IDS=Object.freeze(['briefing','draft','bill_analysis','hearing_prep','coalition_letter','amendment_tracker']);
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const version={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const PROCEDURE_SELECTION_SCHEMA=Object.freeze({oneOf:[
 object({source:{const:'firm'},recordId:uuid,version,manifestDigest:digest}),
 object({source:{const:'builtin'},id:{enum:[...BUILTIN_PROCEDURE_IDS]},version,manifestDigest:digest}),
]});
/** Accept data properties only; never evaluate selection-authored accessors or inherited authority. */
export function assertProcedureSelection(value){
 const fail=()=>{throw Object.assign(Error('PROCEDURE_SELECTION'),{code:'PROCEDURE_SELECTION'});};
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.length!==4||keys.some(key=>typeof key!=='string'||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))fail();
 const source=descriptors.source?.value,identity=source==='firm'?'recordId':source==='builtin'?'id':null;
 if(!identity||keys.some(key=>!['source',identity,'version','manifestDigest'].includes(key)))fail();
 const selected=descriptors[identity]?.value,n=descriptors.version?.value,sha=descriptors.manifestDigest?.value;
 if(typeof selected!=='string'||(source==='firm'?!new RegExp(uuid.pattern,'u').test(selected):!BUILTIN_PROCEDURE_IDS.includes(selected))||
    !Number.isSafeInteger(n)||n<1||typeof sha!=='string'||!new RegExp(digest.pattern,'u').test(sha))fail();
 return Object.freeze({source,[identity]:selected,version:n,manifestDigest:sha});
}
