/** Offline validation of exact AWS Describe* readback. No AWS client or network on import/call. */
import {createHash} from 'node:crypto';
import {TEMPORAL_INTERFACE_ENDPOINTS,temporalEndpointSecurityGroupIds,validateTemporalPreviewBinding} from './temporal-binding.mjs';

const fail=()=>{throw Error('TEMPORAL_NETWORK_READBACK_REFUSED');};
const record=(value,keys)=>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
};
const rows=(value,count)=>{if(!Array.isArray(value)||value.length!==count)fail();return value;};
const exactSet=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&
 new Set(actual).size===actual.length&&expected.every(value=>actual.includes(value));

/**
 * Readback shape uses selected fields from DescribeVpcs/Subnets/RouteTables/VpcEndpoints/SecurityGroups.
 * Subnet route-table IDs are derived from RouteTables.Associations, never supplied on a Subnet.
 * Passing this check does not authenticate who captured the snapshot or prove packet reachability.
 */
export function validateTemporalNetworkReadback(binding,readback){
 let b;try{b=validateTemporalPreviewBinding(binding);}catch{fail();}
 const e=record(readback,['schemaVersion','vpc','subnets','routeTables','interfaceEndpoints','s3Gateway','securityGroups']);
 if(e.schemaVersion!==1)fail();
 const vpc=record(e.vpc,['VpcId','IsDefault']);
 if(vpc.VpcId!==b.vpcId||vpc.IsDefault!==false)fail();
 const routes=new Map();
 for(const item of rows(e.routeTables,new Set(Object.values(b.network.taskRouteTableBySubnet)).size)){
  const table=record(item,['RouteTableId','VpcId','Routes','Associations']);
  if(table.VpcId!==b.vpcId||routes.has(table.RouteTableId)||!Array.isArray(table.Routes)||
     !Array.isArray(table.Associations)||
     !table.Routes.some(route=>route?.GatewayId==='local'&&route?.State==='active')||
     table.Routes.some(route=>
      ['0.0.0.0/0','::/0'].includes(route?.DestinationCidrBlock??route?.DestinationIpv6CidrBlock)&&
      /^igw-/u.test(route.GatewayId??'')))fail();
  const s3=table.Routes.filter(route=>route?.DestinationPrefixListId===b.network.s3Gateway.prefixListId&&
   route?.GatewayId===b.network.s3Gateway.endpointId&&route?.State==='active');
  if(s3.length!==1)fail();
  routes.set(table.RouteTableId,table);
 }
 if(!exactSet([...routes.keys()],[...new Set(Object.values(b.network.taskRouteTableBySubnet))]))fail();
 const subnetIds=b.subnets.map(x=>x.id),subnets=new Map(),explicit=new Map();let main=null;
 for(const table of routes.values())for(const item of table.Associations){
  if(item===null||typeof item!=='object'||item.RouteTableId!==table.RouteTableId||
     item.AssociationState?.State!=='associated')fail();
  if(item.Main===true){if(main!==null||item.SubnetId!==undefined)fail();main=table.RouteTableId;}
  else if(typeof item.SubnetId==='string'){
   if(explicit.has(item.SubnetId))fail();explicit.set(item.SubnetId,table.RouteTableId);
  }
 }
 for(const item of rows(e.subnets,subnetIds.length)){
  const subnet=record(item,['SubnetId','VpcId','AvailabilityZone','MapPublicIpOnLaunch']);
  const expected=b.subnets.find(x=>x.id===subnet.SubnetId);
  if(!expected||subnets.has(subnet.SubnetId)||subnet.VpcId!==b.vpcId||
     subnet.AvailabilityZone!==expected.availabilityZone||subnet.MapPublicIpOnLaunch!==false||
     (explicit.get(subnet.SubnetId)??main)!==b.network.taskRouteTableBySubnet[subnet.SubnetId])fail();
  subnets.set(subnet.SubnetId,subnet);
 }
 const endpoints=new Map();
 for(const item of rows(e.interfaceEndpoints,Object.keys(TEMPORAL_INTERFACE_ENDPOINTS).length)){
  const endpoint=record(item,['VpcEndpointId','VpcId','ServiceName','VpcEndpointType','State','PrivateDnsEnabled','SubnetIds','Groups']);
  const named=Object.entries(b.network.interfaceEndpoints).find(([,x])=>x.endpointId===endpoint.VpcEndpointId);
  if(!named||endpoints.has(endpoint.VpcEndpointId)||endpoint.VpcId!==b.vpcId||
     endpoint.ServiceName!==TEMPORAL_INTERFACE_ENDPOINTS[named[0]]||endpoint.VpcEndpointType!=='Interface'||
     endpoint.State!=='available'||endpoint.PrivateDnsEnabled!==true||!exactSet(endpoint.SubnetIds,subnetIds)||
     !Array.isArray(endpoint.Groups)||endpoint.Groups.length!==1||
     endpoint.Groups[0]?.GroupId!==named[1].securityGroupId)fail();
  endpoints.set(endpoint.VpcEndpointId,endpoint);
 }
 const gateway=record(e.s3Gateway,['VpcEndpointId','VpcId','ServiceName','VpcEndpointType','State','RouteTableIds']);
 if(gateway.VpcEndpointId!==b.network.s3Gateway.endpointId||gateway.VpcId!==b.vpcId||
    gateway.ServiceName!=='com.amazonaws.us-east-1.s3'||gateway.VpcEndpointType!=='Gateway'||
    gateway.State!=='available'||
    !exactSet(gateway.RouteTableIds,[...routes.keys()]))fail();
 // One row per distinct SG: the capiro-dev interface endpoints share one group.
 const peerIds=[...temporalEndpointSecurityGroupIds(b.network),b.network.issuerSecurityGroupId,
  b.network.migrationSecurityGroupId,b.network.issuerClientSecurityGroupId,b.network.dbClientSecurityGroupId];
 if(!exactSet(rows(e.securityGroups,peerIds.length).map(item=>{
  const sg=record(item,['GroupId','VpcId']);if(sg.VpcId!==b.vpcId)fail();return sg.GroupId;
 }),peerIds))fail();
 return Object.freeze({schemaVersion:1,vpcId:b.vpcId,readbackSha256:createHash('sha256').update(JSON.stringify(e),'utf8').digest('hex')});
}
