// @ts-check
/** Static CloudFormation source for the browser-only host image repository. One immutable, scan-on-push ECR repository
 * (`meri-greenfield/browser-host`) with the platform AES256 encryption: the host instance role pulls from it and holds no
 * KMS grant (see provisioned-stack.mjs), so a customer-managed key here would break the pull. Images are referenced by digest
 * from the baked AMI and the deployment inputs, so the lifecycle rule keeps a generous count rather than expiring by age.
 * No AWS client, secret or deploy action lives here; the executor renders and reviews this template, then creates the stack. */
export const BROWSER_HOST_REPOSITORY='meri-greenfield/browser-host';
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};

export function compileBrowserHostRegistryTemplate(){
 const tags=[{Key:'Project',Value:'meri-greenfield'},{Key:'MeriHostPurpose',Value:'browser-only'}];
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri browser-only host image repository: immutable tags, scan on push, platform encryption.',
  Resources:{
   BrowserHostRepository:{Type:'AWS::ECR::Repository',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
    RepositoryName:BROWSER_HOST_REPOSITORY,ImageTagMutability:'IMMUTABLE',
    ImageScanningConfiguration:{ScanOnPush:true},EncryptionConfiguration:{EncryptionType:'AES256'},
    LifecyclePolicy:{LifecyclePolicyText:JSON.stringify({rules:[{rulePriority:1,description:'Keep the 30 newest images; the AMI and the deployment inputs pin digests',
     selection:{tagStatus:'any',countType:'imageCountMoreThan',countNumber:30},action:{type:'expire'}}]})},Tags:tags}},
  },
  Outputs:{BrowserHostRepositoryName:{Value:{Ref:'BrowserHostRepository'}},BrowserHostRepositoryArn:{Value:{'Fn::GetAtt':['BrowserHostRepository','Arn']}}},
 });
}
