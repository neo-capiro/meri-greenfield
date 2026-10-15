/** Registered read handlers with their ordered source-file manifest, and measurement of those exact bytes.
 * Shared by the selected-skill and general-read installation owners; neither qualifies code by itself. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const key=op=>`${op.id}@${op.version}`;
/** `handlers` is a plain Map keyed `id@version` of `{execute,sourceSha256,sourceFiles:[{label,sha256}]}`; labels are
 * paths relative to `sourceRoot` (default: the repository root). `fail` is the owner's own refusal. */
export function registerMeasuredHandlers({handlers:configured,sourceRoot:root,fail}){
 if(types.isProxy(configured)||!(configured instanceof Map)||Object.getPrototypeOf(configured)!==Map.prototype)fail();
 const sourceRoot=resolve(root??fileURLToPath(new URL('../../../',import.meta.url))),handlers=new Map(),files=new Map();
 for(const [id,handler]of Map.prototype.entries.call(configured)){const h=own(handler,['execute','sourceSha256','sourceFiles']);if(typeof h.execute!=='function')fail();const records=data(h.sourceFiles);
  if(!Array.isArray(records)||records.length<1||records.length>128)fail();const labels=new Set();for(const row of records){own(row,['label','sha256']);if(typeof row.label!=='string'||!/^[-A-Za-z0-9_./]+$/u.test(row.label)||row.label.split('/').some(p=>p==='.'||p==='..'||p==='')||labels.has(row.label)||!(/^[a-f0-9]{64}$/u.test(row.sha256)))fail();labels.add(row.label);}
  if(h.sourceSha256!==canonicalSha256(records))fail();files.set(id,records);handlers.set(id,Object.freeze({sourceSha256:h.sourceSha256,execute:call=>h.execute.call(handler,call)}));
 }
 /** Reads every registered file of `operation` (regular file, no symlink, bounded) and compares its SHA-256. */
 async function measure(operation,life){const records=files.get(key(operation));if(!records)fail();let total=0;for(const r of records){const path=resolve(sourceRoot,r.label);if(!path.startsWith(sourceRoot+sep))fail();let handle;
   try{handle=await life.run(()=>open(path,constants.O_RDONLY|constants.O_NOFOLLOW).then(async acquired=>{try{life.check();return acquired;}catch(error){await acquired.close();throw error;}}));const stat=await life.run(()=>handle.stat());if(!stat.isFile()||stat.size>8*1024*1024||(total+=stat.size)>16*1024*1024)fail();const bytes=await life.run(signal=>handle.readFile({signal}));if(bytes.length!==stat.size||createHash('sha256').update(bytes).digest('hex')!==r.sha256)fail();}finally{await handle?.close();}}
 }
 return Object.freeze({handlers,measure,sourceSha256:operation=>handlers.get(key(operation))?.sourceSha256});
}
