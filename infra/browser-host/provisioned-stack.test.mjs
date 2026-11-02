import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProvisionedBrowserHostTemplate,validateProvisionedBrowserHostInput,BROWSER_HOST_LISTENER_PORT} from './provisioned-stack.mjs';

const input=()=>({vpcId:'vpc-0123456789abcdef0',vpcCidr:'10.42.0.0/16',controlSecurityGroupId:'sg-0123456789abcdef0',
 imageRepository:'meri-greenfield/browser-host',logGroupName:'/meri-greenfield/browser-host'});

test('the static stack holds only the shared group, role, profile and log group; the per-run instance is not a stack resource',()=>{
 const t=compileProvisionedBrowserHostTemplate(input());
 assert.deepEqual(Object.keys(t.Resources).sort(),['BrowserHostInstanceProfile','BrowserHostLogGroup','BrowserHostRole','BrowserHostSecurityGroup']);
 assert.equal(Object.hasOwn(t,'Parameters'),false);assert.equal(Object.hasOwn(t,'Conditions'),false);
 assert.equal(Object.isFrozen(t.Resources.BrowserHostRole.Properties),true);
 assert.deepEqual(Object.keys(t.Outputs).sort(),['BrowserHostInstanceProfileArn','BrowserHostInstanceProfileName','BrowserHostLogGroupName','BrowserHostSecurityGroupId']);
 assert.deepEqual(t.Outputs.BrowserHostInstanceProfileName.Value,{Ref:'BrowserHostInstanceProfile'});
});
test('ingress is the one Control-sourced listener port; egress is Control, VPC DNS and the public web only',()=>{
 const sg=compileProvisionedBrowserHostTemplate(input()).Resources.BrowserHostSecurityGroup.Properties;
 assert.deepEqual(sg.SecurityGroupIngress,[{IpProtocol:'tcp',FromPort:BROWSER_HOST_LISTENER_PORT,ToPort:BROWSER_HOST_LISTENER_PORT,SourceSecurityGroupId:'sg-0123456789abcdef0',Description:'Control to the pinned host listener'}]);
 assert.equal(BROWSER_HOST_LISTENER_PORT,9444);
 const egress=sg.SecurityGroupEgress.map(r=>[r.IpProtocol,r.FromPort,r.ToPort,r.DestinationSecurityGroupId??r.CidrIp]);
 assert.deepEqual(egress,[['tcp',443,443,'sg-0123456789abcdef0'],['udp',53,53,'10.42.0.0/16'],['tcp',53,53,'10.42.0.0/16'],['tcp',443,443,'0.0.0.0/0'],['tcp',80,80,'0.0.0.0/0']]);
 assert.equal(sg.SecurityGroupIngress.some(r=>r.CidrIp!==undefined),false,'no CIDR ingress');
 assert.equal(sg.SecurityGroupEgress.some(r=>r.IpProtocol==='-1'||r.CidrIpv6!==undefined),false,'no open protocol or IPv6 egress');
});
test('the role carries SSM core, pull of the one image repository and writes to its own log group, nothing else',()=>{
 const role=compileProvisionedBrowserHostTemplate(input()).Resources.BrowserHostRole.Properties;
 assert.deepEqual(role.ManagedPolicyArns,['arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore']);
 const statements=role.Policies[0].PolicyDocument.Statement;
 assert.deepEqual(statements.map(s=>[].concat(s.Action).join(',')),['ecr:GetAuthorizationToken','ecr:BatchCheckLayerAvailability,ecr:BatchGetImage,ecr:GetDownloadUrlForLayer','logs:CreateLogStream,logs:PutLogEvents']);
 assert.equal(statements[1].Resource,'arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/browser-host');
 assert.equal(statements[2].Resource,'arn:aws:logs:us-east-1:967807252336:log-group:/meri-greenfield/browser-host:log-stream:*');
 for(const s of statements)assert.deepEqual(s.Condition,{StringEquals:{'aws:RequestedRegion':'us-east-1'}});
 assert.equal(JSON.stringify(role).includes('ec2:'),false);assert.equal(JSON.stringify(role).includes('s3:'),false);
});
test('the input is closed and exact',()=>{
 for(const bad of [{...input(),extra:true},{...input(),vpcId:'sg-0123456789abcdef0'},{...input(),vpcCidr:'0.0.0.0/0'},{...input(),vpcCidr:'10.0.0.0/8'},
  {...input(),imageRepository:'other/browser-host'},{...input(),logGroupName:'/other/browser-host'},{...input(),controlSecurityGroupId:'vpc-0123456789abcdef0'}])
  assert.throws(()=>validateProvisionedBrowserHostInput(bad),{code:'PROVISIONED_BROWSER_HOST_TEMPLATE_REFUSED'});
 assert.throws(()=>compileProvisionedBrowserHostTemplate(null),{code:'PROVISIONED_BROWSER_HOST_TEMPLATE_REFUSED'});
});
