/** Explicit CONTROL-selected delegated source mode. Fixed POSTs; never legacy fallback. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {retainedRoutes,retainedOrigin,retainedOperation,assertCoreDelegatedRequest} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {credentialProof} from '../../../gateway/sources/retained-reads/call-context.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {GatewayDenied,safeFailure,deny} from '../../../gateway/dispatch/operation-result.mjs';
import {createDispatchLifetime} from '../../../gateway/dispatch/dispatch-lifetime.mjs';
const same=(a,b)=>hash(a)===hash(b);
export function createRetainedDelegatedTransport(configuration){
 const c=own(configuration,['origin','getCredentials','now','fetchImpl'],['maxRequestMs','maxResponseBytes']),origin=retainedOrigin(c.origin),maxRequestMs=c.maxRequestMs??15000,maxResponseBytes=c.maxResponseBytes??1048576;
 if(typeof c.getCredentials!=='function'||typeof c.now!=='function'||typeof c.fetchImpl!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
 async function read(call,route){let life,acquired;try{const {path,method,body}=own(route,['path','method'],['body']),op=retainedOperation(call.operation);nativeSignal(call.signal);
  const changes=op.id==='get_research_portfolio_changes',fl=op.id==='get_florida_budget_project',query=new URLSearchParams();if(changes){query.set('limit',String(call.input.limit));if(call.input.cursor!==null)query.set('cursor',call.input.cursor);}
  const expected=fl?'/api/clio/tools/get_florida_budget_project':`/api/research-portfolios/${encodeURIComponent(call.input.portfolioId)}${changes?'/changes?'+query:''}`;
  if(path!==expected||method!==(fl?'POST':'GET')||(fl?!same(body,call.input):body!==undefined))deny('ACCESS_DENIED');
  const cutoff=Math.min(call.deadlineMs,c.now()+maxRequestMs);life=createDispatchLifetime({now:c.now,deadlineMs:cutoff,signal:call.signal});const proof=credentialProof(call,origin),credentials=data(await life.run(signal=>c.getCredentials({...proof,request:call.request,input:call.input,scopeSignal:call.signal,signal,deadlineMs:cutoff})));
  own(credentials,[...Object.keys(proof),'assertionJson','expiresAtMs']);if(Object.keys(proof).some(k=>!same(proof[k],credentials[k]))||typeof credentials.assertionJson!=='string'||!/^[A-Za-z0-9_-]{1,10923}$/u.test(credentials.assertionJson)||!Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=c.now())deny('ACCESS_DENIED');life.limitDeadline(credentials.expiresAtMs);
  const payload=assertCoreDelegatedRequest({schemaVersion:1,request:call.request,context:call.normalizationContext});
  acquired=await life.run(signal=>{const pending=Promise.resolve(c.fetchImpl(origin+retainedRoutes[op.id].data,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'CapiroRetained '+credentials.assertionJson,'content-type':'application/json',accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(Math.min(cutoff,credentials.expiresAtMs))},body:JSON.stringify(payload),signal}));pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
  const result=data(await readJsonResponse(acquired,{lifetime:life,maxResponseBytes:Math.min(maxResponseBytes,call.authority.claims.budgets.maxOutputBytes)}));life.check();return result;
 }catch(error){const code=nativeReadFailureCode(error);throw code?new GatewayDenied(code):safeFailure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}}
 return Object.freeze({read});
}
