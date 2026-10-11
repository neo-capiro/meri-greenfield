import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = JSON.parse(readFileSync(new URL(
  '../../cdk.out/qualification-checkpoint/MeriGreenfield-QualificationSdkCheckpoint.template.json',
  import.meta.url)));
const resources = type => Object.entries(template.Resources)
  .filter(([, row]) => row.Type === type).map(([id, row]) => ({ id, ...row.Properties }));
const one = type => { const found = resources(type); assert.equal(found.length, 1); return found[0]; };
const actions = statement => Array.isArray(statement.Action) ? statement.Action : [statement.Action];
const serialized = value => JSON.stringify(value);

test('checkpoint candidate creates only isolated bucket/key and unused trusted role', () => {
  assert.deepEqual(Object.values(template.Resources).map(row => row.Type).sort(), [
    'AWS::IAM::Policy', 'AWS::IAM::Role', 'AWS::KMS::Alias', 'AWS::KMS::Key',
    'AWS::S3::Bucket', 'AWS::S3::BucketPolicy',
  ].sort());
  const bucket = one('AWS::S3::Bucket');
  assert.equal(bucket.BucketName, 'meri-greenfield-qual-checkpoint-967807252336-us-east-1');
  assert.equal(bucket.VersioningConfiguration.Status, 'Enabled');
  assert.equal(bucket.ObjectLockEnabled, true);
  assert.deepEqual(bucket.ObjectLockConfiguration.Rule.DefaultRetention,
    { Mode: 'GOVERNANCE', Days: 7 });
  assert.equal(bucket.BucketEncryption.ServerSideEncryptionConfiguration[0].BucketKeyEnabled, false);
  assert.equal(bucket.BucketEncryption.ServerSideEncryptionConfiguration[0]
    .ServerSideEncryptionByDefault.SSEAlgorithm, 'aws:kms');
  assert.equal(bucket.OwnershipControls.Rules[0].ObjectOwnership, 'BucketOwnerEnforced');
  assert(Object.values(bucket.PublicAccessBlockConfiguration).every(value => value === true));
  assert(!serialized(template).includes('Fn::ImportValue'));
  assert(!serialized(template).includes('capiro-dev'));
  assert(!serialized(template).includes('meri-greenfield-qual-build'));
});

test('future control role is task-bound with conditional KMS object access only', () => {
  const role = one('AWS::IAM::Role');
  assert.equal(role.RoleName, 'meri-greenfield-qualification-sdk-control');
  const trust = role.AssumeRolePolicyDocument.Statement[0];
  assert.equal(trust.Principal.Service, 'ecs-tasks.amazonaws.com');
  assert.equal(trust.Condition.StringEquals['aws:SourceAccount'], '967807252336');
  assert.equal(trust.Condition.ArnLike['aws:SourceArn'],
    'arn:aws:ecs:us-east-1:967807252336:*');
  const policy = one('AWS::IAM::Policy').PolicyDocument.Statement;
  assert.equal(policy.length, 3);
  const put = policy.find(row => actions(row).includes('s3:PutObject'));
  assert.deepEqual(actions(put), ['s3:PutObject']);
  assert.equal(put.Condition.Null['s3:if-none-match'], 'false');
  assert.equal(put.Condition.StringEquals['s3:x-amz-server-side-encryption'], 'aws:kms');
  assert.deepEqual(put.Condition.StringEquals['s3:x-amz-server-side-encryption-aws-kms-key-id'],
    { 'Fn::GetAtt': [one('AWS::KMS::Key').id, 'Arn'] });
  const read = policy.find(row => actions(row).includes('s3:GetObject'));
  assert.deepEqual(actions(read), ['s3:GetObject', 's3:GetObjectVersion']);
  for (const row of [put, read]) {
    assert(serialized(row.Resource).includes('/qualification-sdk/fixture/*'));
  }
  const key = policy.find(row => actions(row).includes('kms:Decrypt'));
  assert.deepEqual(actions(key), ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:DescribeKey']);
  assert.equal(key.Condition.StringEquals['kms:ViaService'], 's3.us-east-1.amazonaws.com');
  assert(serialized(key.Condition.ArnLike['kms:EncryptionContext:aws:s3:arn'])
    .includes('/qualification-sdk/fixture/*'));
  assert(!policy.some(row => actions(row).some(action =>
    /Delete|Bypass|Retention|LegalHold|List|\*/.test(action))));
});

test('bucket policy enforces TLS and preserves resources', () => {
  const bucketPolicy = one('AWS::S3::BucketPolicy');
  const deny = bucketPolicy.PolicyDocument.Statement.filter(row => row.Effect === 'Deny');
  assert.equal(deny.length, 4);
  assert(deny.some(row =>
    row.Condition?.Bool?.['aws:SecureTransport'] === 'false'));
  assert(deny.some(row => row.Condition?.Null?.['s3:if-none-match'] === 'true' &&
    row.Condition?.Bool?.['s3:ObjectCreationOperation'] === 'true'));
  assert(deny.some(row => row.Condition?.StringNotEqualsIfExists?.[
    's3:x-amz-server-side-encryption'] === 'aws:kms'));
  assert(deny.some(row => row.Condition?.ArnNotEqualsIfExists?.[
    's3:x-amz-server-side-encryption-aws-kms-key-id']));
  for (const type of ['AWS::S3::Bucket', 'AWS::KMS::Key']) {
    const [id] = Object.entries(template.Resources).find(([, row]) => row.Type === type);
    assert.equal(template.Resources[id].DeletionPolicy, 'Retain');
    assert.equal(template.Resources[id].UpdateReplacePolicy, 'Retain');
  }
});
