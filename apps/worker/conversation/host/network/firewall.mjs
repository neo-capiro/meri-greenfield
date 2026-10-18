/** Transactional nftables rules for one run-owned veth. nft JSON is also used for exact readback; a modified or
 * unrecognized rule set cannot yield a verified namespace. The host table never changes unrelated host chains. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_NETWORK_FIREWALL_UNKNOWN'),{code:'HOST_NETWORK_FIREWALL_UNKNOWN'});};
const meta=(key,right,op='==')=>({match:{op,left:{meta:{key}},right}});
const payload=(protocol,field,right,op='==')=>({match:{op,left:{payload:{protocol,field}},right}});
const accept={accept:null},drop={drop:null};
const table=name=>({family:'inet',name});
const chain=(name,hook,policy,tableName)=>({family:'inet',table:tableName,name,type:'filter',hook,prio:-300,policy});
const rule=(tableName,chainName,expr)=>({family:'inet',table:tableName,chain:chainName,expr});
const add=(type,value)=>({add:{[type]:value}});
const create=(type,value)=>({create:{[type]:value}});

/** Host relay ports are chosen only after listeners bind to the run's veth address. */
export function buildNetworkFirewalls(plan,relayPorts){
 if(!plan||!Array.isArray(relayPorts)||relayPorts.length!==plan.routes?.length||relayPorts.some(p=>!Number.isSafeInteger(p)||p<1024||p>65535)||new Set(relayPorts).size!==relayPorts.length)fail();
 const h=plan.hostTable,t=plan.toolTable;
 const hostElements=[{table:table(h)},{chain:chain('input','input','accept',h)},{chain:chain('forward','forward','accept',h)}];
 for(const p of relayPorts)hostElements.push({rule:rule(h,'input',[meta('iifname',plan.hostVethName),payload('ip','saddr',plan.toolAddress),payload('ip','daddr',plan.hostAddress),payload('tcp','dport',p),accept])});
 hostElements.push({rule:rule(h,'input',[meta('iifname',plan.hostVethName),drop])});
 hostElements.push({rule:rule(h,'forward',[meta('iifname',plan.hostVethName),drop])});

 const toolElements=[{table:table(t)},{chain:chain('input','input','drop',t)},{chain:chain('output','output','drop',t)},{chain:chain('forward','forward','drop',t)}];
 for(let i=0;i<relayPorts.length;i++){
  const p=relayPorts[i],local=plan.routes[i].localPort;
  // Client -> local relay, and local relay -> client, only at this one literal loopback port.
  toolElements.push({rule:rule(t,'output',[meta('oifname','lo'),payload('ip','daddr','127.0.0.1'),payload('tcp','dport',local),accept])});
  toolElements.push({rule:rule(t,'input',[meta('iifname','lo'),payload('ip','daddr','127.0.0.1'),payload('tcp','dport',local),accept])});
  toolElements.push({rule:rule(t,'output',[meta('oifname','lo'),payload('ip','saddr','127.0.0.1'),payload('tcp','sport',local),accept])});
  toolElements.push({rule:rule(t,'input',[meta('iifname','lo'),payload('ip','saddr','127.0.0.1'),payload('tcp','sport',local),accept])});
  // Local relay -> exact host veth relay. Direct tool connections to this one port still pass the same pinned proxy.
  toolElements.push({rule:rule(t,'output',[meta('oifname',plan.toolVethName),payload('ip','daddr',plan.hostAddress),payload('tcp','dport',p),accept])});
  toolElements.push({rule:rule(t,'input',[meta('iifname',plan.toolVethName),payload('ip','saddr',plan.hostAddress),payload('tcp','sport',p),accept])});
 }
 const commands=elements=>({nftables:elements.map(({table:tb,chain:ch,rule:r})=>tb?create('table',tb):ch?add('chain',ch):add('rule',r))});
 return Object.freeze({host:Object.freeze(commands(hostElements)),tool:Object.freeze(commands(toolElements)),
  expectedHost:Object.freeze(hostElements),expectedTool:Object.freeze(toolElements)});
}

/** Exact kernel readback of our own table, including ordered rules. Handles and nft metainfo are kernel metadata.
 * A mismatched rule, extra accept, absent base hook or changed default policy refuses admission. */
export function assertNetworkFirewallReadback(output,expected){
 let items;try{items=JSON.parse(output).nftables.filter(x=>!x.metainfo).map(x=>{
  const type=Object.keys(x)[0],raw=x[type];if(!['table','chain','rule'].includes(type)||!raw||typeof raw!=='object')fail();
  const {handle,flags,...value}=raw;if(type==='table'&&flags!==undefined&&(!Array.isArray(flags)||flags.length))fail();
  if(type!=='table'&&flags!==undefined)fail();return {[type]:value};});}catch{fail();}
 if(canonicalSha256(items)!==canonicalSha256(expected))fail();
 return Object.freeze({verified:true,table:expected[0].table.name,rules:items.filter(x=>x.rule).length});
}

/** nft processes each input batch as one transaction. Chains retain their fixed hook/default policy; rules in the
 * run-owned table are replaced together. No tool child may be active during this SDK Bash-bridge extension. */
export function buildFirewallReplaceTransaction(expected){
 if(!Array.isArray(expected)||expected[0]?.table?.family!=='inet')fail();
 const chains=expected.filter(x=>x.chain).map(x=>x.chain),rules=expected.filter(x=>x.rule).map(x=>x.rule);
 if(!chains.length||!rules.length||chains.some(c=>c.table!==expected[0].table.name)||rules.some(r=>r.table!==expected[0].table.name))fail();
 return Object.freeze({nftables:[...chains.map(c=>({flush:{chain:{family:'inet',table:c.table,name:c.name}}})),...rules.map(r=>add('rule',r))]});
}
