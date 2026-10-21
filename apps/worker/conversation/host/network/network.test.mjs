import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,connect} from 'node:net';
import {once} from 'node:events';
import {HOST_ALLOCATION_SCHEMA} from '../binding.mjs';
import {createNetworkPlan,isPrivateServiceAddress} from './plan.mjs';
import {buildNetworkFirewalls,buildHostRelayDenyFirewall,assertNetworkFirewallReadback} from './firewall.mjs';
import {startPinnedRelay} from './relay.mjs';
import {createNativeLocalRelayPort} from './launcher-adapter.mjs';
import {createProxyWebGuard,assertProxyWebGuardReadback} from './public-egress.mjs';
import {assertNetworkTopologyReadback,assertLocalRelayListenerReadback,assertHostRelayListenerReadback,assertPrivateTargetRouteReadback,prepareNetworkCompartment} from './confinement.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:'tenant-a',conversationId:uuid(1),generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1792425600000};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),workerId:uuid(5),writerFence:1};
const browser=[{name:'browser-http',localPort:41001,targetPort:41001}];
const sdk=[{name:'model-proxy',localPort:42001,targetAddress:'10.0.1.4',targetPort:443},{name:'control',localPort:42002,targetAddress:'172.16.2.5',targetPort:443}];
const plan=()=>createNetworkPlan({allocation,binding,kind:'browser',routes:browser});
const fault=code=>error=>error?.code===code;
const hostRelayUid=24011,hostRelayGid=24011;
const hostNamespace={namespaceDev:'5',namespaceIno:'55'};
const relayProcess=(plan,ports,pid=321)=>({pid,uid:hostRelayUid,gid:hostRelayGid,cgroupPath:plan.hostRelayCgroupPath,
 routes:plan.routes.map((r,i)=>({name:r.name,port:ports[i]})),verify(){return {verified:true};},
 revoke(){return {revoked:true};},async close(){return {closed:true};}});
const relayIdentity=(pid,plan)=>({pid,uid:hostRelayUid,gid:hostRelayGid,cgroupPath:plan.hostRelayCgroupPath,
 startTime:String(pid),...hostNamespace});
const hostListeners=(plan,relay)=>relay.routes.map(r=>`LISTEN 0 511 ${plan.hostAddress}:${r.port} 0.0.0.0:* users:(("node",pid=${relay.pid},fd=18))`).join('\n');
const nftOutput=items=>JSON.stringify({nftables:[{metainfo:{version:'1.0',json_schema_version:1}},...items]});
const topology=p=>({
 namespaceLinks:JSON.stringify([{ifname:'lo',flags:['UP']},{ifname:p.toolVethName,flags:['UP'],linkinfo:{info_kind:'veth'}}]),
 namespaceAddresses:JSON.stringify([{ifname:p.toolVethName,addr_info:[{family:'inet',local:p.toolAddress,prefixlen:30}]}]),
 namespaceRoutes:JSON.stringify([{dst:p.subnet,dev:p.toolVethName,scope:'link'}]),namespaceV6Routes:'[]',
 hostLinks:JSON.stringify([{ifname:p.hostVethName,flags:['UP'],linkinfo:{info_kind:'veth'}}]),
 hostAddresses:JSON.stringify([{ifname:p.hostVethName,addr_info:[{family:'inet',local:p.hostAddress,prefixlen:30}]}]),
 hostRoutes:JSON.stringify([{dst:p.subnet,dev:p.hostVethName}]),
 hostAllAddresses:JSON.stringify([{ifname:p.hostVethName,addr_info:[{family:'inet',local:p.hostAddress,prefixlen:30}]}]),
 hostAllRoutes:JSON.stringify([{dst:p.subnet,dev:p.hostVethName},{dst:'default',dev:'eth0'}]),
});
test('exact run and kind derive distinct namespaces; SDK only accepts pinned private model/control and paired Bash ports',()=>{
 const p=plan(),other=createNetworkPlan({allocation,binding:{...binding,writerFence:2},kind:'browser',routes:browser});
 assert.notEqual(p.namespacePath,other.namespacePath);assert.notEqual(p.hostVethName,other.hostVethName);
 assert.equal(p.routes[0].targetAddress,'127.0.0.1');
 assert.equal(isPrivateServiceAddress('10.0.1.4'),true);
 for(const ip of ['127.0.0.1','169.254.169.254','8.8.8.8','224.0.0.1','10.00.0.1'])assert.equal(isPrivateServiceAddress(ip),false);
 const s=createNetworkPlan({allocation,binding,kind:'sdk',routes:[...sdk,{name:'bash-http',localPort:41002,targetPort:41002},{name:'bash-socks',localPort:41003,targetPort:41003}]});
 assert.deepEqual(s.routes.map(r=>r.name),['model-proxy','control','bash-http','bash-socks']);
 for(const routes of [[...sdk,{name:'bash-http',localPort:41002,targetPort:41002}],
  sdk.map((r,i)=>i?{...r,targetAddress:'169.254.169.254'}:r),
  [{...browser[0],targetAddress:'10.0.0.1'}],
  [{...browser[0],localPort:80}]]){
  const kind=routes[0]?.name==='browser-http'?'browser':'sdk';
  assert.throws(()=>createNetworkPlan({allocation,binding,kind,routes}),fault('HOST_NETWORK_CONFIGURATION'));
 }
 });
