import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createPinnedReadinessDescriptorValidator} from './readiness-descriptor.mjs';
import {READINESS_MODEL_ENV,SDK_VERSION,CLI_VERSION} from '../../sandbox-readiness/readiness.mjs';

const binary='a'.repeat(64),command='/opt/meri/bin/node';
const workspace='/tmp/meri-sandbox-readiness-Ab12Cd/workspace-Zy98Xw';
const config='/tmp/meri-sandbox-readiness-Ab12Cd/config-Aa11Bb';
const normalized=['/opt/meri/cli.js','--cwd','[READINESS_WORKSPACE]',
 '--settings',JSON.stringify({config:'[READINESS_CONFIG]',workspace:'[READINESS_WORKSPACE]'})];
const args=normalized.map(a=>a.replaceAll('[READINESS_WORKSPACE]',workspace).replaceAll('[READINESS_CONFIG]',config));
const descriptor={command,args,cwd:workspace,env:{...READINESS_MODEL_ENV,CLAUDE_CODE_SUBPROCESS_ENV_SCRUB:'1',
 CLAUDE_CONFIG_DIR:config,HOME:config,PATH:'/usr/bin:/bin'}};
const create=()=>createPinnedReadinessDescriptorValidator({command,executableSha256:binary,
 argvTemplateSha256:canonicalSha256(normalized),sdkVersion:SDK_VERSION,cliVersion:CLI_VERSION,
 inspectExecutable:()=>({uid:0,mode:0o100755,isFile:true,sha256:binary})});
test('reviewed readiness binary and normalized CLI argv admit only same no-model descriptor',()=>{
 const validate=create();assert.deepEqual(validate(descriptor),descriptor);
 for(const altered of [
  {...descriptor,command:'/bin/sh'},
  {...descriptor,args:[...args,'--dangerously-skip-permissions']},
  {...descriptor,cwd:'/tmp/other'},
  {...descriptor,env:{...descriptor.env,HOME:'/tmp/other'}},
  {...descriptor,env:{...descriptor.env,ANTHROPIC_BASE_URL:'https://model.example/'}}
 ])assert.throws(()=>validate(altered),/HOST_READINESS_DESCRIPTOR_REFUSED/);
 assert.throws(()=>createPinnedReadinessDescriptorValidator({command,executableSha256:binary,
  argvTemplateSha256:canonicalSha256(normalized),sdkVersion:SDK_VERSION,cliVersion:CLI_VERSION,
  inspectExecutable:()=>({uid:1000,mode:0o100755,isFile:true,sha256:binary})}),/HOST_READINESS_DESCRIPTOR_REFUSED/);
});
