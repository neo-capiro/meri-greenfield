// @ts-check
/** Read-only preflight evaluator plus injected CloudFormation response transport. */
import {HOST_ACCOUNT,HOST_REGION} from './binding.mjs';
import {HOST_CEILING_MS,WATCHDOG_INPUT_SCHEMA,canonicalJson,sha256} from './enabled-binding.mjs';
import {computeEnabledTemplateReviewSha256} from './enabled-template.mjs';
import {LAUNCH_DENY_POLICY_NAME,launchDeadlinePolicy} from './launch-deadline-policy.mjs';
import {closedHostStackPolicy} from './stack-update-policy.mjs';

const SHA=/^[0-9a-f]{64}$/u;
const fail=reason=>{throw Object.assign(new Error(reason),{code:'WATCHDOG_PREFLIGHT_REFUSED'});};
const own=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.hasOwn(v,n)?v[n]:undefined;
const names=['ServiceToken','ServiceTimeout','Schema','ProviderCodeSha256','WatchdogDefinitionSha256','QualificationEvidenceSha256',
 'StateMachineVersionArn','ExecutionArn','OriginalT0Ms','DeadlineMs','AllocationSha256','HostId','Generation',
 'SourceCommit','ImageUri','ImageConfigSha256','BootstrapSha256','NativeHelperSha256','TemplateSha256',
 'StackServiceRoleArn','LaunchDenyPolicySha256','StackPolicySha256',
 'AmiId','AmiOwner','Architecture','VpcId','SubnetId','ControlSecurityGroupId',
 'EcrApiSecurityGroupId','EcrDockerSecurityGroupId','LogsSecurityGroupId','S3GatewayPrefixListId',
 'HostSecurityGroupId','NetworkMode'];
const pinned=(o,n)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==n.length||n.some(k=>!Object.hasOwn(o,k)))fail('property-shape');};
const ms=date=>date instanceof Date?date.getTime():typeof date==='number'?date:NaN;
const privateIpv4Cidr=value=>{
 if(typeof value!=='string')return false;
 const match=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/u.exec(value);
 if(!match)return false;
 const [a,b,c,d,prefix]=match.slice(1).map(Number);
 if([a,b,c,d].some(octet=>octet>255)||prefix>32)return false;
 return a===10&&prefix>=8||a===172&&b>=16&&b<=31&&prefix>=12||
  a===192&&b===168&&prefix>=16;
};
const routeHasOnly=(route,keys)=>Object.keys(route).every(key=>keys.includes(key));

