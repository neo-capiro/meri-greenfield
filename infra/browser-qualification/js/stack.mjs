// W02-21 synthesized CDK stack (only when executed/imported by the CLI).
// cdk-lib bindings and the frozen class body are unchanged; importing the
// module alone synthesizes nothing.
import {
  Stack, BootstraplessSynthesizer, RemovalPolicy, Tags, CfnOutput, CfnParameter,
  aws_ec2 as ec2, aws_iam as iam, aws_kms as kms, aws_logs as logs,
} from 'aws-cdk-lib';
import { TARGET, QUALIFICATION_NETWORK, PINS, validateRunUUID, validateAssetsImage } from './config.mjs';
import { buildUserDataPayload } from './user-data.mjs';

const LOG_KEY_ACTIONS = ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'];
export class BrowserQualificationStack extends Stack {
  constructor(scope, id, runUUID, assetsImage) {
    validateRunUUID(runUUID);
    validateAssetsImage(assetsImage);
    super(scope, id, {
      env: { account: TARGET.account, region: TARGET.region },
      synthesizer: new BootstraplessSynthesizer(),
      description: 'New isolated browser-host qualification host; no source access, no Capiro imports',
    });
    const run = new CfnParameter(this, 'QualificationRun', {
      type: 'String', description: 'Exactly one owner-supplied qualification run UUID; bound to the instance tag, container and all evidence',
      allowedPattern: PINS.runIdPattern,
      default: runUUID, allowedValues: [runUUID],
    });
    new CfnParameter(this, 'QualificationAssetsImage', {
      type: 'String', description: 'Exactly one reviewed immutable support-image digest; must match literal loader and metadata',
      default: assetsImage, allowedValues: [assetsImage],
    });
    const userData = buildUserDataPayload(runUUID, assetsImage);
    this.templateOptions.metadata = { BrowserQualificationUserData: userData.metadata };
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'QualificationVpc', {
      vpcId: QUALIFICATION_NETWORK.vpcId, availabilityZones: [TARGET.az],
    });

    const key = new kms.Key(this, 'HostKey', {
      alias: 'alias/meri-greenfield/qualification-browser-host',
      description: 'Encrypts the browser-host root volume and CloudWatch logs only',
      enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN,
    });
    const logGroup = new logs.LogGroup(this, 'BrowserHostLogs', {
      logGroupName: PINS.logGroupName, retention: logs.RetentionDays.ONE_MONTH,
      encryptionKey: key, removalPolicy: RemovalPolicy.RETAIN,
    });
    key.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal(`logs.${TARGET.region}.amazonaws.com`)],
      actions: LOG_KEY_ACTIONS, resources: ['*'],
      conditions: { ArnEquals: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${TARGET.region}:${TARGET.account}:log-group:${PINS.logGroupName}` } },
    }));

    const hostRole = new iam.Role(this, 'BrowserHostRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com', {
        conditions: { StringEquals: { 'aws:SourceAccount': TARGET.account } },
      }),
      description: 'Browser host: same-repository ECR pull, its own log stream writes and scoped log key use only',
    });
    hostRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    hostRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [`arn:aws:ecr:${TARGET.region}:${TARGET.account}:repository/${PINS.imageRepository}`],
    }));
    logGroup.grantWrite(hostRole);
    hostRole.addToPolicy(new iam.PolicyStatement({
      actions: LOG_KEY_ACTIONS, resources: [key.keyArn],
      conditions: { StringEquals: { 'kms:ViaService': `logs.${TARGET.region}.amazonaws.com` } },
    }));

    const hostSg = new ec2.SecurityGroup(this, 'BrowserHostSecurityGroup', {
      vpc, allowAllOutbound: false,
      description: 'Browser host: egress to the NEW qualification endpoints and ECR layer prefix list only',
    });
    // NEW ingress-rule resource on the NEW endpoint SG; existing worker SG untouched.
    const endpointIngress = new ec2.CfnSecurityGroupIngress(this, 'HostToEndpointIngress', {
      groupId: QUALIFICATION_NETWORK.endpointSecurityGroupId,
      sourceSecurityGroupId: hostSg.securityGroupId,
      ipProtocol: 'tcp', fromPort: 443, toPort: 443,
      description: 'New browser host to new private endpoints',
    });
    // Restrict at GROUP CREATION. Standalone egress resources would leave the
    // initial group/default-rule state and instance readiness independent.
    // Both destinations are fixed existing IDs, so inline rules create no cycle.
    const hostSgResource = hostSg.node.defaultChild;
    hostSgResource.securityGroupEgress = [
      { ipProtocol: 'tcp', fromPort: 443, toPort: 443,
        destinationSecurityGroupId: QUALIFICATION_NETWORK.endpointSecurityGroupId,
        description: 'Only the new qualification endpoints' },
      { ipProtocol: 'tcp', fromPort: 443, toPort: 443,
        destinationPrefixListId: QUALIFICATION_NETWORK.s3PrefixListId,
        description: 'ECR regional image-layer S3 gateway endpoint' },
    ];

    const subnet = ec2.Subnet.fromSubnetAttributes(this, 'QualificationSubnet', {
      subnetId: QUALIFICATION_NETWORK.subnetId, availabilityZone: TARGET.az,
    });
    const instance = new ec2.Instance(this, 'BrowserHost', {
      vpc, vpcSubnets: { subnets: [subnet] },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.genericLinux({ [TARGET.region]: PINS.ami }),
      creditSpecification: ec2.CpuCredits.STANDARD,
      securityGroup: hostSg, role: hostRole,
      associatePublicIpAddress: false,
      httpTokens: ec2.HttpTokens.REQUIRED, httpPutResponseHopLimit: 1, httpProtocolIpv6: false, instanceMetadataTags: false,
      instanceInitiatedShutdownBehavior: ec2.InstanceInitiatedShutdownBehavior.TERMINATE,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(PINS.rootVolumeGiB, {
          volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true, kmsKey: key, deleteOnTermination: true,
        }),
      }],
    });
    // CfnInstance UserData is already API base64. Do not wrap in Fn::Base64.
    instance.instance.userData = userData.base64;
    // Explicit readiness dependencies (not only the IAM policy reference).
    instance.node.addDependency(endpointIngress);
    instance.node.addDependency(hostSg);
    instance.node.addDependency(logGroup);
    instance.node.addDependency(key);
    Tags.of(instance).add('QualificationRun', run.valueAsString);

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'HostSecurityGroupId', { value: hostSg.securityGroupId });
    new CfnOutput(this, 'HostRoleArn', { value: hostRole.roleArn });
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
    new CfnOutput(this, 'KeyArn', { value: key.keyArn });
    new CfnOutput(this, 'QualificationRunId', { value: run.valueAsString });
  }
}
