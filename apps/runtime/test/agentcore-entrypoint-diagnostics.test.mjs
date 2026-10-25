import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let target,transportClosed=0,providerClosed=0;
const failure=Object.assign(Error('PRIVATE_ENTRYPOINT_CANARY'),{code:'EACCES'});
mock.module('../agentcore-control-client.mjs',{namedExports:{agentcoreEnvironment(){if(target==='config')throw failure;return {origin:'https://control.synthetic.invalid',region:'us-east-1'};},createAgentCoreControlTransport(){return {fetch:()=>assert.fail('no network'),close(){transportClosed++;}};}}});
mock.module('../sdk-provider-credentials.mjs',{namedExports:{createSdkProviderCredentials(){return {close(){providerClosed++;}};}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(){throw failure;}}});
const {main}=await import('../agentcore-entrypoint.mjs');
test('visibility: AgentCore entrypoint classifies startup before the listener while retaining exit and cleanup behavior',async t=>{
 const lines=[];t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 for(const phase of ['config','listen']){
  target=phase;assert.equal(await main([]),2);
  assert.match(lines.at(-2)??'',new RegExp(`^RUNTIME_STARTUP_FAILURE role=agentcore stage=agentcore-${phase} code=EACCES class=ERROR `));
  assert.equal(lines.at(-1),'AGENTCORE_RUNTIME_UNAVAILABLE\n');
 }
 assert.equal(lines.join('').includes('PRIVATE_ENTRYPOINT_CANARY'),false);assert.equal(transportClosed,1);assert.equal(providerClosed,1);
});
