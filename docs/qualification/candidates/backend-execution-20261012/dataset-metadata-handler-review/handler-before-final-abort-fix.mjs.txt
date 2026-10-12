/** Local immutable registry listing; authorization/release remain dispatcher-owned. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as validatePublicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertPublicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/public-domain-registry.mjs';
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
const operation=Object.freeze({id:'list_global_datasets',version:'0.2.0'});
const contract=resolveOperationContract(operation);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
// A function/AbortSignal-bearing interface cannot be copied as JSON. Inspect only
// own data descriptors here; canonical snapshot admission owns all JSON subtrees.
function fields(value,required,optional=[]) {
  if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))deny('INVALID_ARGUMENTS');
  const properties=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(properties);
  if(required.some(key=>!Object.hasOwn(properties,key))||names.some(key=>typeof key!=='string'||![...required,...optional].includes(key)||!properties[key].enumerable||!Object.hasOwn(properties[key],'value')))deny('INVALID_ARGUMENTS');
  return Object.fromEntries(names.map(key=>[key,properties[key].value]));
}
export function createDatasetMetadataHandler(options) {
  let registry,now;
  try {
    ({registry,now}=fields(options,['registry','now']));
    assertPublicDomainDatasetRegistry(registry);
    if(typeof now!=='function')deny('GATEWAY_CONFIGURATION');
  } catch {deny('GATEWAY_CONFIGURATION');}
  return async function execute(call) {
    try {
      const supplied=fields(call,['input','request','authority','argumentsSha256'],['signal']);
      const {input,request,authority,argumentsSha256}=snapshotOperationData({input:supplied.input,request:supplied.request,authority:supplied.authority,argumentsSha256:supplied.argumentsSha256});
      validateShape('DatasetMetadataListInput',input);
      validateShape('DatasetMetadataListInput',request);
      if(typeof argumentsSha256!=='string'||argumentsSha256!==canonicalSha256(input))deny('INVALID_ARGUMENTS');
      validatePublicShape('RunBinding',authority.binding);validatePublicShape('CapabilityClaims',authority.claims);
      assertSubject(authority.subject,authority.binding);
      if(canonicalSha256(authority.binding)!==canonicalSha256(authority.claims.binding)||authority.policyRevision!==authority.claims.policyRevision||authority.subject.policyRevision!==authority.policyRevision)deny('ACCESS_DENIED');
      const expiry=Date.parse(authority.claims.expiresAt),issued=Date.parse(authority.claims.issuedAt);
      if(!Number.isSafeInteger(expiry)||!Number.isSafeInteger(issued)||!Number.isSafeInteger(authority.deadlineMs))deny('ACCESS_DENIED');
      if(supplied.signal!==undefined&&(types.isProxy(supplied.signal)||!(supplied.signal instanceof AbortSignal)))deny('INVALID_ARGUMENTS');
      const active=()=>{
        if(supplied.signal!==undefined&&aborted.call(supplied.signal))deny('CANCELLED');
        const stamp=now();
        if(!Number.isSafeInteger(stamp)||stamp<0||issued>stamp)deny('ACCESS_DENIED');
        if(stamp>=Math.min(expiry,authority.deadlineMs))deny('DEADLINE');
        return stamp;
      };
      const stamp=active();
      const result={tool:operation.id,generatedAt:new Date(stamp).toISOString(),datasets:registry.listDatasetMetadata()};
      contract.assertOutput(result,{request});
      const output=JSON.stringify({binding:authority.binding,subject:authority.subject,operation,argumentsSha256,result});
      active();return output;
    } catch(error) {throw safeFailure(error);}
  };
}
