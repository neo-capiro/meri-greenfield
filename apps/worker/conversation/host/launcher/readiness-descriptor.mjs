// @ts-check
/** Reviewed image pin for the SDK's no-model readiness CLI. The SDK chooses temporary workspace/config names;
 * only those two paths are normalized before comparison with the measured argv template digest. */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {READINESS_MODEL_ENV,SDK_VERSION,CLI_VERSION} from '../../sandbox-readiness/readiness.mjs';

const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('HOST_READINESS_DESCRIPTOR_REFUSED'),{code:'HOST_READINESS_DESCRIPTOR_REFUSED'});};
const absolute=value=>typeof value==='string'&&posix.isAbsolute(value)&&posix.resolve(value)===value&&!value.includes('\0');
const TEMP=/^\/tmp\/meri-sandbox-readiness-([A-Za-z0-9]{6})\/(workspace|config)-[A-Za-z0-9]{6}$/u;
/** The image owner supplies actual measured binary SHA-256 and normalized argv SHA-256 for SDK 0.3.295 / CLI
 * 2.1.295. No descriptor or tool request may supply those pins. In production inspectExecutable reads the root-owned
 * executable; injection exists only for a focused synthetic test. */
export function createPinnedReadinessDescriptorValidator({command,executableSha256,argvTemplateSha256,
 sdkVersion,cliVersion,inspectExecutable=path=>{
  const st=statSync(path);return {uid:st.uid,mode:st.mode,isFile:st.isFile(),
   sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
 }}={}){
 if(!absolute(command)||!HEX.test(executableSha256)||!HEX.test(argvTemplateSha256)||
  sdkVersion!==SDK_VERSION||cliVersion!==CLI_VERSION||typeof inspectExecutable!=='function')fail();
 const binary=inspectExecutable(command);
 if(binary?.isFile!==true||binary.uid!==0||binary.mode&0o022||binary.sha256!==executableSha256)fail();
 return function validateReadinessDescriptor(input){
  let d;try{d=data(own(input,['command','args','cwd','env']));}catch{fail();}
  if(d.command!==command||!Array.isArray(d.args)||d.args.length>128||
   d.args.some(arg=>typeof arg!=='string'||arg.length>8192||arg.includes('\0'))||!absolute(d.cwd)||
   !d.env||typeof d.env!=='object'||Array.isArray(d.env))fail();
  const workspace=TEMP.exec(d.cwd),config=TEMP.exec(d.env.CLAUDE_CONFIG_DIR);
  if(!workspace||workspace[2]!=='workspace'||!config||config[2]!=='config'||workspace[1]!==config[1]||
   d.env.HOME!==d.env.CLAUDE_CONFIG_DIR||d.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB!=='1'||
   d.env.ANTHROPIC_BASE_URL!==READINESS_MODEL_ENV.ANTHROPIC_BASE_URL||
   d.env.ANTHROPIC_AUTH_TOKEN!==READINESS_MODEL_ENV.ANTHROPIC_AUTH_TOKEN||
   d.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC!=='1')fail();
  const normalized=d.args.map(arg=>arg.split(d.cwd).join('[READINESS_WORKSPACE]')
   .split(d.env.CLAUDE_CONFIG_DIR).join('[READINESS_CONFIG]'));
  if(canonicalSha256(normalized)!==argvTemplateSha256)fail();
  return Object.freeze(d);
 };
}
