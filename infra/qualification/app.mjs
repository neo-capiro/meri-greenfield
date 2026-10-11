import { App, Stack, BootstraplessSynthesizer, Duration, RemovalPolicy, Tags, CfnOutput, CfnParameter, aws_codebuild as codebuild, aws_ec2 as ec2, aws_ecr as ecr, aws_ecs as ecs, aws_iam as iam, aws_kms as kms, aws_logs as logs, aws_s3 as s3, aws_route53resolver as resolver } from 'aws-cdk-lib';

// Qualification resources only. No imports, lookups or grants to Capiro stacks.
const target = { account: '967807252336', region: 'us-east-1' };
const app = new App({ outdir: 'cdk.out/qualification' });
Tags.of(app).add('Project', 'meri-greenfield');
Tags.of(app).add('Environment', 'qualification');
Tags.of(app).add('Owner', 'Codex-integration');
Tags.of(app).add('SourcesEnabled', 'false');
const logKeyActions = ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'];
function permitEncryptedLogs(key, name, role) {
  key.addToResourcePolicy(new iam.PolicyStatement({
    principals: [new iam.ServicePrincipal(`logs.${target.region}.amazonaws.com`)],
    actions: logKeyActions, resources: ['*'],
    conditions: { ArnEquals: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${target.region}:${target.account}:log-group:${name}` } },
  }));
  role.addToPolicy(new iam.PolicyStatement({
    actions: logKeyActions, resources: [key.keyArn],
    conditions: { StringEquals: { 'kms:ViaService': `logs.${target.region}.amazonaws.com` } },
  }));
}
function ecsTrust() {
  return new iam.ServicePrincipal('ecs-tasks.amazonaws.com', { conditions: {
    StringEquals: { 'aws:SourceAccount': target.account },
    ArnLike: { 'aws:SourceArn': `arn:aws:ecs:${target.region}:${target.account}:*` },
  } });
}

class BuildStack extends Stack {
  constructor(scope, id) {
    super(scope, id, { env: target, synthesizer: new BootstraplessSynthesizer(), description: 'New isolated Meri qualification build resources; no source access' });
    const key = new kms.Key(this, 'BuildKey', { alias: 'alias/meri-greenfield/qualification-build', enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN });
    const sourceBucket = new s3.Bucket(this, 'BuildInputs', {
      bucketName: `meri-greenfield-qual-build-${target.account}-${target.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS, encryptionKey: key,
      enforceSSL: true, versioned: true, removalPolicy: RemovalPolicy.RETAIN,
    });
    const repository = new ecr.Repository(this, 'WorkerRepository', {
      repositoryName: 'meri-greenfield/qualification-worker',
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true, encryption: ecr.RepositoryEncryption.KMS, encryptionKey: key,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const logGroup = new logs.LogGroup(this, 'BuildLogs', {
      logGroupName: '/meri-greenfield/qualification/build',
      retention: logs.RetentionDays.ONE_MONTH, encryptionKey: key, removalPolicy: RemovalPolicy.RETAIN,
    });
    const projectName = 'meri-greenfield-qualification-build';
    const role = new iam.Role(this, 'BuilderRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com', { conditions: {
        StringEquals: { 'aws:SourceAccount': target.account },
        ArnEquals: { 'aws:SourceArn': `arn:aws:codebuild:${target.region}:${target.account}:project/${projectName}` },
      } }),
      description: 'Trusted image builder; only new qualification input bucket, ECR repository, logs and key',
    });
    sourceBucket.grantRead(role, 'inputs/*');
    role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [sourceBucket.arnForObjects('results/*')] }));
    key.grantEncrypt(role);
    repository.grantPullPush(role);
    role.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:DescribeImages'], resources: [repository.repositoryArn] }));
    logGroup.grantWrite(role);
    permitEncryptedLogs(key, '/meri-greenfield/qualification/build', role);
    const project = new codebuild.Project(this, 'ImageBuilder', {
      projectName, role, encryptionKey: key,
      source: codebuild.Source.s3({ bucket: sourceBucket, path: 'inputs/qualification-source.zip' }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        // Privileged Docker is confined to this trusted build job, never Fargate.
        privileged: true,
        environmentVariables: {
          REPOSITORY_URI: { value: repository.repositoryUri },
          REPOSITORY_NAME: { value: repository.repositoryName },
          RESULT_BUCKET: { value: sourceBucket.bucketName },
          IMAGE_TAG: { value: 'UNSET-REQUIRES-ACCEPTED-COMMIT' },
        },
      },
      timeout: Duration.minutes(30), queuedTimeout: Duration.minutes(5), concurrentBuildLimit: 1,
      logging: { cloudWatch: { logGroup } },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2', env: { shell: 'bash' },
        phases: {
          pre_build: { commands: [
            'set -euo pipefail',
            '[[ "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ ]]',
            'aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | docker login --username AWS --password-stdin "${REPOSITORY_URI%%/*}"',
          ] },
          build: { commands: [
            'set -euo pipefail',
            'timeout --signal=TERM --kill-after=5s 45s python3 -I -B -S scripts/qualification/worker_context.py --output "$CODEBUILD_SRC_DIR/.meri-worker-context"',
            'docker build --pull --platform linux/amd64 -f "$CODEBUILD_SRC_DIR/.meri-worker-context/context/Dockerfile" -t "$REPOSITORY_URI:$IMAGE_TAG" "$CODEBUILD_SRC_DIR/.meri-worker-context/context"',
          ] },
          post_build: { commands: [
            'set -euo pipefail',
            '[ "${CODEBUILD_BUILD_SUCCEEDING:-0}" = 1 ]',
            'docker push "$REPOSITORY_URI:$IMAGE_TAG"',
            'aws ecr describe-images --repository-name "$REPOSITORY_NAME" --image-ids "imageTag=$IMAGE_TAG" --output json > image-manifest.json',
            'aws s3 cp image-manifest.json "s3://$RESULT_BUCKET/results/$IMAGE_TAG/image-manifest.json" --only-show-errors',
            'cat image-manifest.json',
          ] },
        },
      }),
    });
    new CfnOutput(this, 'SourceBucket', { value: sourceBucket.bucketName });
    new CfnOutput(this, 'BuildProject', { value: project.projectName });
    new CfnOutput(this, 'RepositoryUri', { value: repository.repositoryUri });
    new CfnOutput(this, 'RepositoryName', { value: repository.repositoryName });
  }
}

