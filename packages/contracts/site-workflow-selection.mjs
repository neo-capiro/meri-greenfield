/** Immutable identity only. Core owns the current enabled workflow and its policy. */
const slug={type:'string',pattern:'^[a-z][a-z0-9-]{1,63}$'};
export const SITE_WORKFLOW_SELECTION_SCHEMA=Object.freeze({type:'object',properties:{
 siteId:slug,workflowId:slug,version:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
 manifestSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},
},required:['siteId','workflowId','version','manifestSha256'],additionalProperties:false});
export function assertSiteWorkflowSelection(value){
 const fail=()=>{throw Object.assign(Error('SITE_WORKFLOW_SELECTION'),{code:'SITE_WORKFLOW_SELECTION'});};
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.length!==4||keys.some(k=>typeof k!=='string'||!Object.hasOwn(SITE_WORKFLOW_SELECTION_SCHEMA.properties,k)||
   !descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')))fail();
 const {siteId,workflowId,version,manifestSha256}=Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
 if(typeof siteId!=='string'||!new RegExp(slug.pattern,'u').test(siteId)||typeof workflowId!=='string'||!new RegExp(slug.pattern,'u').test(workflowId)||
   !Number.isSafeInteger(version)||version<1||typeof manifestSha256!=='string'||!/^[a-f0-9]{64}$/u.test(manifestSha256))fail();
 return Object.freeze({siteId,workflowId,version,manifestSha256});
}
