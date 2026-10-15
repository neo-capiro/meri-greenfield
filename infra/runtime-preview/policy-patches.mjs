import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const arn=value=>typeof value==='string'&&/^arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]*:.+$/u.test(value)&&!value.includes('*');

/** Offline append-only proposal. Caller retains exact baseline bytes; this module never applies it. */
export function appendPolicy({baselineBytes,expectedSha256,statements}){
  if(!(baselineBytes instanceof Uint8Array)||baselineBytes.byteLength>131072||sha(baselineBytes)!==expectedSha256||!Array.isArray(statements)||!statements.length)throw Error('POLICY_BASELINE_REFUSED');
  const base=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(baselineBytes));
  if(!base||base.Version!=='2012-10-17'||!Array.isArray(base.Statement)||base.Statement.some(s=>s.Sid?.startsWith('MeriRuntimePreview')))throw Error('POLICY_BASELINE_REFUSED');
  const ids=new Set(base.Statement.map(s=>s.Sid).filter(Boolean));
  for(const s of statements){if(!s.Sid?.startsWith('MeriRuntimePreview')||ids.has(s.Sid))throw Error('POLICY_STATEMENT_REFUSED');ids.add(s.Sid);}
  const proposed={...base,Statement:[...base.Statement,...structuredClone(statements)]},bytes=Buffer.from(JSON.stringify(proposed,null,2)+'\n');
  return {status:'PROPOSED_NOT_APPLIED',baselineSha256:expectedSha256,proposedSha256:sha(bytes),proposedBytes:bytes};
}

export function checkpointPolicyStatements({controlRoleArn,bucket,keyArn,prefix}){
  if(!arn(controlRoleArn)||!/^arn:aws:iam::[0-9]{12}:role\/meri-runtime-preview-control$/u.test(controlRoleArn)||!arn(keyArn)||!/^arn:aws:kms:us-east-1:[0-9]{12}:key\/[a-f0-9-]+$/u.test(keyArn)||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)||!/^native-preview\/[a-z0-9-]+$/u.test(prefix))throw Error('CHECKPOINT_SCOPE_REFUSED');
  const objects='arn:aws:s3:::'+bucket+'/'+prefix+'/*',Principal={AWS:controlRoleArn};
  return {
    bucket:[
      {Sid:'MeriRuntimePreviewRequireCreateOnly',Effect:'Deny',Principal:'*',Action:'s3:PutObject',Resource:objects,Condition:{StringNotEquals:{'s3:if-none-match':'*'}}},
      {Sid:'MeriRuntimePreviewRequireKms',Effect:'Deny',Principal:'*',Action:'s3:PutObject',Resource:objects,Condition:{StringNotEquals:{'s3:x-amz-server-side-encryption':'aws:kms'}}},
      {Sid:'MeriRuntimePreviewRequireExactKey',Effect:'Deny',Principal:'*',Action:'s3:PutObject',Resource:objects,Condition:{StringNotEquals:{'s3:x-amz-server-side-encryption-aws-kms-key-id':keyArn}}},
    ],
    endpoint:[
      {Sid:'MeriRuntimePreviewReadVersioning',Effect:'Allow',Principal,Action:'s3:GetBucketVersioning',Resource:'arn:aws:s3:::'+bucket},
      {Sid:'MeriRuntimePreviewExactObjects',Effect:'Allow',Principal,Action:['s3:PutObject','s3:GetObject','s3:GetObjectVersion'],Resource:objects},
    ],
  };
}
