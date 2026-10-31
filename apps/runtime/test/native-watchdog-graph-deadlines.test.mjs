import test from 'node:test';
import assert from 'node:assert/strict';
import {compileNativeWatchdogDefinition} from '../../../infra/browser-enforcement/workflow.mjs';
const s=compileNativeWatchdogDefinition().States;
// Structural inspection only: this does not evaluate JSONata or qualify any AWS execution.
// A Choice Default holds only when NO Choice condition holds, so a Default IS bounded when one of its sibling
// conditions is a pure original-ceiling comparison. The superseded Parent fixture ignored that and reported the
// ceiling-guarded Default edges as unguarded paths; this traversal models the real Choice semantics.
const CEILING=/^\{%\s*\$toMillis\(\$now\(\)\)\s*>=\s*\$ctx\.(?:cleanupCeilingMs|deadlineMs)\s*%\}$/u;
const isCeiling=condition=>typeof condition==='string'&&CEILING.test(condition.trim());
function edges(state){
 const choices=(state.Choices??[]).map(x=>({next:x.Next,guarded:isCeiling(x.Condition)}));
 const defaultBounded=choices.some(edge=>edge.guarded);
 return [...(state.Next?[{next:state.Next,guarded:false}]:[]),...choices,
  ...(state.Default?[{next:state.Default,guarded:defaultBounded}]:[])];
}
function search(start,target,onlyUnguarded){
 const queue=[start],seen=new Set([start]);
 while(queue.length){
  const current=queue.shift();
  if(current===target)return true;
  for(const edge of edges(s[current]??{})){
   if(onlyUnguarded&&edge.guarded)continue;
   if(seen.has(edge.next))continue;
   seen.add(edge.next);queue.push(edge.next);
  }
 }
 return false;
}
const unguarded=(start,target)=>search(start,target,true),reachable=(start,target)=>search(start,target,false);
// Non-vacuity: each route must still exist, and must not exist once every ceiling-guarded edge is removed.
for(const [label,start,target] of [['initial discovery page','TimeGate','DiscoverFirst'],
 ['continuation discovery page','PageCheck','DiscoverNext'],['per-instance direct read','SelectOwned','DescribeOwned']])
 test(`the ${label} re-checks the original cleanup ceiling`,()=>{
  assert.equal(reachable(start,target),true,`${start} -> ${target} must exist`);
  assert.equal(unguarded(start,target),false,`${start} -> ${target} must cross a ceiling check`);
 });
test('every per-ENI iteration re-checks the original cleanup ceiling before the next exact read',()=>{
 for(const start of ['EniAbsent','EniPresent','EniUnknown']){
  assert.equal(reachable(start,'ReadEni'),true,`${start} -> ReadEni must exist`);
  assert.equal(unguarded(start,'ReadEni'),false,`${start} -> ReadEni must cross a ceiling check`);
 }
});
// The gated graph must still be a well-formed machine: no dangling target and a serializable definition.
test('every generated native transition targets a real state',()=>{
 const names=new Set(Object.keys(s));
 for(const [name,state] of Object.entries(s))
  for(const next of [state.Next,state.Default,...(state.Choices??[]).map(x=>x.Next),
   ...(state.Catch??[]).map(x=>x.Next)].filter(Boolean))assert.ok(names.has(next),`${name} -> ${next}`);
 assert.equal(Object.getPrototypeOf(JSON.parse(JSON.stringify(compileNativeWatchdogDefinition()))),Object.prototype);
});
// The optional NextToken string is absent on the first page instead of being sent as an initial null.
test('the first describeInstances page omits the optional NextToken entirely',()=>{
 const tasks=Object.entries(s).filter(([,state])=>state.Type==='Task'&&
  String(state.Resource).endsWith('ec2:describeInstances'));
 assert.deepEqual(tasks.map(([name])=>name),['DiscoverFirst','DiscoverNext','DescribeOwned','CorrelatedTerminal']);
 assert.equal(Object.hasOwn(s.DiscoverFirst.Arguments,'NextToken'),false,'the first page must not carry NextToken');
 assert.deepEqual(s.DiscoverNext.Arguments.NextToken,'{% $ctx.token %}');
 const {NextToken,...rest}=s.DiscoverNext.Arguments;
 assert.deepEqual(rest,s.DiscoverFirst.Arguments,'only the token differs by page');
});
