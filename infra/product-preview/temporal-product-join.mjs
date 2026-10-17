/** Source-only join of the two stopped templates and reviewed nonsecret config projections. */
import {synthesizeProductPreview} from './manifest.mjs';
import {validateTemporalPreviewBinding} from './temporal-binding.mjs';
import {validateTemporalIssuerRenewal} from './temporal-issuer-renewal.mjs';

const fail=()=>{throw Error('TEMPORAL_PRODUCT_JOIN_REFUSED');};
const record=(value,keys)=>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
};

/**
 * `runtimeProjection` must be decoded independently from exact reviewed control/worker config bytes.
 * A matching SHA supplied beside a projection does not itself prove its contents.
 */
export function inspectTemporalProductJoin({productBinding,temporalBinding,runtimeProjection,productSubnetReadback,issuerRenewal}){
 let t,p;
 try{t=validateTemporalPreviewBinding(temporalBinding);synthesizeProductPreview(productBinding);p=productBinding;
  validateTemporalIssuerRenewal(t,issuerRenewal);}catch{fail();}
 if(p.account!==t.account||p.region!==t.region||p.clusterArn!==t.clusterArn||
    issuerRenewal.issuerServiceTaskRoleArn===p.controlTaskRoleArn||
    issuerRenewal.issuerServiceTaskRoleArn===p.executionRoleArn||
    !Array.isArray(t.network.clientSecurityGroupIds)||
    new Set([p.network.controlSecurityGroupId,p.network.workerSecurityGroupId]).size!==2||
    ![p.network.controlSecurityGroupId,p.network.workerSecurityGroupId]
     .every(x=>t.network.clientSecurityGroupIds.includes(x))||
    t.subnets.some(x=>x.id===p.network.privateSubnetId))fail();
 const subnet=record(productSubnetReadback,['SubnetId','VpcId','RouteTableId']);
 if(subnet.SubnetId!==p.network.privateSubnetId||subnet.VpcId!==t.vpcId||
    !/^vpc-[a-f0-9]{8,17}$/u.test(subnet.VpcId)||
    !/^rtb-[a-f0-9]{8,17}$/u.test(subnet.RouteTableId))fail();
 const projections=record(runtimeProjection,['control','temporalWorker']);
 const address=`frontend.${t.privateDnsName}:7233`,serverName=`frontend.${t.privateDnsName}`;
 for(const [role,config] of Object.entries(projections)){
  record(config,['configSha256','address','namespace','taskQueue','tlsServerName','tlsCaFile','tlsCaSha256',
   'issuer','audience','tokenFile','refreshMs','maxLifetimeMs']);
  const expected=p.materialDelivery[role].expected.sha256ByPath;
  const configPath=role==='control'?'/run/meri/control.json':'/run/meri/worker.json';
  if(config.configSha256!==expected[configPath]||config.address!==address||
     config.namespace!==t.auth.namespace||config.taskQueue!==t.auth.taskQueue||
     config.tlsServerName!==serverName||typeof config.tlsCaFile!=='string'||
     !/^\/run\/meri\/[a-zA-Z0-9._-]{1,128}$/u.test(config.tlsCaFile)||
     config.tlsCaSha256!==expected[config.tlsCaFile]||
     config.issuer!==t.auth.issuer||config.audience!==t.auth.audience||
     config.tokenFile!==issuerRenewal.roles[role].tokenFile||
     config.refreshMs!==issuerRenewal.refreshMs||
     config.maxLifetimeMs!==issuerRenewal.maxTokenLifetimeMs)fail();
 }
 return Object.freeze({schemaVersion:1,status:'HOLD',frontendAddress:address,
  productVpcId:subnet.VpcId,temporalVpcId:t.vpcId,
  pending:Object.freeze(['independent-config-decoding','same-vpc-route-and-sg-readback',
   'issuer-writer-and-required-auth-composition','Linux-mTLS-and-token-expiry-qualification'])});
}
