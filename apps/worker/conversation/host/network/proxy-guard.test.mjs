import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA} from '../binding.mjs';
import {createBrowserProxyGuard,assertBrowserProxyGuardReadback,installBrowserProxyGuard,BROWSER_PROXY_GUARD_SCHEMA} from './proxy-guard.mjs';
import {PROXY_DENIED_IPV4} from './public-egress.mjs';

const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostMode:'browser-only',
 hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+60000};
const input={allocation,binding,eniName:'ens5',proxyUid:3003};
/** The kernel echoes the table with handles and metainfo, which the readback ignores. */
const kernelView=(guard,mutate=x=>x)=>JSON.stringify({nftables:[{metainfo:{version:'1.0.9',json_schema_version:1}},...mutate(guard.expected.map((x,i)=>{const type=Object.keys(x)[0];return {[type]:{...x[type],handle:i+1}};}))]});
const status=uid=>`Name:\tnode\nUid:\t${uid}\t${uid}\t${uid}\t${uid}\nGid:\t${uid}\t${uid}\t${uid}\t${uid}\n`;

test('the guard is keyed on the proxy uid alone: loopback replies, public 80/443 on the ENI, every denied range dropped, everything else from that uid dropped',()=>{
 const guard=createBrowserProxyGuard(input);
 assert.equal(guard.schema,BROWSER_PROXY_GUARD_SCHEMA);assert.match(guard.tableName,/^mp[0-9a-f]{12}$/u);
 assert.equal(guard.cgroupPath,`/meri/hosts/${allocation.hostId}-1/${canonicalSha256(binding)}/browser-proxy`);
 const rules=guard.expected.filter(x=>x.rule).map(x=>x.rule.expr);
 assert.equal(rules.length,1+PROXY_DENIED_IPV4.length+2+1);
 for(const expr of rules)assert.ok(expr.some(m=>m.match?.left?.meta?.key==='skuid'&&m.match.right===3003),'every rule is scoped to the proxy uid');
 assert.deepEqual(rules.at(-1),[{match:{op:'==',left:{meta:{key:'skuid'}},right:3003}},{drop:null}]);
 const drops=rules.filter(expr=>expr.at(-1).drop===null&&expr.some(m=>m.match?.right?.prefix));
 assert.deepEqual(drops.map(expr=>expr.find(m=>m.match?.right?.prefix).match.right.prefix.addr),PROXY_DENIED_IPV4.map(([addr])=>addr));
 assert.ok(drops.some(expr=>expr.find(m=>m.match?.right?.prefix).match.right.prefix.addr==='169.254.0.0'),'metadata is dropped');
 assert.equal(guard.commands.nftables[0].create.table.name,guard.tableName);
 assert.equal(JSON.stringify(guard).includes('"dport":53'),false,'the proxy process resolves nothing itself');
 const {hostMode,...legacy}=allocation;
 assert.throws(()=>createBrowserProxyGuard({...input,allocation:legacy}),{code:'HOST_PROXY_GUARD_CONFIGURATION'});
 assert.throws(()=>createBrowserProxyGuard({...input,eniName:'lo'}),{code:'HOST_PROXY_GUARD_CONFIGURATION'});
 assert.throws(()=>createBrowserProxyGuard({...input,proxyUid:0}),{code:'HOST_PROXY_GUARD_CONFIGURATION'});
});
test('readback pins the exact table, the proxy uid and the proxy leaf; a widened rule, foreign uid or wrong leaf refuses',()=>{
 const guard=createBrowserProxyGuard(input);
 const ok=assertBrowserProxyGuardReadback({guard,pid:4242,processUid:3003,processCgroup:guard.cgroupPath,nftOutput:kernelView(guard)});
 assert.equal(ok.verified,true);assert.equal(ok.firewallTable,guard.tableName);
 assert.throws(()=>assertBrowserProxyGuardReadback({guard,pid:4242,processUid:3003,processCgroup:guard.cgroupPath,nftOutput:kernelView(guard,items=>items.slice(0,-1))}),{code:'HOST_PROXY_GUARD_UNKNOWN'});
 assert.throws(()=>assertBrowserProxyGuardReadback({guard,pid:4242,processUid:0,processCgroup:guard.cgroupPath,nftOutput:kernelView(guard)}),{code:'HOST_PROXY_GUARD_UNKNOWN'});
 assert.throws(()=>assertBrowserProxyGuardReadback({guard,pid:4242,processUid:3003,processCgroup:`${guard.cgroupPath}/x`,nftOutput:kernelView(guard)}),{code:'HOST_PROXY_GUARD_UNKNOWN'});
});
test('install writes the table through nft, reads it back with the live process facts, and removes it on close or on a failed readback',async()=>{
 const guard=createBrowserProxyGuard(input);const calls=[];
 const execute=async({file,args,input:body})=>{calls.push([file,args.join(' '),body?JSON.parse(body).nftables.length:undefined]);
  if(args[1]==='list')return {stdout:kernelView(guard)};return {stdout:''};};
 const readFile=path=>path.endsWith('/status')?status(3003):`0::${guard.cgroupPath}\n`;
 const installed=await installBrowserProxyGuard({...input,pid:4242,execute,readFile});
 assert.equal(installed.readback.verified,true);
 assert.deepEqual(calls.map(c=>c[1]),['-j -f -',`-j list table inet ${guard.tableName}`]);assert.equal(calls[0][2],guard.commands.nftables.length);
 assert.deepEqual(await installed.close(),{closed:true});assert.deepEqual(await installed.close(),{closed:true});
 assert.equal(calls.at(-1)[1],`delete table inet ${guard.tableName}`);assert.equal(calls.length,3);
 const foreign=[];
 await assert.rejects(installBrowserProxyGuard({...input,pid:4242,execute:async({args,input:body})=>{foreign.push(args.join(' '));if(args[1]==='list')return {stdout:kernelView(guard)};return {stdout:''};},
  readFile:path=>path.endsWith('/status')?status(2002):`0::${guard.cgroupPath}\n`}),{code:'HOST_PROXY_GUARD_UNKNOWN'});
 assert.equal(foreign.at(-1),`delete table inet ${guard.tableName}`,'a refused readback leaves no table behind');
 await assert.rejects(installBrowserProxyGuard({...input,pid:4242,execute:async()=>{throw Object.assign(Error('nft'),{code:'HOST_NETWORK_COMMAND_FAILED'});},readFile}),{code:'HOST_PROXY_GUARD_UNKNOWN'});
});
