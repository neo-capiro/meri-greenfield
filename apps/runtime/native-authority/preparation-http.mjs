/** Fixed task-authenticated preparation calls; no controller capability reaches the SDK. */
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {remoteFault} from './remote-task-boundary.mjs';
import {createExchangeRecord,writeEventLine} from './exchange-diagnostics.mjs';
const methods=new Set(['prepare','verify','start','started','admitted']);
export function createNativePreparationApplication({owner,taskCapabilitySha256,enabled=false,now=Date.now,maxRequestMs=3000,report=writeEventLine}){
 return Object.freeze({async handle(request){const url=new URL(request.url);if(!url.pathname.startsWith('/v1/runner/native/'))return null;let life,record,outcome='refused';
  try{const method=url.pathname.slice('/v1/runner/native/'.length),auth=request.headers.get('authorization');if(!enabled||!methods.has(method)||url.search||request.method!=='POST'||!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),taskCapabilitySha256)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw remoteFault();
   record=createExchangeRecord({event:'runtime.native-preparation.exchange',boundary:'native-preparation',effectPhase:'owner',now,report});record.operation(method);
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:code=>{record.fail(code);return remoteFault();}});record.phase('body');const body=await jsonBody({body:request.body,length:null},262144,life,life.check);const v=own(body,method==='admitted'?['original']:['original','descriptorSha256','configTreeSha256',...(method==='prepare'?['descriptor']:['preparationId'])]);record.bind(v.original);
   record.phase('owner');const result=await life.run(signal=>owner[method]({...v,signal}));record.answered();life.check();outcome='completed';return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch{record?.fail('REFUSED');return Response.json({error:{code:'NATIVE_PREPARATION_REFUSED'}},{status:403});}finally{record?.finish({outcome,remainingMs:life?life.deadline()-now():undefined});life?.close();}
 }});
}
export function createNativePreparationClient({native,startupBudget}){
 if(typeof native?.call!=='function')throw remoteFault();
 // The trusted original lease supplies stage cutoffs. A gate proof must also
 // fit inside the control-side ten-second release request.
 let firstAdmissionProven=false;
 const stageFor=method=>method==='admitted'?(firstAdmissionProven?startupBudget?.admittedAfter:startupBudget?.admittedBefore):method==='prepare'?startupBudget?.nativePrepare:startupBudget?.nativeStart;
 return Object.freeze(Object.fromEntries([...methods].map(method=>[method,async value=>{const {signal,...input}=own(value,method==='admitted'?['original']:['original','descriptorSha256','configTreeSha256',...(method==='prepare'?['descriptor']:['preparationId'])],['signal']);nativeSignal(signal);const stage=stageFor(method),options=stage?{signal,deadlineMs:stage.expiresAtMs,maxRequestMs:method==='admitted'?Math.min(8000,stage.maxMs):stage.maxMs}:{signal};const result=await native.call('runner/native/'+method,input,options);if(method==='admitted')firstAdmissionProven=true;return result;}])));
}
