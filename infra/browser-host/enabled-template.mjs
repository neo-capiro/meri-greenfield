// @ts-check
/** Enabled closed-network host source. This module has no AWS client or deploy action. */
import {HOST_ACCOUNT,HOST_REGION} from './binding.mjs';
import {REVIEW_DIGEST_ZERO,canonicalJson,sha256,validateEnabledHostInput} from './enabled-binding.mjs';

const logName=hostId=>`/meri-greenfield/browser-host/${hostId}`;
const freezeTree=value=>{
 if(value&&typeof value==='object'){
  for(const child of Object.values(value))freezeTree(child);
  Object.freeze(value);
 }
 return value;
};
const tcp443=(field,id,description)=>({IpProtocol:'tcp',FromPort:443,ToPort:443,[field]:id,Description:description});

/** The two embedded digest fields are zeroed before hashing to avoid a self-reference. */
export function computeEnabledTemplateReviewSha256(template){
 const copy=JSON.parse(JSON.stringify(template));
 const a=copy?.Metadata?.templateReviewSha256;
 const b=copy?.Resources?.WatchdogPreflight?.Properties?.TemplateSha256;
 if(typeof a!=='string'||typeof b!=='string'||a!==b||!/^[0-9a-f]{64}$/u.test(a))
  throw Object.assign(new Error('ENABLED_BROWSER_HOST_TEMPLATE_REFUSED'),{code:'ENABLED_BROWSER_HOST_TEMPLATE_REFUSED'});
 copy.Metadata.templateReviewSha256=REVIEW_DIGEST_ZERO;
 copy.Resources.WatchdogPreflight.Properties.TemplateSha256=REVIEW_DIGEST_ZERO;
 return sha256(canonicalJson(copy));
}

