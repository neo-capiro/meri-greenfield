/** Canonical short service-pair lease; never original runner authority.
 * Every read rediscovers both approved services. Pair drift retires this
 * runtime permanently, with no cached observation or stale-IP fallback. */
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createProductServicePairDiscovery,parseProductServicePairConfiguration} from './service-pair-discovery.mjs';
const fail=()=>{throw Error('PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE');};
export async function createProductServiceTaskLeaseReader(configuration){
 const pins=parseProductServicePairConfiguration(configuration.configuration);
 const discovery=await createProductServicePairDiscovery(configuration);
 let identity=null,retired=false;
 return Object.freeze({get available(){return !retired&&discovery.available;},async read(value){
  if(retired)fail();
  const pair=await discovery.read(value);
  if(retired)fail();
  const current=JSON.stringify([pair.owner,pair.proxy]);
  if(identity!==null&&identity!==current){retired=true;fail();}identity??=current;
  return data({schemaVersion:1,deploymentRevision:pins.deploymentRevision,
   ownerTaskArn:pair.owner.taskArn,proxyTaskArn:pair.proxy.taskArn,
   ownerPrivateIpv4Address:pair.owner.privateIpv4Address,proxyPrivateIpv4Address:pair.proxy.privateIpv4Address,
   ownerCertSha256:pins.ownerCertSha256,proxyCertSha256:pins.proxyCertSha256,
   checkedAtMs:pair.checkedAtMs,expiresAtMs:pair.expiresAtMs});
 }});
}
