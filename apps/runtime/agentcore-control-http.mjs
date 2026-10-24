/** Private control routes for one AgentCore invocation and the Temporal broker. */
import {timingSafeEqual} from 'node:crypto';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {jsonBody} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable} from '../../packages/runtime/authority-availability.mjs';
import {productFailure} from '../control/product-access/errors.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {MAX_APPROVAL_METADATA_READBACK_BYTES} from '../control/commands/approval-metadata/readback.mjs';

export const APPROVAL_METADATA_READ_PATH='/v1/internal/approval-metadata/read';
/** The existing Core service secret authenticates before bounded body allocation.
 * This readback never accepts the runtime execution credential as service auth. */
export function createApprovalMetadataReaderApplication(options={}){
 const c=own(options,[],['reader','getServiceSecret','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  (c.reader===undefined)!==(c.getServiceSecret===undefined)||c.getServiceSecret!==undefined&&typeof c.getServiceSecret!=='function')throw fault('APPROVAL_METADATA_CONFIGURATION');
 const read=c.reader?storageMethod(c.reader,'read'):null,headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
 const secret=value=>typeof value==='string'&&value.length>=16&&value.length<=8192&&!/[\s\x00-\x1f\x7f]/u.test(value);
 return Object.freeze({async handle(request){
  const url=new URL(request.url);if(url.pathname!==APPROVAL_METADATA_READ_PATH)return null;let life;
  try{
   if(!read||request.method!=='POST'||url.search||url.hash||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))throw fault('APPROVAL_METADATA_READ_UNAVAILABLE');
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>fault('APPROVAL_METADATA_READ_UNAVAILABLE')});
   const supplied=request.headers.get('x-internal-service-secret');if(!secret(supplied))throw fault('APPROVAL_METADATA_READ_UNAVAILABLE');
   const expected=await life.run(signal=>c.getServiceSecret({signal}));life.check();
   if(!secret(expected)||!matches(supplied,expected))throw fault('APPROVAL_METADATA_READ_UNAVAILABLE');
   const length=request.headers.get('content-length');if(length!==null&&(!/^[1-9][0-9]*$/u.test(length)||Number(length)>16384))throw fault('APPROVAL_METADATA_READ_UNAVAILABLE');
   const body=own(await jsonBody({body:request.body,length:length===null?null:Number(length)},16384,life,life.check),['schemaVersion','proposalId','binding']);
   const result=await life.run(signal=>read({...body,signal}));life.check();const encoded=JSON.stringify(result);
   if(Buffer.byteLength(encoded)>MAX_APPROVAL_METADATA_READBACK_BYTES)throw fault('APPROVAL_METADATA_READ_UNAVAILABLE');
   return new Response(encoded,{headers:{...headers,'content-type':'application/json; charset=utf-8'}});
  }catch{return Response.json({error:{code:'APPROVAL_METADATA_READ_UNAVAILABLE'}},{status:503,headers});}finally{life?.close();}
 }});
}

const routes=new Map([
 ['/v1/readiness',{method:'readiness',control:true,fields:[]}],
 ['/v1/execution/kickoff',{method:'kickoff',control:true,fields:['binding','executionKey']}],
 ['/v1/execution/kickoff/status',{method:'status',control:true,fields:['binding','executionId']}],
 ['/v1/execution/kickoff/stop',{method:'stop',control:true,fields:['binding','executionId']}],
 ['/v1/runner/execution',{method:'admitted',fields:['execution','versions']}],
 ['/v1/runner/execution/settle',{method:'settle',fields:['execution','state']}],
]);
const fault=code=>Object.assign(Error(code),{code});
const matches=(actual,expected)=>{const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);};

export function createAgentCoreControlApplication({owner,controlCredential,now=Date.now,maxRequestMs=10000,maxRequestBytes=131072}){
 if(typeof controlCredential!=='string'||controlCredential.length<32||[...routes.values()].some(r=>typeof owner?.[r.method]!=='function'))throw fault('EXECUTION_CONFIGURATION');
 return Object.freeze({async handle(request){
  const url=new URL(request.url),route=routes.get(url.pathname);if(!route)return null;
  let life;
  try{
   if(request.method!=='POST')return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
   if(url.search||url.hash||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw fault('EXECUTION_REQUEST_REFUSED');
   const auth=request.headers.get('authorization');
   if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(auth??''))throw fault('EXECUTION_AUTHORITY_REFUSED');
   const credential=auth.slice(7);if(route.control&&!matches(credential,controlCredential))throw fault('EXECUTION_AUTHORITY_REFUSED');
   const length=request.headers.get('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw fault('EXECUTION_REQUEST_REFUSED');
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:fault});
   const input=own(await jsonBody({body:request.body,length:length===null?null:Number(length)},maxRequestBytes,life,life.check),route.fields);
   const result=await life.run(signal=>owner[route.method]({...input,...(route.control?{}:{credential}),signal}));life.check();
   return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch(error){
   const failure=productFailure(error),unavailable=isAuthorityUnavailable(error)||['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN'].includes(failure?.code??error?.code);
   const code=unavailable?'EXECUTION_UNAVAILABLE':error?.code==='EXECUTION_AUTHORITY_REFUSED'?'EXECUTION_AUTHORITY_REFUSED':
    ['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'EXECUTION_REQUEST_REFUSED';
   return Response.json({error:{code}},{status:unavailable?503:code==='EXECUTION_AUTHORITY_REFUSED'?403:['DEADLINE','CANCELLED'].includes(code)?408:400,headers:{'cache-control':'no-store'}});
  }finally{life?.close();}
 }});
}
