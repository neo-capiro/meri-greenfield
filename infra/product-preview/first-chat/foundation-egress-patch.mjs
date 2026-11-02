// @ts-check
/** Derives the ONE change a live foundation stack needs for Control to reach the provisioned browser hosts, without deploying the
 * foundation from source. The committed foundation source and the live `meri-first-chat-foundation` stack have drifted in both
 * directions (live still carries the issuer resources the source removed, and the source is ahead elsewhere), so a change set made
 * from freshly synthesized source would not be this egress rule alone. Instead the rule is taken from the SOURCE synthesis (the
 * difference between synthesizing the committed binding with and without `browserHostSecurityGroupId`, which must be exactly one
 * standalone egress resource) and added to the LIVE template read back from CloudFormation. The change set of the patched live
 * template must then show exactly one Add and nothing else. No AWS client, secret or deploy action lives here. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {synthesizeFirstChatFoundation} from '../first-chat-foundation.mjs';
import {BROWSER_HOST_LISTENER_PORT} from '../../browser-host/provisioned-stack.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='FOUNDATION_EGRESS_PATCH_REFUSED';
export const INLINE_TEMPLATE_LIMIT=51200;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha256=text=>createHash('sha256').update(text).digest('hex');

/** The single resource the source adds for the browser host group. @param {any} binding */
export function sourceEgressResource(binding){
 if(typeof binding?.browserHostSecurityGroupId!=='string')fail(REFUSED);
 const {browserHostSecurityGroupId,...without}=binding;
 const withRule=synthesizeFirstChatFoundation(binding),base=synthesizeFirstChatFoundation(without);
 for(const [id,resource] of Object.entries(base.Resources))if(!same(withRule.Resources[id],resource))fail(REFUSED);
 for(const section of ['Outputs','Parameters','Conditions','Metadata','Description','Rules','Mappings'])if(!same(withRule[section],base[section]))fail(REFUSED);
 const added=Object.entries(withRule.Resources).filter(([id])=>!(id in base.Resources));
 if(added.length!==1)fail(REFUSED);
 const [logicalId,resource]=added[0];
 const p=resource.Properties;
 if(resource.Type!=='AWS::EC2::SecurityGroupEgress'||p.IpProtocol!=='tcp'||p.FromPort!==BROWSER_HOST_LISTENER_PORT||p.ToPort!==BROWSER_HOST_LISTENER_PORT||
  p.DestinationSecurityGroupId!==browserHostSecurityGroupId||Object.keys(p).sort().join(',')!=='Description,DestinationSecurityGroupId,FromPort,GroupId,IpProtocol,ToPort')fail(REFUSED);
 const owner=base.Resources[p.GroupId?.['Fn::GetAtt']?.[0]];
 if(owner?.Type!=='AWS::EC2::SecurityGroup'||owner.Properties.GroupName!=='meri-preview-control'||p.GroupId['Fn::GetAtt'][1]!=='GroupId')fail(REFUSED);
 return Object.freeze({logicalId,resource:structuredClone(resource),ownerLogicalId:p.GroupId['Fn::GetAtt'][0]});
}

/** @param {any} live the template `get-template --template-stage Original` returned @param {any} binding the committed foundation binding */
export function patchLiveFoundation(live,binding){
 const rule=sourceEgressResource(binding);
 // Only a plain JSON template is patched: parameters, a transform or dynamic references would make CloudFormation re-resolve
 // values on update, so the change set could carry more than the one added rule.
 if(!live||typeof live!=='object'||['Parameters','Transform','Rules','Conditions'].some(k=>k in live)||JSON.stringify(live).includes('{{resolve:'))fail(REFUSED);
 const owner=live.Resources?.[rule.ownerLogicalId];
 if(owner?.Type!=='AWS::EC2::SecurityGroup'||owner.Properties?.GroupName!=='meri-preview-control')fail(REFUSED);
 if(rule.logicalId in live.Resources)fail(REFUSED);
 for(const resource of Object.values(live.Resources))
  if(resource.Type==='AWS::EC2::SecurityGroupEgress'&&resource.Properties?.DestinationSecurityGroupId===rule.resource.Properties.DestinationSecurityGroupId&&
   same(resource.Properties.GroupId,rule.resource.Properties.GroupId))fail(REFUSED);
 const patched=structuredClone(live);
 patched.Resources[rule.logicalId]=rule.resource;
 return Object.freeze({template:patched,logicalId:rule.logicalId,diff:diffTemplates(live,patched)});
}

/** Resource-level and section-level difference; the patched template must differ from live by exactly one added resource. */
export function diffTemplates(a,b){
 const ids=new Set([...Object.keys(a.Resources),...Object.keys(b.Resources)]);
 const added=[],removed=[],modified=[];
 for(const id of ids){if(!(id in a.Resources))added.push(id);else if(!(id in b.Resources))removed.push(id);else if(!same(a.Resources[id],b.Resources[id]))modified.push(id);}
 const sections=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>k!=='Resources'&&!same(a[k],b[k]));
 return Object.freeze({added:added.sort(),removed,modified,sectionsChanged:sections});
}

/** @param {{added:string[],removed:string[],modified:string[],sectionsChanged:string[]}} diff */
export function assertOnlyOneAddition(diff){
 if(diff.added.length!==1||diff.removed.length||diff.modified.length||diff.sectionsChanged.length)fail(REFUSED);
}

/** @param {string[]} argv */
export function main(argv){
 const arg=name=>{const at=argv.indexOf(name);return at<0?undefined:argv[at+1];};
 const liveFile=arg('--live'),bindingFile=arg('--binding'),out=arg('--out');
 if(!liveFile||!bindingFile||!out)fail(REFUSED);
 const liveText=readFileSync(liveFile,'utf8'),live=JSON.parse(liveText);
 const result=patchLiveFoundation(live,JSON.parse(readFileSync(bindingFile,'utf8')));
 assertOnlyOneAddition(result.diff);
 const text=JSON.stringify(result.template);
 writeFileSync(out,text,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({logicalId:result.logicalId,liveSha256:sha256(JSON.stringify(live)),patchedSha256:sha256(text),patchedBytes:Buffer.byteLength(text),
  inlineTemplateAllowed:Buffer.byteLength(text)<INLINE_TEMPLATE_LIMIT,diff:result.diff})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main(process.argv.slice(2));}catch(error){process.stderr.write(`${error?.code??REFUSED}\n`);process.exitCode=1;}
}
