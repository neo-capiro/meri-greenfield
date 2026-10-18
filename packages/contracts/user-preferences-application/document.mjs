/** Canonical pure user preference document. Membership and persistence remain server owners. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const USER_PREFERENCE_THEMES=Object.freeze(['system','light','dark']);
export const USER_PREFERENCE_DENSITIES=Object.freeze(['comfortable','compact']);
export const USER_PREFERENCE_NOTIFICATIONS=Object.freeze(['runCompleted','approvalRequested','memoryReviewed']);
export const USER_PREFERENCE_UUID_PATTERN='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const uuid=new RegExp(USER_PREFERENCE_UUID_PATTERN,'u'),failures=new WeakMap();
export class UserPreferencesDocumentError extends Error {constructor(code,field=null){super(code);this.name='UserPreferencesDocumentError';failures.set(this,Object.freeze({code,field}));}}
export const userPreferencesDocumentFailure=error=>failures.get(error)??null;
const fail=(code,field)=>{throw new UserPreferencesDocumentError(code,field);};
const field=name=>fail('SETTINGS_FIELD_INVALID',name);
function closed(value,keys,code,name){
 try{
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code,name);
  const descriptors=Object.getOwnPropertyDescriptors(value),ownKeys=Reflect.ownKeys(descriptors);
  if(ownKeys.length!==keys.length||keys.some(key=>!Object.hasOwn(descriptors,key))||ownKeys.some(key=>typeof key!=='string'||!keys.includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))fail(code,name);
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 }catch(error){if(userPreferencesDocumentFailure(error))throw error;fail(code,name);}
}
export function userPreferencesTimezone(value,name='timezone'){
 if(typeof value!=='string'||value.length>64)field(name);
 let resolved;try{resolved=new Intl.DateTimeFormat('en-US',{timeZone:value}).resolvedOptions().timeZone;}catch{field(name);}
 if(resolved!==value&&!(value==='UTC'&&resolved==='UTC'))field(name);return value;
}
const fields={
 theme:{schema:{type:'string',enum:USER_PREFERENCE_THEMES},default:'system',parse:value=>{if(!USER_PREFERENCE_THEMES.includes(value))field('theme');return value;}},
 density:{schema:{type:'string',enum:USER_PREFERENCE_DENSITIES},default:'comfortable',parse:value=>{if(!USER_PREFERENCE_DENSITIES.includes(value))field('density');return value;}},
 timezone:{schema:{type:['string','null'],maxLength:64},default:null,parse:value=>value===null?null:userPreferencesTimezone(value)},
 notifications:{schema:{type:'object',properties:Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map(name=>[name,{type:'boolean'}])),required:USER_PREFERENCE_NOTIFICATIONS,additionalProperties:false},default:Object.fromEntries(USER_PREFERENCE_NOTIFICATIONS.map(name=>[name,true])),parse:value=>{
  const n=closed(value,USER_PREFERENCE_NOTIFICATIONS,'SETTINGS_FIELD_INVALID','notifications');for(const key of USER_PREFERENCE_NOTIFICATIONS)if(typeof n[key]!=='boolean')field('notifications.'+key);return Object.freeze(n);
 }},
 defaultClientId:{schema:{anyOf:[{type:'string',pattern:USER_PREFERENCE_UUID_PATTERN},{type:'null'}]},default:null,parse:value=>{if(value===null)return null;if(typeof value!=='string'||!uuid.test(value.toLowerCase()))field('defaultClientId');return value.toLowerCase();}},
};
export const USER_PREFERENCE_FIELDS=Object.freeze(Object.keys(fields));
export const USER_PREFERENCE_DEFAULTS=freeze(Object.fromEntries(Object.entries(fields).map(([name,definition])=>[name,definition.default])));
export const USER_PREFERENCES_DOCUMENT_SCHEMA=freeze({type:'object',properties:Object.fromEntries(Object.entries(fields).map(([name,definition])=>[name,definition.schema])),required:USER_PREFERENCE_FIELDS,additionalProperties:false});
/** Assumes external boundaries separately reject executable objects. Returns the canonical normalized document. */
export function userPreferencesDocument(value){
 const input=closed(value,USER_PREFERENCE_FIELDS,'SETTINGS_DOCUMENT_INVALID');
 return Object.freeze(Object.fromEntries(Object.entries(fields).map(([name,definition])=>[name,definition.parse(input[name])])));
}