/** The injected readNetwork port must return current raw EC2 inventory, not an assertion boolean. */
export function verifyClosedNetworkSnapshot(p,s){
 if(!s||typeof s!=='object'||!s.subnet||!s.routeTable||!Array.isArray(s.endpoints)||!Array.isArray(s.securityGroups)||!Array.isArray(s.networkInterfaces))fail('network-inventory');
 const {subnet,routeTable,endpoints,securityGroups,networkInterfaces}=s;
 if(subnet.SubnetId!==p.SubnetId||subnet.VpcId!==p.VpcId||subnet.MapPublicIpOnLaunch!==false||subnet.AssignIpv6AddressOnCreation!==false||subnet.Ipv6Native===true||
    routeTable.VpcId!==p.VpcId||!Array.isArray(routeTable.Associations)||
    routeTable.Associations.filter(a=>a.SubnetId===p.SubnetId&&a.AssociationState?.State==='associated').length!==1||
    !Array.isArray(routeTable.Routes))fail('subnet-boundary');
 const s3=endpoints.filter(e=>e.VpcId===p.VpcId&&e.ServiceName===`com.amazonaws.${HOST_REGION}.s3`&&e.VpcEndpointType==='Gateway'&&e.State==='available');
 if(s3.length!==1||!Array.isArray(s3[0].RouteTableIds)||!s3[0].RouteTableIds.includes(routeTable.RouteTableId)||
    routeTable.Routes.filter(r=>r.DestinationPrefixListId===p.S3GatewayPrefixListId&&r.GatewayId===s3[0].VpcEndpointId).length!==1)fail('s3-gateway');
 // This qualification subnet needs only its RFC1918 VPC-local routes and one
 // S3 gateway route. Reject every other target, including public /32 and IPv6.
 const local=routeTable.Routes.filter(r=>r.GatewayId==='local'&&r.State==='active'&&
  privateIpv4Cidr(r.DestinationCidrBlock)&&routeHasOnly(r,['DestinationCidrBlock','GatewayId','Origin','State']));
 const gateway=routeTable.Routes.filter(r=>r.GatewayId===s3[0].VpcEndpointId&&r.State==='active'&&
  r.DestinationPrefixListId===p.S3GatewayPrefixListId&&
  routeHasOnly(r,['DestinationPrefixListId','GatewayId','Origin','State']));
 if(local.length<1||gateway.length!==1||local.length+gateway.length!==routeTable.Routes.length)fail('unexpected-route');
 const services=[['ecr.api',p.EcrApiSecurityGroupId],['ecr.dkr',p.EcrDockerSecurityGroupId],['logs',p.LogsSecurityGroupId]];
 for(const [service,sgId] of services){
  const matches=endpoints.filter(e=>e.VpcId===p.VpcId&&e.ServiceName===`com.amazonaws.${HOST_REGION}.${service}`&&e.VpcEndpointType==='Interface'&&e.State==='available'&&e.PrivateDnsEnabled===true);
  if(matches.length!==1||!Array.isArray(matches[0].Groups)||!matches[0].Groups.some(g=>g.GroupId===sgId)||
     !Array.isArray(matches[0].NetworkInterfaceIds)||matches[0].NetworkInterfaceIds.length<1)fail('private-endpoint');
  const sg=securityGroups.find(g=>g.GroupId===sgId&&g.VpcId===p.VpcId);
  if(!sg||!Array.isArray(sg.IpPermissions)||!sg.IpPermissions.some(rule=>rule.IpProtocol==='tcp'&&rule.FromPort===443&&rule.ToPort===443&&
    Array.isArray(rule.UserIdGroupPairs)&&rule.UserIdGroupPairs.some(pair=>pair.GroupId===p.HostSecurityGroupId)))fail('endpoint-ingress');
  const members=networkInterfaces.filter(eni=>Array.isArray(eni.Groups)&&eni.Groups.some(g=>g.GroupId===sgId)).map(eni=>eni.NetworkInterfaceId).sort();
  if(canonicalJson(members)!==canonicalJson([...matches[0].NetworkInterfaceIds].sort()))fail('endpoint-sg-membership');
 }
 const control=securityGroups.find(g=>g.GroupId===p.ControlSecurityGroupId&&g.VpcId===p.VpcId);
 if(!control||!Array.isArray(control.IpPermissions)||!control.IpPermissions.some(rule=>rule.IpProtocol==='tcp'&&rule.FromPort===443&&rule.ToPort===443&&
   Array.isArray(rule.UserIdGroupPairs)&&rule.UserIdGroupPairs.some(pair=>pair.GroupId===p.HostSecurityGroupId)))fail('control-ingress');
 const host=securityGroups.find(g=>g.GroupId===p.HostSecurityGroupId&&g.VpcId===p.VpcId);
 if(!host||!Array.isArray(host.IpPermissions)||host.IpPermissions.length!==0||!Array.isArray(host.IpPermissionsEgress))fail('host-sg');
 const destinations=[p.ControlSecurityGroupId,p.EcrApiSecurityGroupId,p.EcrDockerSecurityGroupId,p.LogsSecurityGroupId];
 const observed=host.IpPermissionsEgress.map(r=>{
  if(r.IpProtocol!=='tcp'||r.FromPort!==443||r.ToPort!==443||r.IpRanges?.length||r.Ipv6Ranges?.length)return null;
  const pairs=r.UserIdGroupPairs??[],prefix=r.PrefixListIds??[];
  if(pairs.length===1&&prefix.length===0)return `sg:${pairs[0].GroupId}`;
  if(prefix.length===1&&pairs.length===0)return `pl:${prefix[0].PrefixListId}`;
  return null;
 }).sort();
 const expected=[...new Set(destinations.map(x=>`sg:${x}`)),`pl:${p.S3GatewayPrefixListId}`].sort();
 if(canonicalJson(observed)!==canonicalJson(expected))fail('host-egress');
 return true;
}

