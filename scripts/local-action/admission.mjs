/** Admission for an existing disposable native fixture; never provisions a database. */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {open,readFile} from 'node:fs/promises';
import {parseNativeAdmission} from '../../apps/gateway/test/postgres-budget-native-fixture.mjs';

const root=new URL('../../',import.meta.url);
export const migrationPaths=Object.freeze({
  qualification:'apps/proxy/qualification/state/migrations/0001_qualification_state.sql',
  budget:'apps/proxy/qualification/state/migrations/0002_tool_budget.sql',
  invocation:'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql',
  lookup:'apps/control/task-lookup/migrations/0001_task_lookup.sql',
});
const digest=value=>createHash('sha256').update(value).digest('hex');
const refuse=()=>{throw new Error('LOCAL_ACTION_ADMISSION_REQUIRED');};
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export async function readLocalActionAdmission({path,sha256,now=Date.now}){
  if(typeof path!=='string'||!path||!/^([a-f0-9]{64})$/.test(sha256??'')||typeof now!=='function')refuse();
  let handle;
  try{
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const before=await handle.stat();
    if(!before.isFile()||before.nlink!==1||(before.mode&0o077)!==0||before.size<2||before.size>16384)refuse();
    const buffer=Buffer.alloc(16385);let bytesRead=0;
    while(bytesRead<buffer.length){const part=await handle.read(buffer,bytesRead,buffer.length-bytesRead,bytesRead);if(!part.bytesRead)break;bytesRead+=part.bytesRead;}
    const after=await handle.stat();
    if(bytesRead!==before.size||['dev','ino','size','mtimeMs','ctimeMs'].some(key=>before[key]!==after[key]))refuse();
    const raw=buffer.subarray(0,bytesRead);if(digest(raw)!==sha256)refuse();
    const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    if(!exact(input,['schema','native','migrationSha256'])||input.schema!=='meri-local-action-input/1'||
       !exact(input.migrationSha256,Object.keys(migrationPaths)))refuse();
    for(const [key,relative]of Object.entries(migrationPaths)){
      if(input.migrationSha256[key]!==digest(await readFile(new URL(relative,root))))refuse();
    }
    const nativeRaw=JSON.stringify(input.native);
    // Preserve the existing native admission's ambient PG/provider/Node refusal.
    // Explicit connection fields do not neutralize every pg environment option.
    const native=parseNativeAdmission({...process.env,MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',
      MERI_BUDGET_PG_TEST_CONFIG:nativeRaw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:digest(nativeRaw)},now());
    if(native.migrationSha256!==input.migrationSha256.budget||native.stateLockSha256!==
       digest(await readFile(new URL('apps/control/qualification-sdk-fixture/state/package-lock.json',root))))refuse();
    const descriptor=Object.freeze({mode:'synthetic-local-action',host:native.host,port:native.port,
      database:native.database,user:native.user,systemIdentifier:native.systemIdentifier,
      serverStartTime:new Date(native.serverStartTime).toISOString(),serverVersion:native.serverVersion,
      deadlineMs:native.workDeadlineMs,migrationSha256:Object.freeze({...input.migrationSha256})});
    return Object.freeze({native,descriptor});
  }catch{refuse();}finally{await handle?.close();}
}
