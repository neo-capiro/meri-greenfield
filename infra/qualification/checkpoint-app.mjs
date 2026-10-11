// Independent synthetic-only SDK checkpoint resources. This file synthesizes
// source; importing it does not contact or mutate AWS.
import { App, Stack, BootstraplessSynthesizer, Duration, RemovalPolicy, CfnOutput, Tags,
  aws_iam as iam, aws_kms as kms, aws_s3 as s3 } from 'aws-cdk-lib';

const account = '967807252336', region = 'us-east-1';
const bucketName = `meri-greenfield-qual-checkpoint-${account}-${region}`;
const prefix = 'qualification-sdk/fixture/*';
const app = new App({ outdir: 'cdk.out/qualification-checkpoint' });
for (const [name, value] of Object.entries({ Project: 'meri-greenfield',
  Environment: 'qualification', Owner: 'Codex-integration', SourcesEnabled: 'false' })) {
  Tags.of(app).add(name, value);
}

class CheckpointStack extends Stack {
  constructor(scope, id) {
    super(scope, id, { env: { account, region }, synthesizer: new BootstraplessSynthesizer(),
      description: 'Dedicated synthetic SDK checkpoint bucket and trusted control role' });
    const key = new kms.Key(this, 'CheckpointKey', {
      alias: 'alias/meri-greenfield/qualification-sdk-checkpoint',
      enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN,
    });
    const bucket = new s3.Bucket(this, 'CheckpointBucket', {
      bucketName, versioned: true, enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS, encryptionKey: key,
      bucketKeyEnabled: false,
      objectLockEnabled: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.governance(Duration.days(7)),
      removalPolicy: RemovalPolicy.RETAIN,
    });
    for (const conditions of [
      { Null: { 's3:if-none-match': 'true' },
        Bool: { 's3:ObjectCreationOperation': 'true' } },
      { StringNotEqualsIfExists: { 's3:x-amz-server-side-encryption': 'aws:kms' } },
      { ArnNotEqualsIfExists: {
        's3:x-amz-server-side-encryption-aws-kms-key-id': key.keyArn } },
    ]) {
      bucket.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.DENY, principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'], resources: [bucket.arnForObjects(prefix)],
        conditions,
      }));
    }
    const role = new iam.Role(this, 'ControlTaskRole', {
      roleName: 'meri-greenfield-qualification-sdk-control',
      description: 'Only the trusted synthetic SDK checkpoint control task uses this role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com', { conditions: {
        StringEquals: { 'aws:SourceAccount': account },
        ArnLike: { 'aws:SourceArn': `arn:aws:ecs:${region}:${account}:*` },
      } }),
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [bucket.arnForObjects(prefix)],
      conditions: {
        Null: { 's3:if-none-match': 'false' },
        StringEquals: { 's3:x-amz-server-side-encryption': 'aws:kms',
          's3:x-amz-server-side-encryption-aws-kms-key-id': key.keyArn },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetObjectVersion'],
      resources: [bucket.arnForObjects(prefix)],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:DescribeKey'],
      resources: [key.keyArn],
      conditions: {
        StringEquals: { 'kms:ViaService': `s3.${region}.amazonaws.com` },
        ArnLike: { 'kms:EncryptionContext:aws:s3:arn': bucket.arnForObjects(prefix) },
      },
    }));
    new CfnOutput(this, 'CheckpointBucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'CheckpointKeyArn', { value: key.keyArn });
    new CfnOutput(this, 'ControlTaskRoleArn', { value: role.roleArn });
  }
}

new CheckpointStack(app, 'MeriGreenfield-QualificationSdkCheckpoint');
app.synth();