/** Compare the actual read-only AWS state. Every missing or contradictory fact refuses. */
export async function evaluateWatchdogPreflight(event,ports){
 if(!event||event.RequestType!=='Create'||event.ResourceType!=='Custom::MeriWatchdogPreflight'||event.LogicalResourceId!=='WatchdogPreflight'||
    typeof event.StackId!=='string'||!event.StackId.startsWith(`arn:aws:cloudformation:${HOST_REGION}:${HOST_ACCOUNT}:stack/`))fail('event-scope');
 const p=event.ResourceProperties;pinned(p,names);
 if(p.Schema!=='meri-d005-watchdog-preflight/1'||p.ServiceTimeout!=='30'||p.NetworkMode!=='closed-qualification'||
    !Number.isSafeInteger(p.OriginalT0Ms)||p.DeadlineMs!==p.OriginalT0Ms+HOST_CEILING_MS||
    !Number.isSafeInteger(p.Generation)||p.Generation<1||
    ![p.TemplateSha256,p.AllocationSha256,p.WatchdogDefinitionSha256,p.QualificationEvidenceSha256,p.ProviderCodeSha256,p.BootstrapSha256,p.NativeHelperSha256,p.ImageConfigSha256,p.LaunchDenyPolicySha256,p.StackPolicySha256].every(v=>typeof v==='string'&&SHA.test(v)))fail('pin-shape');
 const now=ports.nowMs();
 if(!Number.isSafeInteger(now)||now<p.OriginalT0Ms||now>p.OriginalT0Ms+120_000)fail('arm-window');
 const [stack,stackSummary,rolePolicy,stackPolicy,machine,execution,provider,ami,network,qualification]=await Promise.all([
  ports.readStackTemplate({stackId:event.StackId}),
  ports.readStackSummary({stackId:event.StackId}),
  ports.readRolePolicy({roleName:p.StackServiceRoleArn?.split('/').at(-1),policyName:LAUNCH_DENY_POLICY_NAME}),
  ports.readStackPolicy({stackId:event.StackId}),
  ports.readStateMachineVersion({arn:p.StateMachineVersionArn}),
  ports.readExecution({arn:p.ExecutionArn}),
  ports.readProviderCode({arn:p.ServiceToken}),
  ports.readAmi({imageId:p.AmiId}),
  ports.readNetwork({vpcId:p.VpcId,subnetId:p.SubnetId,hostSecurityGroupId:p.HostSecurityGroupId}),
  ports.readWatchdogQualification({versionArn:p.StateMachineVersionArn,evidenceSha256:p.QualificationEvidenceSha256}),
 ]);
 const template=typeof stack?.TemplateBody==='string'?JSON.parse(stack.TemplateBody):null;
 const declared=template?.Resources?.WatchdogPreflight?.Properties;
 if(!template||typeof p.HostSecurityGroupId!=='string'||!/^sg-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u.test(p.HostSecurityGroupId)||
    canonicalJson(declared?.HostSecurityGroupId)!==canonicalJson({Ref:'HostSecurityGroup'}))fail('template-review');
 const resolved={...declared,HostSecurityGroupId:p.HostSecurityGroupId};
 const nic=template.Resources?.HostInstance?.Properties?.NetworkInterfaces;
 if(canonicalJson(resolved)!==canonicalJson(p)||
    computeEnabledTemplateReviewSha256(template)!==p.TemplateSha256||
    !Array.isArray(template.Resources?.HostInstance?.DependsOn)||!template.Resources.HostInstance.DependsOn.includes('WatchdogPreflight')||
    !Array.isArray(nic)||nic.length!==1||canonicalJson(nic[0].GroupSet)!==canonicalJson([{Ref:'HostSecurityGroup'}])||
    nic[0].SubnetId!==p.SubnetId||nic[0].AssociatePublicIpAddress!==false||nic[0].DeleteOnTermination!==true)fail('template-review');
 const expectedRole=`arn:aws:iam::${HOST_ACCOUNT}:role/MeriD005-${p.HostId}-g${p.Generation}`;
 let document;
 try{document=typeof rolePolicy?.PolicyDocument==='string'?JSON.parse(decodeURIComponent(rolePolicy.PolicyDocument)):rolePolicy?.PolicyDocument;}catch{fail('late-launch-deny');}
 if(p.StackServiceRoleArn!==expectedRole||stackSummary?.Stacks?.length!==1||
    stackSummary.Stacks[0].StackId!==event.StackId||stackSummary.Stacks[0].RoleARN!==expectedRole||
    rolePolicy?.RoleName!==expectedRole.split('/').at(-1)||rolePolicy?.PolicyName!==LAUNCH_DENY_POLICY_NAME||
    canonicalJson(document)!==canonicalJson(launchDeadlinePolicy(p.DeadlineMs))||
    sha256(canonicalJson(document))!==p.LaunchDenyPolicySha256)fail('late-launch-deny');
 let actualStackPolicy;
 try{actualStackPolicy=JSON.parse(stackPolicy?.StackPolicyBody);}catch{fail('stack-policy');}
 if(canonicalJson(actualStackPolicy)!==canonicalJson(closedHostStackPolicy())||
    sha256(canonicalJson(actualStackPolicy))!==p.StackPolicySha256)fail('stack-policy');
 if(provider?.FunctionArn!==p.ServiceToken||typeof provider.CodeSha256!=='string'||
    Buffer.from(provider.CodeSha256,'base64').toString('hex')!==p.ProviderCodeSha256)fail('provider-code');
 if(machine?.stateMachineArn!==p.StateMachineVersionArn||machine?.type!=='STANDARD'||machine?.status!=='ACTIVE'||
    typeof machine?.definition!=='string'||sha256(machine.definition)!==p.WatchdogDefinitionSha256)fail('watchdog-version');
 if(qualification?.schema!=='meri-d005-watchdog-qualification/1'||
    qualification?.stateMachineVersionArn!==p.StateMachineVersionArn||
    qualification?.definitionSha256!==p.WatchdogDefinitionSha256||
    qualification?.roleArn!==machine.roleArn||
    qualification?.evidenceSha256!==p.QualificationEvidenceSha256||
    qualification?.positiveRootVolumeAbsenceQualified!==true||
    qualification?.managedSurvivalMeasured!==true||
    qualification?.lateProvisioningReconciliationQualified!==true||
    qualification?.originalCeilingMeasured!==true||
    !Number.isSafeInteger(qualification.issuedAtMs)||!Number.isSafeInteger(qualification.expiresAtMs)||
    qualification.issuedAtMs>now||qualification.expiresAtMs<now)fail('watchdog-not-qualified');
 const stateMachineArn=p.StateMachineVersionArn.replace(/:[1-9][0-9]*$/u,'');
 const expected={schema:WATCHDOG_INPUT_SCHEMA,hostId:p.HostId,generation:p.Generation,allocationSha256:p.AllocationSha256,
  sourceCommit:p.SourceCommit,imageUri:p.ImageUri,imageConfigSha256:p.ImageConfigSha256,
  bootstrapSha256:p.BootstrapSha256,nativeHelperSha256:p.NativeHelperSha256,templateSha256:p.TemplateSha256,
  originalT0Ms:p.OriginalT0Ms,deadlineMs:p.DeadlineMs};
 if(execution?.executionArn!==p.ExecutionArn||execution?.stateMachineArn!==stateMachineArn||
    execution?.stateMachineVersionArn!==p.StateMachineVersionArn||execution?.status!=='RUNNING'||
    execution?.input!==canonicalJson(expected)||!Number.isSafeInteger(ms(execution.startDate))||
    ms(execution.startDate)<p.OriginalT0Ms||ms(execution.startDate)>p.OriginalT0Ms+60_000||
    ms(execution.startDate)>now||execution.stopDate!==undefined)fail('watchdog-not-armed');
 if(!Array.isArray(ami?.Images)||ami.Images.length!==1||ami.Images[0].ImageId!==p.AmiId||
    ami.Images[0].OwnerId!==p.AmiOwner||ami.Images[0].Architecture!==p.Architecture||
    ami.Images[0].State!=='available'||ami.Images[0].RootDeviceName!=='/dev/xvda'||
    ami.Images[0].RootDeviceType!=='ebs'||ami.Images[0].VirtualizationType!=='hvm'||
    !Array.isArray(ami.Images[0].BlockDeviceMappings)||ami.Images[0].BlockDeviceMappings.length!==1||
    ami.Images[0].BlockDeviceMappings[0].DeviceName!=='/dev/xvda'||!ami.Images[0].BlockDeviceMappings[0].Ebs)fail('ami-boundary');
 verifyClosedNetworkSnapshot(p,network);
 // The initial read can go stale while other inventory calls are in flight.
 const finalExecution=await ports.readExecution({arn:p.ExecutionArn});
 const finalNow=ports.nowMs();
 if(!Number.isSafeInteger(finalNow)||finalNow<now||finalNow>p.OriginalT0Ms+120_000||
    finalExecution?.executionArn!==p.ExecutionArn||finalExecution?.stateMachineVersionArn!==p.StateMachineVersionArn||
    finalExecution?.status!=='RUNNING'||finalExecution?.input!==execution.input||
    finalExecution?.stopDate!==undefined)fail('watchdog-stale-before-response');
 return Object.freeze({templateSha256:p.TemplateSha256,executionArn:p.ExecutionArn,checkedAtMs:finalNow});
}

/** The sender must PUT this JSON to the exact CloudFormation ResponseURL. */
export async function handleWatchdogPreflight(event,ports){
 const physical=event?.RequestType==='Create'?`meri-d005-preflight-${sha256(String(event.StackId)+String(event.ResourceProperties?.HostId)).slice(0,32)}`:event?.PhysicalResourceId;
 let status='FAILED',reason='WATCHDOG_PREFLIGHT_REFUSED';
 try{
  if(event?.RequestType==='Delete'&&typeof physical==='string'&&physical.startsWith('meri-d005-preflight-')){
   status='SUCCESS';reason=undefined;
  }else{
   await evaluateWatchdogPreflight(event,ports);
   status='SUCCESS';reason=undefined;
  }
 }catch{/* fail closed; do not place provider/AWS details in stack events */}
 const response={Status:status,RequestId:event?.RequestId,StackId:event?.StackId,
  LogicalResourceId:event?.LogicalResourceId,PhysicalResourceId:physical};
 if(reason)response.Reason=reason;
 await ports.sendResponse(event?.ResponseURL,response);
 return response;
}
