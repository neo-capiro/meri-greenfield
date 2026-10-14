/** Closed original-task transport facts. These facts never grant task authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
export const remoteFault=()=>Object.assign(Error('REMOTE_TASK_REFUSED'),{code:'REMOTE_TASK_REFUSED'});
const refuse=()=>{throw remoteFault();};
export function remoteOriginal(value){const v=data(own(value,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']));validateShape('RunBinding',v.binding);validateShape('RuntimeVersions',v.versions);
 if(v.executionKey!==hash(v.binding)||v.executionId!==v.executionKey||!digest(v.planSha256)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<1)refuse();return v;}
export const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
export function descriptor(value){const v=data(own(value,['command','args','cwd','env']));if(typeof v.command!=='string'||typeof v.cwd!=='string'||v.command.includes('\0')||v.cwd.includes('\0')||!Array.isArray(v.args)||v.args.length>256||v.args.some(x=>typeof x!=='string'||x.includes('\0'))||!v.env||Array.isArray(v.env)||typeof v.env!=='object'||Object.entries(v.env).some(([k,x])=>! /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(k)||typeof x!=='string'||x.includes('\0'))||Buffer.byteLength(JSON.stringify(v))>131072)refuse();return v;}
export function exactOriginal(value,original){const v=remoteOriginal(value);if(hash(v)!==hash(original))refuse();return v;}
export function preparationAck(value,{original,descriptorSha256,configTreeSha256,taskArn,now,previous}){
 const v=data(own(value,['original','descriptorSha256','configTreeSha256','preparationId','taskArn','checkedAtMs','expiresAtMs']));exactOriginal(v.original,original);
 if(v.descriptorSha256!==descriptorSha256||v.configTreeSha256!==configTreeSha256||v.taskArn!==taskArn||!/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u.test(v.taskArn)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v.preparationId)||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<0||v.checkedAtMs>now()||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=now()||v.expiresAtMs>original.expiresAtMs)refuse();
 if(previous&&(v.preparationId!==previous.preparationId||v.checkedAtMs<previous.checkedAtMs||v.expiresAtMs>previous.expiresAtMs))refuse();return v;
}
export function transportLimits(value={}){const v=own(value,[],['maxFrameBytes','maxBufferedBytes','maxRequestMs']);const limits={maxFrameBytes:65536,maxBufferedBytes:1048576,maxRequestMs:8000,...v};
 if(!Number.isSafeInteger(limits.maxFrameBytes)||limits.maxFrameBytes<1||limits.maxFrameBytes>65536||!Number.isSafeInteger(limits.maxBufferedBytes)||limits.maxBufferedBytes<limits.maxFrameBytes||limits.maxBufferedBytes>9437184||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000)refuse();return data(limits);}
export function decodeBytes(value,max){const v=own(value,['bytes','sha256','base64']);if(!Number.isSafeInteger(v.bytes)||v.bytes<0||v.bytes>max||!digest(v.sha256)||typeof v.base64!=='string'||v.base64.length!==Math.ceil(v.bytes/3)*4)refuse();const bytes=Buffer.from(v.base64,'base64');if(bytes.length!==v.bytes||bytes.toString('base64')!==v.base64)refuse();return bytes;}