class RuntimeStack extends Stack {
  constructor(scope, id) {
    super(scope, id, { env: target, synthesizer: new BootstraplessSynthesizer(), description: 'New synthetic-only isolated Fargate qualification network and task' });
    const image = new CfnParameter(this, 'WorkerImage', {
      type: 'String', description: 'Accepted qualification ECR image pinned by sha256 digest',
      allowedPattern: `^${target.account}\\.dkr\\.ecr\\.${target.region}\\.amazonaws\\.com/meri-greenfield/qualification-worker@sha256:[a-f0-9]{64}$`,
    });
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'meri-greenfield-qualification', ipAddresses: ec2.IpAddresses.cidr('10.80.0.0/16'),
      availabilityZones: ['us-east-1a', 'us-east-1b'], natGateways: 0, createInternetGateway: false,
      subnetConfiguration: [{ name: 'isolated-worker', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 }],
    });
    const workerSg = new ec2.SecurityGroup(this, 'WorkerSecurityGroup', { vpc, allowAllOutbound: false, description: 'Qualification worker: only new image/log endpoints and restricted S3 layer endpoint' });
    const endpointSg = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', { vpc, allowAllOutbound: false, description: 'New private ECR and log endpoints' });
    endpointSg.addIngressRule(workerSg, ec2.Port.tcp(443), 'Worker to new private endpoints');
    workerSg.addEgressRule(endpointSg, ec2.Port.tcp(443), 'Only new private endpoints');
    // Observed regional AWS-managed S3 prefix list; endpoint policy limits objects.
    workerSg.addEgressRule(ec2.Peer.prefixList('pl-63a5400a'), ec2.Port.tcp(443), 'ECR regional image-layer S3 gateway endpoint');
    for (const [name, service] of [
      ['EcrApi', ec2.InterfaceVpcEndpointAwsService.ECR],
      ['EcrDocker', ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER],
      ['CloudWatchLogs', ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS],
    ]) {
      vpc.addInterfaceEndpoint(name, { service, privateDnsEnabled: true, securityGroups: [endpointSg], open: false });
    }
    const s3Endpoint = vpc.addGatewayEndpoint('ImageLayers', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    s3Endpoint.addToPolicy(new iam.PolicyStatement({
      principals: [new iam.AnyPrincipal()], actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::prod-${target.region}-starport-layer-bucket/*`],
    }));
    // Security groups do not filter AmazonProvidedDNS. Allow only fixed AWS
    // image/log names, then block everything else before any worker launch.
    const allowedDns = new resolver.CfnFirewallDomainList(this, 'AllowedDns', {
      name: 'meri-greenfield-qualification-allow', domains: [
        `api.ecr.${target.region}.amazonaws.com`,
        `${target.account}.dkr.ecr.${target.region}.amazonaws.com`,
        `logs.${target.region}.amazonaws.com`,
        `prod-${target.region}-starport-layer-bucket.s3.${target.region}.amazonaws.com`,
        `prod-${target.region}-starport-layer-bucket.s3.amazonaws.com`,
        // Observed CNAME target of the regional ECR-layer bucket; retain full
        // redirection inspection rather than trusting a blocked target.
        `s3-r-w.${target.region}.amazonaws.com`,
      ],
    });
    const blockedDns = new resolver.CfnFirewallDomainList(this, 'BlockedDns', { name: 'meri-greenfield-qualification-deny', domains: ['*'] });
    const dnsRules = new resolver.CfnFirewallRuleGroup(this, 'DnsRules', {
      name: 'meri-greenfield-qualification', firewallRules: [
        { action: 'ALLOW', firewallDomainListId: allowedDns.attrId, priority: 100, firewallDomainRedirectionAction: 'INSPECT_REDIRECTION_DOMAIN' },
        { action: 'BLOCK', blockResponse: 'NXDOMAIN', firewallDomainListId: blockedDns.attrId, priority: 200 },
      ],
    });
    new resolver.CfnFirewallRuleGroupAssociation(this, 'DnsAssociation', {
      name: 'meri-greenfield-qualification', firewallRuleGroupId: dnsRules.attrId,
      priority: 101, vpcId: vpc.vpcId, mutationProtection: 'DISABLED',
    });
    const key = new kms.Key(this, 'RuntimeLogKey', { alias: 'alias/meri-greenfield/qualification-runtime-logs', enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN });
    const logGroup = new logs.LogGroup(this, 'RuntimeLogs', { logGroupName: '/meri-greenfield/qualification/runtime', encryptionKey: key, retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.RETAIN });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, clusterName: 'meri-greenfield-qualification' });
    const executionRole = new iam.Role(this, 'ExecutionRole', { assumedBy: ecsTrust(), description: 'ECS image pull/logs only; not an application worker role' });
    executionRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    executionRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:BatchCheckLayerAvailability','ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'], resources: [`arn:aws:ecr:${target.region}:${target.account}:repository/meri-greenfield/qualification-worker`] }));
    logGroup.grantWrite(executionRole);
    permitEncryptedLogs(key, '/meri-greenfield/qualification/runtime', executionRole);
    const taskRole = new iam.Role(this, 'EmptyWorkerRole', { assumedBy: ecsTrust(), description: 'No IAM actions; worker has no source/provider/Temporal/admin credentials' });
    const task = new ecs.FargateTaskDefinition(this, 'Task', {
      family: 'meri-greenfield-qualification', cpu: 2048, memoryLimitMiB: 8192,
      ephemeralStorageGiB: 50, executionRole, taskRole,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.X86_64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
      volumes: [{ name: 'workspace' }, { name: 'tmp' }],
    });
    const linux = new ecs.LinuxParameters(this, 'LinuxParameters');
    linux.dropCapabilities(ecs.Capability.ALL);
    const container = task.addContainer('worker', {
      image: ecs.ContainerImage.fromRegistry(image.valueAsString),
      user: '10001:10001', readonlyRootFilesystem: true, privileged: false,
      linuxParameters: linux, stopTimeout: Duration.seconds(60),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'qualification' }),
      environment: {
        MERI_QUALIFICATION_ONLY: 'true', MERI_SOURCES_ENABLED: 'false',
        HOME: '/workspace/home', TMPDIR: '/tmp', CLAUDE_CONFIG_DIR: '/workspace/config',
        PLAYWRIGHT_BROWSERS_PATH: '/opt/meri-browsers', CHROMIUM_SANDBOX_REQUIRED: 'true',
      },
    });
    container.addMountPoints({ sourceVolume: 'workspace', containerPath: '/workspace', readOnly: false }, { sourceVolume: 'tmp', containerPath: '/tmp', readOnly: false });
    new CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'TaskDefinitionArn', { value: task.taskDefinitionArn });
    new CfnOutput(this, 'SubnetIds', { value: vpc.isolatedSubnets.map(s => s.subnetId).join(',') });
    new CfnOutput(this, 'WorkerSecurityGroupId', { value: workerSg.securityGroupId });
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
  }
}

new BuildStack(app, 'MeriGreenfield-QualificationBuild');
new RuntimeStack(app, 'MeriGreenfield-QualificationRuntime');
app.synth();
