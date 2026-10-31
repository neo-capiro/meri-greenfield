/** Closed optional `office` control declaration. Pure: no secret read, fetch or network. */
import {posix} from 'node:path';
import {routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
const fault=()=>Object.assign(new Error('OFFICE_CONFIGURATION'),{code:'OFFICE_CONFIGURATION'});
const KEYS=Object.freeze(['enabled','editorOrigin','wopiOrigin','browserOrigin','keyFile','serviceSecretFile','coreOrigin']);
const SECRET_FILE=/^\/[A-Za-z0-9._\-\/]{1,4095}$/u;
const secretFile=value=>typeof value==='string'&&SECRET_FILE.test(value)&&posix.dirname(value)==='/run/meri'&&
 posix.basename(value)!=='.'&&posix.basename(value)!=='..'&&!value.includes('//');
const plain=(value)=>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw fault();
 const d=Object.getOwnPropertyDescriptors(value);
 for(const [key,x] of Object.entries(d))if(!KEYS.includes(key)||!x.enumerable||!Object.hasOwn(x,'value'))throw fault();
 return Object.fromEntries(Object.entries(d).map(([key,x])=>[key,x.value]));
};
export function protectedMaterialFiles(configuration){
 const values=[configuration?.native?.capabilityFile,configuration?.native?.serverCaFile,
  configuration?.temporal?.tls?.caFile,configuration?.temporal?.tls?.certFile,configuration?.temporal?.tls?.keyFile,
  configuration?.database?.connectionFile,configuration?.reads?.serviceSecretFile,
  configuration?.artifacts?.authority?.serviceSecretFile,
  ...routinesReservedSecretFiles(configuration)];
 return Object.freeze([...new Set(values.filter(value=>typeof value==='string'))]);
}
const origin=value=>{let u;try{u=new URL(value);}catch{throw fault();}
 if(typeof value!=='string'||u.protocol!=='https:'||u.origin!==value||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw fault();
 return u.origin;};
export function compileOfficeConfiguration(configuration){
 const raw=configuration?.office;if(raw===undefined)return null;
 const o=plain(raw);if(typeof o.enabled!=='boolean')throw fault();
 if(o.enabled===false){
  if(Object.keys(o).length!==1)throw fault();
  return Object.freeze(o);
 }
 if(KEYS.some(key=>!Object.hasOwn(o,key)))throw fault();
 const editorOrigin=origin(o.editorOrigin),wopiOrigin=origin(o.wopiOrigin),browserOrigin=origin(o.browserOrigin),coreOrigin=origin(o.coreOrigin);
 if(wopiOrigin===editorOrigin||browserOrigin!==configuration.http?.frontendOrigin||
  configuration.privateHttp===undefined||!secretFile(o.keyFile)||!secretFile(o.serviceSecretFile)||
  o.keyFile===o.serviceSecretFile||protectedMaterialFiles(configuration).some(path=>path===o.keyFile))throw fault();
 return Object.freeze({enabled:true,editorOrigin,wopiOrigin,browserOrigin,coreOrigin,keyFile:o.keyFile,serviceSecretFile:o.serviceSecretFile});
}
