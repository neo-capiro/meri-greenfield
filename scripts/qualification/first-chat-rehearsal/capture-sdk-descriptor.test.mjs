/** Receipt helpers only; the capture itself needs the pinned SDK and is exercised by the committed receipts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {redactEnvironment,gateOutcomes} from './capture-sdk-descriptor.mjs';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileNativeLaunch} from '../../../apps/runtime/native-authority/launch-configuration.mjs';
import {binding,versions} from '../../../apps/control/conversations/test/store-fixture.mjs';
const v={...versions,sdk:'0.3.295',cli:'2.1.295'},workspace='/tmp/meri-capture-test/'+binding.conversationId,executableSha256='a'.repeat(64);
test('secret env values are hashed, undefined values are marked, ordinary values pass through',()=>{
 const r=redactEnvironment({ANTHROPIC_AUTH_TOKEN:'s',ANTHROPIC_API_KEY:undefined,CLAUDE_CODE_ENTRYPOINT:'sdk-ts'});
 assert.equal(r.ANTHROPIC_AUTH_TOKEN.redacted,true);assert.match(r.ANTHROPIC_AUTH_TOKEN.sha256,/^[a-f0-9]{64}$/u);assert.deepEqual(r.ANTHROPIC_API_KEY,{absentValue:'undefined'});assert.equal(r.CLAUDE_CODE_ENTRYPOINT,'sdk-ts');
});
test('a descriptor with undefined env values fails the inert-JSON gate; a string-only descriptor passes it and compiles once directories are injected',()=>{
 const base={command:'/opt/claude',args:['--output-format','stream-json'],cwd:workspace};
 const bad=gateOutcomes({descriptor:{...base,env:{ANTHROPIC_BASE_URL:'https://p.invalid/',ANTHROPIC_API_KEY:undefined}},data,compileNativeLaunch,binding,versions:v,workspace,executableSha256});
 assert.match(bad.inertJsonDescriptor,/^FAIL/u);assert.match(bad.hasClaudeConfigDir,/^FAIL/u);assert.match(bad.compileNativeLaunchWithInjectedDirectories,/^FAIL/u);
 const good=gateOutcomes({descriptor:{...base,env:{ANTHROPIC_BASE_URL:'https://p.invalid/',ANTHROPIC_AUTH_TOKEN:'t',CLAUDE_CODE_ENTRYPOINT:'sdk-ts'}},data,compileNativeLaunch,binding,versions:v,workspace,executableSha256});
 assert.equal(good.inertJsonDescriptor,'PASS');assert.match(good.hasClaudeConfigDir,/^FAIL/u);assert.match(good.secretInsideDescriptorEnv,/^OBSERVED/u);assert.equal(good.compileNativeLaunchWithInjectedDirectories,'PASS');
});
