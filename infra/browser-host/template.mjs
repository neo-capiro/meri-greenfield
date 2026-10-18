// @ts-check
/**
 * Reviewable CloudFormation source for the private D005 host envelope.
 * Every resource has a literal-false condition. There is no parameter,
 * admission switch, AWS client, synthesis command, or launch path here.
 */
import {HOST_ACCOUNT,HOST_REGION,validateHostProposalBinding} from './binding.mjs';

const DENIED='SourceOnlyLaunchDenied';
const noLaunch=Object.freeze({'Fn::Equals':['source-only','launch-authorized']});

/** @param {unknown} value */
function freezeTree(value){
 if(value&&typeof value==='object'){
  for(const child of Object.values(value))freezeTree(child);
  if(!Object.isFrozen(value))Object.freeze(value);
 }
 return value;
}

/** @param {unknown} input */
export function compileBrowserHostDisabledTemplate(input){
 const b=validateHostProposalBinding(input);
 const {allocation:a,source:s,network:n,host:h}=b;
 const imageRepository=s.imageUri.slice(`${HOST_ACCOUNT}.dkr.ecr.${HOST_REGION}.amazonaws.com/`.length).split('@')[0];
 const imageRepositoryArn=`arn:aws:ecr:${HOST_REGION}:${HOST_ACCOUNT}:repository/${imageRepository}`;
 const tags=[
  {Key:'Project',Value:'meri-greenfield'},
  {Key:'MeriHostId',Value:a.hostId},
  {Key:'MeriGeneration',Value:String(a.generation)},
 ];
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'INERT D005 private browser/Bash host envelope. All resources have a literal-false condition; no runtime admission.',
  Metadata:{
   runtimeEnabled:false,deployable:false,launchAdmitted:false,
   sourceOnly:true,watchdogArmed:false,rootVolumeAbsenceQualified:false,
   sourceCommit:s.sourceCommit,imageUri:s.imageUri,imageConfigSha256:s.imageConfigSha256,
   bootstrapSha256:s.bootstrapSha256,seccompSha256:s.seccompSha256,
   amiOwner:h.amiOwner,hostId:a.hostId,generation:a.generation,
   note:'The AMI owner, image digest, host launcher and managed teardown require independent review before any live resource is proposed.',
  },
  Conditions:{[DENIED]:noLaunch},
  Resources:{
   HostSecurityGroup:{Condition:DENIED,Type:'AWS::EC2::SecurityGroup',Properties:{
    VpcId:n.vpcId,
    GroupDescription:'Source-only private Meri browser host; control SG egress only',
    SecurityGroupIngress:[],
    SecurityGroupEgress:[{IpProtocol:'tcp',FromPort:443,ToPort:443,
     DestinationSecurityGroupId:n.controlSecurityGroupId,
     Description:'Pinned private control security group only'}],
    Tags:tags,
   }},
   HostRole:{Condition:DENIED,Type:'AWS::IAM::Role',Properties:{
    AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{
     Effect:'Allow',Principal:{Service:'ec2.amazonaws.com'},Action:'sts:AssumeRole',
     Condition:{StringEquals:{'aws:SourceAccount':HOST_ACCOUNT}},
    }]},
    Policies:[{PolicyName:'ExactImagePullOnly',PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:['ecr:GetAuthorizationToken'],Resource:'*'},
     {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'],Resource:imageRepositoryArn},
    ]}}],
    Tags:tags,
   }},
   HostInstanceProfile:{Condition:DENIED,Type:'AWS::IAM::InstanceProfile',Properties:{
    Roles:[{Ref:'HostRole'}],
   }},
   HostInstance:{Condition:DENIED,Type:'AWS::EC2::Instance',Properties:{
    ImageId:h.amiId,InstanceType:h.instanceType,
    IamInstanceProfile:{Ref:'HostInstanceProfile'},
    NetworkInterfaces:[{DeviceIndex:'0',AssociatePublicIpAddress:false,
     SubnetId:n.subnetId,GroupSet:[{Ref:'HostSecurityGroup'}]}],
    MetadataOptions:{HttpEndpoint:'enabled',HttpTokens:'required',HttpPutResponseHopLimit:1,
     HttpProtocolIpv6:'disabled',InstanceMetadataTags:'disabled'},
    InstanceInitiatedShutdownBehavior:'terminate',
    BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{VolumeType:'gp3',VolumeSize:h.rootVolumeGiB,
     Encrypted:true,DeleteOnTermination:true}}],
    Tags:tags,
   }},
  },
 });
}
