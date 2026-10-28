/** Immutable Work intent only. The original prompt remains the brief; capabilities, tools, depth, concurrency,
 *  budget, approval and any scheduled origin/consent come from the current server owners, never from here. */
export const WORK_ENTRIES=Object.freeze(['start-work','delegate']);
export const WORK_JOB_KINDS=Object.freeze(['research','deliverable','audit','scheduled']);
/** Per-list maximum. Kept small: a Work brief names its deliverables and dependencies, it is not a plan store. */
export const MAX_WORK_ITEMS=20;
const text={type:'string',minLength:1,maxLength:200,pattern:'\\S'};
const list={type:'array',maxItems:MAX_WORK_ITEMS,uniqueItems:true,items:text};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const WORK_SELECTION_SCHEMA=Object.freeze(object({
 entry:{enum:[...WORK_ENTRIES]},
 jobKind:{enum:[...WORK_JOB_KINDS]},
 deliverables:list,
 dependencies:list,
}));
const KEYS=Object.freeze(['entry','jobKind','deliverables','dependencies']);
const pattern=Object.freeze({entry:new RegExp('^(?:start-work|delegate)$','u'),jobKind:new RegExp('^(?:research|deliverable|audit|scheduled)$','u')});
const ITEM=new RegExp('^[\\s\\S]{1,200}$','u');
const textLike=value=>typeof value==='string'&&ITEM.test(value)&&/\S/u.test(value);
function listOf(value){
 if(!Array.isArray(value))return null;
 const keys=Reflect.ownKeys(value);
 if(keys.length!==value.length+1||keys.some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9][0-9]*)$/u.test(key)||Number(key)>=value.length)))return null;
 const seen=new Set(),out=[];
 for(let i=0;i<value.length;i++){
  const item=Object.getOwnPropertyDescriptor(value,String(i));
  if(!item||!Object.hasOwn(item,'value')||!textLike(item.value)||seen.has(item.value))return null;
  seen.add(item.value);out.push(item.value);
 }
 return out.length>MAX_WORK_ITEMS?null:Object.freeze(out);
}
/** Accept data properties only; never evaluate Work-authored accessors or inherited authority.
 *  jobKind:'scheduled' is a product kind only: origin/consent/approval are not accepted here. */
export function assertWorkSelection(value){
 const fail=()=>{throw Object.assign(Error('WORK_SELECTION'),{code:'WORK_SELECTION'});};
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.length!==KEYS.length||keys.some(key=>typeof key!=='string'||!KEYS.includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))fail();
 const entry=descriptors.entry?.value,jobKind=descriptors.jobKind?.value;
 if(typeof entry!=='string'||!pattern.entry.test(entry)||typeof jobKind!=='string'||!pattern.jobKind.test(jobKind))fail();
 const deliverables=listOf(descriptors.deliverables?.value),dependencies=listOf(descriptors.dependencies?.value);
 if(!deliverables||!dependencies)fail();
 return Object.freeze({entry,jobKind,deliverables,dependencies});
}
