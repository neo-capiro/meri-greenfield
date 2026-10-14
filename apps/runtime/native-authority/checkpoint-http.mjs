import {types} from 'node:util';
/** Task capture/read and current-control retained inspection keep distinct roles. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {remoteFault} from './remote-task-boundary.mjs';
const requestGet=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function createNativeCheckpointApplication(configuration){
 const c=own(configuration,[],['owner','taskCapabilitySha256','inspection','controlCapabilitySha256','enabled','now','maxRequestMs']),enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 const validDigest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!c.owner&&!c.inspection||c.owner&&!validDigest(c.taskCapabilitySha256)||c.inspection&&(!validDigest(c.controlCapabilitySha256)||c.controlCapabilitySha256===c.taskCapabilitySha256))throw remoteFault();
 const readFields=['binding','scopes','versions','checkpointId','expectedSha256'],routes=new Map();
 if(c.owner){routes.set('/v1/runner/checkpoint/capture',{call:storageMethod(c.owner,'captureCheckpoint'),digest:c.taskCapabilitySha256,fields:['binding','request','versions','scopes','controlId','sessionId','contextSha256']});routes.set('/v1/runner/checkpoint/read',{call:storageMethod(c.owner,'read'),digest:c.taskCapabilitySha256,fields:readFields});}
 if(c.inspection)routes.set('/v1/checkpoint/read',{call:storageMethod(c.inspection,'read'),digest:c.controlCapabilitySha256,fields:readFields});
 return Object.freeze({async handle(request){let life;try{if(!request||types.isProxy(request)||!(request instanceof Request))throw remoteFault();const info=Object.fromEntries(Object.entries(requestGet).map(([k,get])=>[k,get.call(request)])),url=new URL(info.url),route=routes.get(url.pathname);if(!route)return null;
   const header=k=>Headers.prototype.get.call(info.headers,k),auth=header('authorization');if(!enabled||!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),route.digest)||info.method!=='POST'||url.search||url.hash||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))throw remoteFault();
   life=createOperationLifetime({now,signal:info.signal,deadlineMs:now()+maxRequestMs,errorFactory:remoteFault});const body=await jsonBody({body:info.body,length:null},2097152,life,life.check),v=own(body,route.fields);const result=await life.run(signal=>route.call({...v,signal}));life.check();return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({error:{code:'NATIVE_CHECKPOINT_UNAVAILABLE'}},{status:503});}finally{life?.close();}
 }});
}