test('firewall has exact host-veth accept then drop and tool default-drop chains; readback fails on extra allow',()=>{
 const p=plan(),deny=buildHostRelayDenyFirewall(p,hostRelayUid),f=buildNetworkFirewalls(p,[44000],{relayUid:hostRelayUid});
 assert.equal(deny.expectedHost.at(-1).rule.expr.at(-1).drop,null);
 assert.equal(f.expectedHost.at(-1).rule.expr.at(-1).drop,null);
 assert.equal(f.expectedHost.at(-1).rule.expr[0].match.right,hostRelayUid);
 const input=f.expectedHost.filter(x=>x.rule?.chain==='input').map(x=>x.rule.expr);
 assert.equal(input.length,3);
 assert.equal(input[0].at(-1).accept,null);
 assert.equal(input[1][0].match.left.payload.field,'daddr');
 assert.equal(input[1][0].match.right,p.hostAddress);
 assert.equal(input[1].at(-1).drop,null);
 assert.equal(f.expectedTool.filter(x=>x.chain).every(x=>x.chain.policy==='drop'),true);
 assert.equal(f.expectedTool.filter(x=>x.rule).length,6);
 assert.equal(assertNetworkFirewallReadback(nftOutput(f.expectedHost),f.expectedHost).verified,true);
 const widened=structuredClone(f.expectedTool);widened.splice(4,0,{rule:{family:'inet',table:p.toolTable,chain:'output',expr:[{accept:null}]}});
 assert.throws(()=>assertNetworkFirewallReadback(nftOutput(widened),f.expectedTool),fault('HOST_NETWORK_FIREWALL_UNKNOWN'));
 const noDrop=structuredClone(f.expectedTool);noDrop.find(x=>x.chain?.name==='output').chain.policy='accept';
 assert.throws(()=>assertNetworkFirewallReadback(nftOutput(noDrop),f.expectedTool),fault('HOST_NETWORK_FIREWALL_UNKNOWN'));
 const sdkPlan=createNetworkPlan({allocation,binding,kind:'sdk',routes:sdk});
 const sdkFirewall=buildNetworkFirewalls(sdkPlan,[44001,44002],{relayUid:hostRelayUid,privateInterfaceName:'eth0'});
 assert.equal(sdkFirewall.expectedHost.filter(x=>x.rule?.chain==='output'&&x.rule.expr.at(-1).accept===null).length,4);
 assert.throws(()=>buildNetworkFirewalls(sdkPlan,[44001,44002],{relayUid:hostRelayUid}),fault('HOST_NETWORK_FIREWALL_UNKNOWN'));
});

