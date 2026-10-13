/** Opt-in synthetic composition; the canonical production catalog is never mutated or enabled. */
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createDurableToolDispatch} from '../budget/durable-tool-dispatch.mjs';
import {allocation} from '../budget/tool-budget-binding.mjs';
import {createActionItemsHttpAdapter} from '../sources/action-items/http-adapter.mjs';
import {createActionItemsReadHandler} from '../sources/action-items/handler.mjs';
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny,parseRawJson,exactKeys} from '../dispatch/operation-result.mjs';
const operation=Object.freeze({id:'actions.query',version:'0.2.0'}),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function fixtureActionTransport(source){
 const transport=ownFields(source,['origin','getCredentials','fetchImpl'],['maxRequestMs','maxResponseBytes']);
 if(typeof transport.origin!=='string'||typeof transport.fetchImpl!=='function')deny('GATEWAY_CONFIGURATION');
 let url;try{url=new URL(transport.origin);}catch{deny('GATEWAY_CONFIGURATION');}
 // The function port is trusted host code. This prevents accidental real-source configuration,
 // not arbitrary host JavaScript from opening a network connection elsewhere.
 if(!(url.hostname.endsWith('.invalid')||(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.port)))deny('GATEWAY_CONFIGURATION');
 return transport;
}
export function createFixtureActionGateway(configuration){
 const {binding,authority,pool,allocationJson,source,limits,now,newId}=ownFields(configuration,['binding','authority','pool','allocationJson','source','limits','now','newId']);
 const a=allocation(allocationJson),l=frozenData(limits);
 const allowed=a.manifest.allowedOperations,readOnly=allowed.length===1&&same(allowed[0],operation),shared=allowed.length===2&&allowed.some(x=>same(x,operation))&&allowed.some(x=>same(x,{id:'create_task',version:'0.2.0'}));
 if(!same(a.run,Object.fromEntries(Object.keys(a.run).map(k=>[k,binding[k]])))||a.catalogSha256!==canonicalSha256(catalog)||!(readOnly||shared))deny('GATEWAY_CONFIGURATION');
 const transport=fixtureActionTransport(source);
 const contract=resolveOperationContract(operation);
 const adapter=createActionItemsHttpAdapter({...transport,now,maxRequestMs:transport.maxRequestMs??l.maxRequestMs,maxResponseBytes:transport.maxResponseBytes??l.maxResponseBytes});
 const entry=Object.freeze({descriptor:contract.descriptor,contract,execute:createActionItemsReadHandler({adapter,now,newId})});
 const view=Object.freeze({entry:requested=>same(requested,operation)?entry:null,discoverable:()=>[]});
 const gateway=createDurableToolDispatch({pool,allocationJson,catalog:view,authority,limits:l,now,newId,sourceEnabled:true});
 function request(raw){const value=parseRawJson(raw,l.maxRequestBytes);exactKeys(value,['operation','arguments']);if(!same(value.operation,operation))deny('UNAVAILABLE');return raw;}
 return Object.freeze({productionSourceEnabled:false,
  bindTrustedGrant:gateway.bindTrustedGrant,readInvocationOutcome:gateway.readInvocationOutcome,
  prepareInvocation:(deliveryJson,requestJson,signal)=>gateway.prepareInvocation(deliveryJson,request(requestJson),signal),
  executeOwned:(requestJson,credential,deliveryJson,signal)=>gateway.executeOwned(request(requestJson),credential,deliveryJson,signal),
  reconcileInvocation:(deliveryJson,requestJson)=>gateway.reconcileInvocation(deliveryJson,request(requestJson)),
  async discover(){return [];}
 });
}