/** @param {unknown} input */
export function compileEnabledBrowserHostTemplate(input){
 const b=validateEnabledHostInput(input);
 const {allocation:a,source:s,network:n,host:h}=b.proposal;
 const p=b.privateNetwork,w=b.watchdog;
 const repository=s.imageUri.slice(`${HOST_ACCOUNT}.dkr.ecr.${HOST_REGION}.amazonaws.com/`.length).split('@')[0];
 const ecrArn=`arn:aws:ecr:${HOST_REGION}:${HOST_ACCOUNT}:repository/${repository}`;
 const logs=logName(a.hostId);
 const logStreamArn=`arn:aws:logs:${HOST_REGION}:${HOST_ACCOUNT}:log-group:${logs}:log-stream:${a.hostId}/*`;
 const tags=[{Key:'Project',Value:'meri-greenfield'},{Key:'MeriHostId',Value:a.hostId},
  {Key:'MeriGeneration',Value:String(a.generation)},{Key:'MeriAllocationSha256',Value:b.allocationSha256}];
 const endpointIds=[n.controlSecurityGroupId,p.ecrApiSecurityGroupId,p.ecrDockerSecurityGroupId,p.logsSecurityGroupId];
 const egress=[...new Set(endpointIds)].map(id=>tcp443('DestinationSecurityGroupId',id,'Reviewed private endpoint or control only'));
 egress.push(tcp443('DestinationPrefixListId',p.s3GatewayPrefixListId,'Reviewed S3 gateway image layers only'));
 const template={
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Enabled D005 closed-network qualification host; watchdog preflight required before one private EC2 host. Product browser activation held.',
  Metadata:{sourceCommit:s.sourceCommit,imageUri:s.imageUri,imageConfigSha256:s.imageConfigSha256,
   bootstrapSha256:s.bootstrapSha256,nativeHelperSha256:b.bootstrap.nativeHelperSha256,
   nativeHostRelayHelperSha256:b.bootstrap.nativeHostRelayHelperSha256,
   seccompSha256:s.seccompSha256,amiOwner:h.amiOwner,hostId:a.hostId,generation:a.generation,
   networkMode:p.mode,stackServiceRoleArn:b.launchGuard.serviceRoleArn,
   launchDenyPolicySha256:b.launchGuard.policySha256,stackPolicySha256:b.launchGuard.stackPolicySha256,
   templateReviewSha256:REVIEW_DIGEST_ZERO,
   productionBrowserActivation:'held',nativeSandboxQualified:false,rootVolumeAbsenceQualified:false},
  Resources:{
   HostLogGroup:{Type:'AWS::Logs::LogGroup',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
    LogGroupName:logs,KmsKeyId:b.encryption.logsKmsKeyArn,RetentionInDays:7,Tags:tags,
   }},
   HostSecurityGroup:{Type:'AWS::EC2::SecurityGroup',Properties:{
    VpcId:n.vpcId,GroupDescription:'Private D005 host; pinned private endpoint egress only',
    SecurityGroupIngress:[],SecurityGroupEgress:egress,Tags:tags,
   }},
   HostRole:{Type:'AWS::IAM::Role',Properties:{
    AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',
     Principal:{Service:'ec2.amazonaws.com'},Action:'sts:AssumeRole',
     // EC2 does not document SourceAccount on instance-profile AssumeRole.
     // Check it when supplied, while keeping the documented EC2 trust path usable.
     Condition:{StringEqualsIfExists:{'aws:SourceAccount':HOST_ACCOUNT}}}]},
    Policies:[{PolicyName:'PinnedImageAndOwnLogs',PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:'ecr:GetAuthorizationToken',Resource:'*',
      Condition:{StringEquals:{'aws:RequestedRegion':HOST_REGION}}},
     {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'],Resource:ecrArn,
      Condition:{StringEquals:{'aws:RequestedRegion':HOST_REGION}}},
     {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:logStreamArn,
      Condition:{StringEquals:{'aws:RequestedRegion':HOST_REGION}}},
    ]}}],Tags:tags,
   }},
   HostInstanceProfile:{Type:'AWS::IAM::InstanceProfile',Properties:{Roles:[{Ref:'HostRole'}]}},
   WatchdogPreflight:{Type:'Custom::MeriWatchdogPreflight',Properties:{
    ServiceToken:w.serviceTokenArn,ServiceTimeout:'30',
    Schema:'meri-d005-watchdog-preflight/2',
    ProviderCodeSha256:w.providerCodeSha256,WatchdogDefinitionSha256:w.definitionSha256,
    QualificationEvidenceSha256:w.qualificationEvidenceSha256,
    StateMachineVersionArn:w.stateMachineVersionArn,ExecutionArn:w.executionArn,
    OriginalT0Ms:w.originalT0Ms,DeadlineMs:a.leaseDeadlineMs,
    AllocationSha256:b.allocationSha256,HostId:a.hostId,Generation:a.generation,
    SourceCommit:s.sourceCommit,ImageUri:s.imageUri,ImageConfigSha256:s.imageConfigSha256,
    BootstrapSha256:s.bootstrapSha256,NativeHelperSha256:b.bootstrap.nativeHelperSha256,
    NativeHostRelayHelperSha256:b.bootstrap.nativeHostRelayHelperSha256,
    TemplateSha256:REVIEW_DIGEST_ZERO,
    StackServiceRoleArn:b.launchGuard.serviceRoleArn,LaunchDenyPolicySha256:b.launchGuard.policySha256,
    StackPolicySha256:b.launchGuard.stackPolicySha256,
    AmiId:h.amiId,AmiOwner:h.amiOwner,Architecture:h.architecture,
    VpcId:n.vpcId,SubnetId:n.subnetId,ControlSecurityGroupId:n.controlSecurityGroupId,
    HostSecurityGroupId:{Ref:'HostSecurityGroup'},
    EcrApiSecurityGroupId:p.ecrApiSecurityGroupId,EcrDockerSecurityGroupId:p.ecrDockerSecurityGroupId,
    LogsSecurityGroupId:p.logsSecurityGroupId,S3GatewayPrefixListId:p.s3GatewayPrefixListId,
    NetworkMode:p.mode,
   }},
   HostInstance:{Type:'AWS::EC2::Instance',DependsOn:['WatchdogPreflight','HostLogGroup'],Properties:{
    ImageId:h.amiId,InstanceType:h.instanceType,CreditSpecification:{CPUCredits:'standard'},
    IamInstanceProfile:{Ref:'HostInstanceProfile'},UserData:b.bootstrap.userDataBase64,
    NetworkInterfaces:[{DeviceIndex:'0',AssociatePublicIpAddress:false,DeleteOnTermination:true,
     SubnetId:n.subnetId,GroupSet:[{Ref:'HostSecurityGroup'}]}],
    MetadataOptions:{HttpEndpoint:'enabled',HttpTokens:'required',HttpPutResponseHopLimit:1,
     HttpProtocolIpv6:'disabled',InstanceMetadataTags:'disabled'},
    InstanceInitiatedShutdownBehavior:'terminate',DisableApiTermination:false,
    Monitoring:false,PropagateTagsToVolumeOnCreation:true,
    BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{VolumeType:'gp3',VolumeSize:h.rootVolumeGiB,
     Encrypted:true,KmsKeyId:b.encryption.rootKmsKeyArn,DeleteOnTermination:true}}],Tags:tags,
   }},
  },
 };
 const digest=computeEnabledTemplateReviewSha256(template);
 template.Metadata.templateReviewSha256=digest;
 template.Resources.WatchdogPreflight.Properties.TemplateSha256=digest;
 if(computeEnabledTemplateReviewSha256(template)!==digest)throw Error('template digest mismatch');
 return freezeTree(template);
}
