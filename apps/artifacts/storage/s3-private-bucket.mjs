/** Read-only proof that the configured artifact bucket is private before anything is served from it by link. Four bucket reads, each
 * with ExpectedBucketOwner: every Block Public Access setting is on, the bucket policy status is not public (no policy is not public),
 * object ownership is BucketOwnerEnforced so ACLs grant nothing, and versioning is Enabled as the object adapter already requires.
 * A missing Block Public Access or ownership configuration is not private; any other answer, or an unreadable setting, refuses.
 * Nothing is written and no object is listed or read. Construction performs no IO.
 * The account-level Block Public Access setting is an S3 Control read outside this bucket client; it is not claimed here. */
import {GetPublicAccessBlockCommand,GetBucketPolicyStatusCommand,GetBucketOwnershipControlsCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {own,fail,storageLifetime,configuration,storageMethod,bucketIdentity} from './boundary.mjs';
const BLOCKS=Object.freeze(['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets']);
export function createPrivateBucketVerifier(options){
 const {client,bucket,expectedBucketOwner,now,maxRequestMs=15000}=own(options,['client','bucket','expectedBucketOwner','now'],['maxRequestMs']);
 configuration(now,maxRequestMs);const send=storageMethod(client,'send');bucketIdentity(bucket,expectedBucketOwner);
 const target={Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner};
 return Object.freeze({
  /** Resolves to frozen non-secret facts, or throws ARTIFACT_S3_NOT_PRIVATE (a setting allows public access) or
   * ARTIFACT_S3_PRIVACY_UNVERIFIED (a setting could not be read). */
  async verifyPrivate({signal}={}){
   const life=storageLifetime({now,maxRequestMs},signal),read=async(Command,absent)=>{
    try{const result=await life.run(signal=>send(new Command(target),{abortSignal:signal}));life.check();return result;}
    catch(error){life.check();if(absent!==undefined&&error?.name===absent)return null;fail('ARTIFACT_S3_PRIVACY_UNVERIFIED');}};
   try{
    const blocks=(await read(GetPublicAccessBlockCommand,'NoSuchPublicAccessBlockConfiguration'))?.PublicAccessBlockConfiguration;
    if(!blocks||!BLOCKS.every(name=>blocks[name]===true))fail('ARTIFACT_S3_NOT_PRIVATE');
    const policy=await read(GetBucketPolicyStatusCommand,'NoSuchBucketPolicy');if(policy!==null&&policy?.PolicyStatus?.IsPublic!==false)fail('ARTIFACT_S3_NOT_PRIVATE');
    const rules=(await read(GetBucketOwnershipControlsCommand,'OwnershipControlsNotFoundError'))?.OwnershipControls?.Rules;
    if(!Array.isArray(rules)||rules.length!==1||rules[0]?.ObjectOwnership!=='BucketOwnerEnforced')fail('ARTIFACT_S3_NOT_PRIVATE');
    if((await read(GetBucketVersioningCommand))?.Status!=='Enabled')fail('ARTIFACT_S3_NOT_PRIVATE');
    return Object.freeze({publicAccessBlocked:true,policyPublic:false,objectOwnership:'BucketOwnerEnforced',versioning:'Enabled'});
   }finally{life.close();}
  },
 });
}
