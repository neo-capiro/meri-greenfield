/** Connected-app reads end to end (M12): real `meri_reads` MCP server -> worker transport -> control composer ->
 * gateway -> fixed Core HTTP source, over the recorded provider corpus. Only execution identity and Core are
 * synthetic; Core performs the recorded provider exchanges and returns the page bound to each. Proves actual
 * response content reaches the model, the current tenant/actor credential is bound on every call, grant
 * narrowing, mid-run revocation/expiry/denial refusals with precise secret-free text, and that no URL field
 * admits a custom server. No provider, model, SQL or AWS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {fixture,uuid} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connectedAppScene,CAPABILITY,PROVIDER_EXCHANGES,READ_OUTCOMES,LIST_OUTCOMES} from '../../../../gateway/general-reads/test/connected-apps-fixture.mjs';
import {canonicalInputSchema,isNarrowerOrEqual} from '../schema.mjs';
import {connect} from './native-mcp-fixture.mjs';
const SECRETS=['SYNTHETIC_NATIVE','SYNTHETIC_SERVICE','SYNTHETIC_EXECUTION','core.example.invalid','control.example.invalid','https://'];
const CLOSED=['UNAVAILABLE','ACCESS_DENIED','DEADLINE','CANCELLED','INVALID_ARGUMENTS'];
const text=r=>r.content[0].text;
const clean=r=>{for(const s of SECRETS)for(const part of r.content)assert.equal(part.text.includes(s),false,`model text leaks ${s}`);};
const closed=(r,name,codes)=>{assert.equal(r.isError,true,JSON.stringify(r));assert.equal(r.content.length,1);
 const code=text(r).split(':')[0];assert.ok(codes.includes(code),`${code} is not one of ${codes}`);
 assert.match(text(r),new RegExp(`^${code}: mcp__meri_reads__${name} `,'u'));assert.match(text(r),/No evidence, absence or completeness is established\.$/u);clean(r);};
async function mount(t,id,options={},fixtureOptions={}){const s=connectedAppScene(id,options),f=await fixture('connected-apps',id,{scene:s,...fixtureOptions}),m=await connect(t,f);assert.ok(m);return {s,f,m};}
const sourceCalls=(f,id)=>f.calls.filter(p=>p===`/api/clio/tools/${id}`).length;

test('tools/list advertises the canonical read schema: no endpoint, URL or credential field admits a custom server',async t=>{
 const {m}=await mount(t,'read_connected_app');
 const [tool,...rest]=(await m.client.listTools()).tools;assert.equal(rest.length,0);assert.equal(tool.name,'read_connected_app');
 const d=resolveOperationContract({id:'read_connected_app',version:'0.2.0'}).descriptor,advertised=tool.inputSchema.properties.arguments;
 assert.ok(isNarrowerOrEqual(advertised,canonicalInputSchema(d.inputSchema)));
 assert.deepEqual(Object.keys(advertised.properties).sort(),['arguments','clientId','connectionId','provider','schemaHash','tool']);
 assert.equal(advertised.additionalProperties,false);
 assert.match(tool.description,/No custom MCP servers, writes, credentials or model-supplied provider URLs/u);
 assert.equal(tool.annotations.readOnlyHint,true);
});

for(const outcome of LIST_OUTCOMES)test(`list_connected_app_reads: ${outcome.id} is the directory the model sees`,async t=>{
 const {s,f,m}=await mount(t,'list_connected_app_reads',{list:outcome});
 const r=await m.call();assert.equal(r.isError,undefined,JSON.stringify(r));clean(r);
 const value=JSON.parse(text(r)),page=value.result;
 assert.deepEqual(page,s.page);assert.deepEqual(value.binding,f.binding);assert.equal(value.subject.tenantId,f.binding.tenantId);assert.equal(value.subject.actorId,f.binding.actorId);
 assert.equal(page.status,outcome.status);assert.equal(page.capabilities.length>0,outcome.status==='ok','ok means at least one usable authenticated read, never inventory');
 const listed=PROVIDER_EXCHANGES.tools_list.response.result.tools;
 assert.ok(listed.some(tool=>tool.name==='post_message'),'the recorded provider also offers a write tool');
 assert.equal(page.capabilities.some(c=>c.tool==='post_message'),false,'write tools never reach the model');
 for(const c of page.capabilities)assert.deepEqual(c.inputSchema,listed.find(tool=>tool.name===c.tool).inputSchema,'the advertised schema is the recorded provider schema');
 if(outcome.notice){assert.equal(r.content.length,2);assert.match(r.content[1].text,outcome.notice);}else assert.equal(r.content.length,1);
 assert.equal(sourceCalls(f,'list_connected_app_reads'),1);assert.equal(m.runtime.receipts().length,1);
});

for(const outcome of READ_OUTCOMES)test(`read_connected_app: ${outcome.connection} connection -> ${outcome.status}${outcome.reason?` (${outcome.reason})`:''}`,async t=>{
 const {s,f,m}=await mount(t,'read_connected_app',{outcome});
 const r=await m.call(undefined,{toolUseId:'toolu_connected'});assert.equal(r.isError,undefined,JSON.stringify(r));clean(r);
 const value=JSON.parse(text(r)),page=value.result;
 assert.deepEqual(page,s.page);assert.equal(page.status,outcome.status);assert.equal(page.reason,outcome.reason);
 assert.deepEqual(page.providerResult,outcome.providerResult);
 if(outcome.exchange)assert.ok(['call_ok','call_denied','call_expired'].includes(outcome.exchange));
 if(outcome.status==='ok'){const recorded=PROVIDER_EXCHANGES[outcome.exchange].response.result;
  assert.deepEqual(page.providerResult,recorded,'the model receives exactly the recorded tools/call result');
  assert.equal(page.providerResult.content[0].text,'Quarterly plan');assert.equal(page.providerResult.structuredContent.next_cursor,'page-3');}
 if(outcome.status==='unavailable'&&outcome.reason==='provider_reported_error')assert.equal(page.providerResult.isError,true);
 if(['disconnected','permission_required'].includes(outcome.status)){assert.equal(page.content,null);assert.equal(page.providerResult,null);}
 if(outcome.notice){assert.equal(r.content.length,2);assert.match(r.content[1].text,outcome.notice);assert.match(r.content[1].text,/Do not retry/u);}else assert.equal(r.content.length,1);
 // Current tenant/actor/owner binding on every call: the run binding and subject are echoed, and the single Core
 // request carried this actor's native credential plus the service secret the runner never holds.
 assert.deepEqual(value.binding,f.binding);assert.equal(value.subject.tenantId,f.binding.tenantId);assert.equal(value.subject.actorId,f.binding.actorId);
 assert.equal(s.wire.length,1);assert.deepEqual(s.wire[0].body,s.arguments);
 assert.equal(s.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(s.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
 assert.equal(sourceCalls(f,'read_connected_app'),1);
 const [receipt,...rest]=m.runtime.receipts();assert.equal(rest.length,0);assert.equal(receipt.resultSha256,canonicalSha256(value));
 assert.equal(receipt.deliveryId,'sdk:'+canonicalSha256({binding:f.binding,sessionId:'71000000-0000-4000-8000-000000000091',toolUseId:'toolu_connected'}));
});

test('execution revoked after mount is refused by control as ACCESS_DENIED before any Core request, with secret-free text',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app');
 assert.equal((await m.call()).isError,undefined);
 f.revoke();
 closed(await m.call(),'read_connected_app',['ACCESS_DENIED']);
 assert.equal(sourceCalls(f,'read_connected_app'),1);assert.equal(s.wire.length,1);assert.equal(m.runtime.receipts().length,1);
});

test('an execution identity expired mid-run refuses without a Core request',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app',{},{advancingClock:true});
 assert.equal((await m.call()).isError,undefined);
 f.advanceClock(60000);
 closed(await m.call(),'read_connected_app',CLOSED);
 assert.equal(s.wire.length,1);assert.equal(m.runtime.receipts().length,1);
});

test('Core refusing the read (authority or connection changed, 403) is ACCESS_DENIED, never a page or a retry',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app');f.deny();
 closed(await m.call(),'read_connected_app',['ACCESS_DENIED']);
 assert.equal(sourceCalls(f,'read_connected_app'),1);assert.equal(s.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
});

test('execution revoked while Core answers withholds the page and the receipt',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app');s.state.afterSource=f.revoke;
 closed(await m.call(),'read_connected_app',['ACCESS_DENIED','UNAVAILABLE']);
 assert.equal(s.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);
});

for(const [label,args] of [
 ['an endpoint argument',{query:'x',endpoint:'https://other.invalid/mcp'}],
 ['a server URL argument',{query:'x',server_url:'https://other.invalid/mcp'}],
 ['a URL-valued argument',{query:'https://other.invalid'}],
 ['a credential argument',{query:'x',authorization:'Bearer x'}],
])test(`${label} is refused before any Core or provider request`,async t=>{
 const {s,f,m}=await mount(t,'read_connected_app');
 closed(await m.call({...s.arguments,arguments:args}),'read_connected_app',['INVALID_ARGUMENTS']);
 assert.equal(sourceCalls(f,'read_connected_app'),0);assert.equal(s.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
});

test('another connection, schema hash or selected client is refused by the fixed Core source, never substituted',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app');
 for(const changes of [{connectionId:uuid('e')},{schemaHash:'0'.repeat(64)},{clientId:uuid('f')}]){
  closed(await m.call({...s.arguments,...changes}),'read_connected_app',['ACCESS_DENIED','INVALID_RESULT','UNAVAILABLE']);}
 assert.deepEqual(m.runtime.receipts(),[]);
});

test('a selected skill that does not grant the read mounts nothing and calls Core for nothing',async t=>{
 const s=connectedAppScene('read_connected_app'),f=await fixture('connected-apps','read_connected_app',{scene:s});
 assert.equal(await connect(t,f,{skill:{allowedOperations:[{id:'list_connected_app_reads',version:'0.2.0'}],budgets:{maxToolCalls:1,maxOutputBytes:1048576}}}),null);
 assert.equal(sourceCalls(f,'read_connected_app'),0);assert.equal(s.wire.length,0);
});

test('a run bound to another actor mounts nothing against this execution identity',async t=>{
 const s=connectedAppScene('read_connected_app'),f=await fixture('connected-apps','read_connected_app',{scene:s});
 assert.equal(await connect(t,{...f,binding:{...f.binding,actorId:uuid('e')}}),null);
 assert.equal(s.wire.length,0);
});

test('the explicit call limit closes the server after one connected read',async t=>{
 const {s,f,m}=await mount(t,'read_connected_app',{},{});
 const limited=await connect(t,f,{skill:{allowedOperations:[f.operation],budgets:{maxToolCalls:1,maxOutputBytes:1048576}}});assert.ok(limited);
 assert.equal((await limited.call()).isError,undefined);assert.match((await limited.call()).denied,/RESOURCE_LIMIT/u);
 assert.equal(s.wire.length,1);assert.equal(limited.runtime.receipts().length,1);assert.deepEqual(m.runtime.receipts(),[]);
 assert.equal(CAPABILITY.connectionId,s.arguments.connectionId);
});
