/** Preview-only CloudFormation data; imports perform no IO, lookup or allocation. */
export const ref = name => ({Ref:name});
export const sub = value => ({'Fn::Sub':value});
export const attr = (name,key) => ({'Fn::GetAtt':[name,key]});
export const retain = resource => ({...resource,DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain'});
export const tags = () => [{Key:'Project',Value:'meri-greenfield'},{Key:'Environment',Value:'isolated-preview'},{Key:'Owner',Value:'Meri-shipping'},{Key:'P0',Value:'20261015-24h-25USD'}];
export const string = (description,pattern,more={}) => ({Type:'String',Description:description,...(pattern?{AllowedPattern:pattern}:{}),...more});
export const identifier = kind => string(`Verified Meri ${kind}.`,kind==='VPC'?'^vpc-[a-f0-9]+$':kind==='subnet'?'^subnet-[a-f0-9]+$':'^sg-[a-f0-9]+$');
export const image = description => string(description,'^[0-9]{12}\\.dkr\\.ecr\\.us-east-1\\.amazonaws\\.com/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$');
export function template(description,Parameters,Resources,Outputs={}) {
  return {AWSTemplateFormatVersion:'2010-09-09',Description:description,Metadata:{Status:'SOURCE_ONLY_ACTIONS_UNAPPROVED',P0:'24h topology and25USD only; P1-P8 remain separate',RuntimeActivation:'Not supplied by synthesis',NoCustomResources:true},Parameters:{ExpectedAccountId:string('Private current-account binding; no account is inferred from local credentials.','^[0-9]{12}$',{NoEcho:true}),...Parameters},Rules:{AccountAndRegion:{Assertions:[{Assert:{'Fn::Equals':[ref('AWS::AccountId'),ref('ExpectedAccountId')]},AssertDescription:'Must target the reviewed account.'},{Assert:{'Fn::Equals':[ref('AWS::Region'),'us-east-1']},AssertDescription:'Only us-east-1 preview is proposed.'}]}},Resources,Outputs};
}
export const taskTrust = () => ({Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'ecs-tasks.amazonaws.com'},Action:'sts:AssumeRole',Condition:{StringEquals:{'aws:SourceAccount':ref('AWS::AccountId')},ArnLike:{'aws:SourceArn':sub('arn:${AWS::Partition}:ecs:${AWS::Region}:${AWS::AccountId}:*')}}}]});
export const statement = (Action,Resource,Condition) => ({Effect:'Allow',Action,Resource,...(Condition?{Condition}:{})});
export const policy = Statement => ({Version:'2012-10-17',Statement});
export const templateBytes = value => Buffer.from(JSON.stringify(value)+'\n');
