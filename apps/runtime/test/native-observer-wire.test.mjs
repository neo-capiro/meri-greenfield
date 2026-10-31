import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNativeObserverResponse as normalize} from '../native-observer-wire.mjs';
import {observerFixture,instanceId,volumeId,eniId,uuid} from './native-observer-fixture.mjs';
const fixture=await observerFixture();
const event=(api,stage='capture')=>({phase:'ordinary',stage,operationId:uuid(1),sessionId:uuid(2),startedAtMs:2000,callDeadlineMs:5000,
 request:{api,...(api==='DescribeInstances'?{kind:'exact',instanceId}:api==='DescribeVolumes'?{volumeId}:
 api==='DescribeNetworkInterfaces'?{networkInterfaceId:eniId}:api==='TerminateInstances'?{instanceId,dispatchId:uuid(3)}:{})}});
test('realistic SDK wire retains metadata and complete instance/root/ENI facts',()=>{
 for(const api of Object.keys(fixture.responses)){
  const e=event(api,api==='GetCallerIdentity'?'authentication':api==='TerminateInstances'?'termination':'capture');
  const c=normalize(fixture.responses[api],{row:fixture.row,event:e,completedAtMs:2100});
  assert.equal(c.outcome,'success',api);assert.equal(c.requestId,'synthetic-request-12345678');assert.equal(c.httpStatusCode,200);
 }
});
test('descriptor-safe boundary rejects accessors, duplicate tags, extra results, public addresses and malformed private IP',()=>{
 for(const mutate of [
  r=>{Object.defineProperty(r.Reservations[0].Instances[0],'Tags',{get(){throw Error('ACCESSOR EXECUTED');},enumerable:true});},
  r=>r.Reservations[0].Instances[0].Tags.push(r.Reservations[0].Instances[0].Tags[0]),
  r=>r.Reservations[0].Instances.push(r.Reservations[0].Instances[0]),
  r=>{r.Reservations[0].Instances[0].PublicIpAddress='8.8.8.8';},
  r=>{r.Reservations[0].Instances[0].PrivateIpAddress='10.not-an-ip';},
  r=>{r.NextToken='unexpected';},
  r=>{delete r.$metadata.requestId;},
 ]){const raw=structuredClone(fixture.responses.DescribeInstances);mutate(raw);
  assert.equal(normalize(raw,{row:fixture.row,event:event('DescribeInstances'),completedAtMs:2100}).outcome,'invalid-response');}
});
test('only the actual service exception preserves NotFound metadata; timeout and empty list have no absence authority',()=>{
 const e=event('DescribeVolumes','absence');
 const error=Object.assign(Error('missing'),{name:'InvalidVolume.NotFound',$metadata:{requestId:'actual-service-request',httpStatusCode:400}});
 const c=normalize(error,{row:fixture.row,event:e,completedAtMs:2100,error:true});
 assert.equal(c.outcome,'service-error');assert.equal(c.errorCode,'InvalidVolume.NotFound');assert.equal(c.httpStatusCode,400);
 assert.equal(normalize(Error('socket timeout'),{row:fixture.row,event:e,completedAtMs:2100,error:true}).outcome,'transport-unknown');
 assert.equal(normalize({...fixture.meta,Volumes:[]},{row:fixture.row,event:e,completedAtMs:2100}).outcome,'invalid-response');
});