test('topology readback refuses direct/default route, extra namespace interface and IPv6 route',()=>{
 const p=plan(),good=topology(p);assert.equal(assertNetworkTopologyReadback({plan:p,...good}).verified,true);
 for(const bad of [
  {...good,namespaceRoutes:JSON.stringify([{dst:p.subnet,dev:p.toolVethName},{dst:'default',gateway:p.hostAddress,dev:p.toolVethName}])},
  {...good,namespaceLinks:JSON.stringify([{ifname:'lo',flags:['UP']},{ifname:p.toolVethName,flags:['UP'],linkinfo:{info_kind:'veth'}},{ifname:'eth0'}])},
  {...good,namespaceV6Routes:JSON.stringify([{dst:'default',dev:p.toolVethName}])},
  {...good,hostAllRoutes:JSON.stringify([{dst:p.subnet,dev:p.hostVethName},{dst:p.subnet,dev:'other0'}])},
  {...good,hostAllAddresses:JSON.stringify([{ifname:p.hostVethName,addr_info:[{family:'inet',local:p.hostAddress,prefixlen:30}]},{ifname:'other0',addr_info:[{family:'inet',local:p.hostAddress,prefixlen:30}]}])},
 ])assert.throws(()=>assertNetworkTopologyReadback({plan:p,...bad}),fault('HOST_NETWORK_TOPOLOGY_UNKNOWN'));
});

test('local listener readback requires exact loopback port and native helper PID',()=>{
 const local=[{name:'browser-http',localPort:41001}];
 const line='LISTEN 0 511 127.0.0.1:41001 0.0.0.0:* users:(("node",pid=321,fd=18))';
 assert.equal(assertLocalRelayListenerReadback(line,local,321).verified,true);
 for(const bad of [line.replace('pid=321','pid=322'),line.replace('127.0.0.1','0.0.0.0'),line.replace('41001','41002')])
  assert.throws(()=>assertLocalRelayListenerReadback(bad,local,321),fault('HOST_NETWORK_LOCAL_RELAY_UNKNOWN'));
});

test('host listener readback pins one process and exact veth ports; SDK private route pins interface',()=>{
 const p=plan(),relay=relayProcess(p,[44000]);
 assert.equal(assertHostRelayListenerReadback(hostListeners(p,relay),p,relay).verified,true);
 for(const bad of [hostListeners(p,relay).replace('pid=321','pid=322'),hostListeners(p,relay).replace(p.hostAddress,'0.0.0.0'),
  hostListeners(p,relay).replace('fd=18','fd=18),("node",pid=322,fd=19')])
  assert.throws(()=>assertHostRelayListenerReadback(bad,p,relay),fault('HOST_NETWORK_HOST_RELAY_UNKNOWN'));
 assert.equal(assertPrivateTargetRouteReadback('[{"dst":"10.0.1.4","dev":"eth0"}]',{address:'10.0.1.4',interfaceName:'eth0'}).verified,true);
 assert.throws(()=>assertPrivateTargetRouteReadback('[{"dst":"10.0.1.4","dev":"eth1"}]',{address:'10.0.1.4',interfaceName:'eth0'}),fault('HOST_NETWORK_PRIVATE_ROUTE_UNKNOWN'));
});

test('native relay launch adapter passes only pinned executable, exact namespace and proxy routes',async()=>{
 const p=plan(),proof={verified:true,kind:'browser',namespacePath:p.namespacePath,namespaceDev:'4',namespaceIno:'42',
  localRelays:[{name:'browser-http',localPort:41001,hostAddress:p.hostAddress,hostRelayPort:44000}]};
 let call;
 const launch=createNativeLocalRelayPort({allocation,binding,hostIdentity:{},helperPath:'/usr/local/bin/meri-native-launch',nodePath:'/usr/local/bin/node',cwd:'/workspace',relayUid:65532,relayGid:65532,toolUid:65533,
  authorize:async()=>{},startConfinedLocalRelay:async input=>{call=input;return {pid:321,async close(){return {closed:true};}};}});
 const handle=await launch({plan:p,proof});assert.equal(handle.pid,321);assert.equal(call.kind,'browser');
 assert.equal(call.command,'/usr/local/bin/node');assert.ok(call.args[0].endsWith('/network/local-relay-entry.mjs'));
 const config=JSON.parse(Buffer.from(call.args[1],'base64url').toString());
 assert.deepEqual(config.routes,[{name:'browser-http',localPort:41001,hostAddress:p.hostAddress,hostRelayPort:44000}]);
 assert.equal(typeof call.authorize,'function');
 assert.throws(()=>createNativeLocalRelayPort({allocation,binding,hostIdentity:{},helperPath:'/tmp/helper',nodePath:'/usr/bin/node',cwd:'/workspace',relayUid:65533,relayGid:65533,toolUid:65533,authorize:()=>{},startConfinedLocalRelay:()=>{}}),fault('HOST_NETWORK_LOCAL_RELAY_CONFIGURATION'));
});

