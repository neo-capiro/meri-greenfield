/** Existing load authority governs original-task checkpoint capture/read operations. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {remoteFault} from './remote-task-boundary.mjs';
export function createNativeCheckpointApplication({owner,taskCapabilitySha256,enabled=false,now=Date.now,maxRequestMs=3000}){
 return Object.freeze({async handle(request){const url=new URL(request.url),route=url.pathname==='/v1/runner/checkpoint/capture'?'captureCheckpoint':url.pathname==='/v1/runner/checkpoint/read'?'read':null;if(!route)return null;let life;
  try{const auth=request.headers.get('authorization');if(!enabled||!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),taskCapabilitySha256)||request.method!=='POST'||url.search||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw remoteFault();
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:remoteFault});const body=await jsonBody({body:request.body,length:null},2097152,life,life.check),v=own(body,route==='captureCheckpoint'?['binding','request','versions','scopes','controlId','sessionId','contextSha256']:['binding','scopes','versions','checkpointId','expectedSha256']);const result=await life.run(signal=>owner[route]({...v,signal}));life.check();return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({error:{code:'NATIVE_CHECKPOINT_UNAVAILABLE'}},{status:503});}finally{life?.close();}
 }});
}
