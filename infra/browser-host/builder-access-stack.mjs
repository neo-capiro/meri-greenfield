// @ts-check
/** Static CloudFormation source that lets the existing ARM-capable image build project push and scan the browser-only host
 * image. The build project `meri-greenfield-qualification-build` already builds and pushes the product runtime image with the
 * role `BuilderRole` (infra/qualification/app.mjs), whose policy names exactly one repository. This adds ONE inline policy
 * to that role, for the browser host repository only (push, pull for layer reuse, describe, scan findings), and nothing else:
 * no new role, no wider ECR action, no other service. The role itself and its default policy stay owned by their stack.
 * No AWS client, secret or deploy action lives here. */
import {HOST_ACCOUNT,HOST_REGION} from './binding.mjs';
import {BROWSER_HOST_REPOSITORY} from './registry-stack.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='BROWSER_HOST_BUILDER_ACCESS_REFUSED';
const ROLE=/^MeriGreenfield-QualificationBui-BuilderRole[A-Za-z0-9]{8}-[A-Za-z0-9]{12}$/u;
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};

/** @param {unknown} raw */
export function validateBuilderAccessInput(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail(REFUSED);
 const v=/** @type {Record<string,unknown>} */(raw);
 if(Object.keys(v).join(',')!=='builderRoleName'||typeof v.builderRoleName!=='string'||!ROLE.test(v.builderRoleName))fail(REFUSED);
 return Object.freeze({builderRoleName:v.builderRoleName});
}

/** @param {unknown} input */
export function compileBuilderAccessTemplate(input){
 const b=validateBuilderAccessInput(input);
 const repository=`arn:aws:ecr:${HOST_REGION}:${HOST_ACCOUNT}:repository/${BROWSER_HOST_REPOSITORY}`;
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri browser host image build access: push and scan rights on the browser host repository for the existing image build role.',
  Resources:{BrowserHostImagePush:{Type:'AWS::IAM::Policy',Properties:{PolicyName:'BrowserHostImagePush',Roles:[b.builderRoleName],
   PolicyDocument:{Version:'2012-10-17',Statement:[
    {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:GetDownloadUrlForLayer','ecr:BatchGetImage','ecr:InitiateLayerUpload','ecr:UploadLayerPart',
     'ecr:CompleteLayerUpload','ecr:PutImage'],Resource:repository},
    {Effect:'Allow',Action:['ecr:DescribeImages','ecr:DescribeRepositories','ecr:DescribeImageScanFindings'],Resource:repository}]}}}},
 });
}