test('future proxy-web guard pins UID/cgroup, private exceptions and all ENI output readback',()=>{
 const guard=createProxyWebGuard({allocation,binding,eniName:'eth0',proxyUid:24001,relayUid:24002,metadataUid:0,dnsAddress:'10.0.0.2',
  privateServices:[{name:'model-proxy',address:'10.0.1.4',port:443,uid:0},{name:'control',address:'10.0.1.5',port:443,uid:0}]});
 assert.ok(guard.cgroupPath.endsWith('/browser-proxy'));
 assert.ok(guard.relayCgroupPath.endsWith('/host-relay-browser'));
 assert.equal(guard.expected.at(-1).rule.expr.at(-1).drop,null);
 assert.equal(guard.expected.some(x=>x.rule?.expr?.some(y=>y.match?.right?.prefix?.addr==='169.254.0.0')),true);
 const webAllows=guard.expected.filter(x=>x.rule?.expr?.at(-1)?.accept===null&&
  x.rule.expr.some(y=>y.match?.left?.meta?.key==='skuid'&&y.match.right===guard.proxyUid)&&
  x.rule.expr.some(y=>y.match?.left?.payload?.protocol==='tcp'&&y.match.left.payload.field==='dport'&&[80,443].includes(y.match.right)));
 assert.equal(webAllows.length,2);
 assert.equal(webAllows.every(x=>x.rule.expr.some(y=>y.match?.left?.meta?.key==='nfproto'&&y.match.right==='ipv4')),true);
 assert.equal(guard.expected.at(-2).rule.expr.some(y=>y.match?.left?.meta?.key==='skuid'&&y.match.right===guard.proxyUid),true);
 assert.equal(guard.expected.at(-2).rule.expr.at(-1).drop,null);
 const readback={guard,pid:321,processUid:24001,processCgroup:guard.cgroupPath,relayPid:322,relayProcessUid:24002,
  relayProcessCgroup:guard.relayCgroupPath,nftOutput:nftOutput(guard.expected),ipv4DefaultRoutes:'[{"dst":"default","dev":"eth0"}]',ipv6DefaultRoutes:'[]'};
 assert.equal(assertProxyWebGuardReadback(readback).sourceContractMatched,true);
 for(const bad of [
  {processUid:0},{processCgroup:'/other'},{relayPid:undefined},{relayProcessUid:0},{relayProcessCgroup:'/other'},
  {ipv4DefaultRoutes:'[{"dst":"default","dev":"eth1"}]'},
  {ipv6DefaultRoutes:'[{"dst":"default","dev":"eth0"}]'},
  {nftOutput:nftOutput(guard.expected.slice(0,-1))},
 ])assert.throws(()=>assertProxyWebGuardReadback({...readback,...bad}),fault('HOST_PROXY_WEB_UNQUALIFIED'));
 assert.throws(()=>createProxyWebGuard({allocation,binding,eniName:'eth0',proxyUid:24001,relayUid:24002,metadataUid:0,dnsAddress:'10.0.0.2',
  privateServices:[{name:'model-proxy',address:'169.254.169.254',port:443,uid:0},{name:'control',address:'10.0.1.5',port:443,uid:0}]}),fault('HOST_PROXY_WEB_UNQUALIFIED'));
});

test('fixed relay forwards only to pinned address and destroys an open tunnel on revoke',async()=>{
 const upstream=createServer(s=>{s.on('data',d=>s.write(d));});await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const target=upstream.address().port,relay=await startPinnedRelay({listenAddress:'127.0.0.1',listenPort:0,targetAddress:'127.0.0.1',targetPort:target});
 try{assert.equal(relay.verify().verified,true);
  const client=connect({host:'127.0.0.1',port:relay.port});await once(client,'connect');client.write('ping');
  const [data]=await once(client,'data');assert.equal(data.toString(),'ping');
  const ended=once(client,'close');relay.revoke();await ended;
  assert.throws(()=>relay.verify(),fault('HOST_NETWORK_RELAY_BINDING_UNKNOWN'));
 }finally{await relay.close();await new Promise(resolve=>upstream.close(resolve));}
});
