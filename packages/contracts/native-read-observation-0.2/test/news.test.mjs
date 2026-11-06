/** Closed articles observation; no authority or source activity is created by this carrier. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReadObservation,encodeNativeReadObservation,decodeNativeReadObservation} from '../validate.mjs';

const operation={id:'search_legiwatch_news',version:'0.2.0'},request={view:'articles',q:'drone procurement',days:7,limit:2};
const context={asOf:'2026-10-12T01:00:00.000Z'},binding={operation,request};
test('articles carries exactly one canonical cutoff correlated to the actual outgoing request',()=>{
 const value=createNativeReadObservation({...binding,context}),carrier=encodeNativeReadObservation(value,binding);
 assert.deepEqual(decodeNativeReadObservation(carrier,binding),value);assert.deepEqual(value.context,context);
 for(const changed of [{...request,days:14},{...request,q:'other'},{...request,clientId:'a1234567-b123-4c12-8d12-e123456789ab'}])
  assert.throws(()=>decodeNativeReadObservation(carrier,{operation,request:changed}),{message:'NATIVE_READ_OBSERVATION_REFUSED'});
});
test('source/personnel, retired views and absent view cannot inherit the articles cutoff',()=>{
 for(const raw of [{},{view:'news'},{view:'source',kind:'news',id:'source'},{view:'personnel',year:2026},{view:'monitors'}])
  assert.throws(()=>createNativeReadObservation({operation,request:raw,context}),{message:'NATIVE_READ_OBSERVATION_REFUSED'});
});
test('news context rejects extra authority fields, noncanonical dates and a local-context alias',()=>{
 for(const selected of [{...context,clientId:'client'},{...context,windowAsOf:context.asOf},{windowAsOf:context.asOf},{asOf:'2026-10-12T01:00:00Z'},{asOf:'2026-02-30T01:00:00.000Z'}])
  assert.throws(()=>createNativeReadObservation({...binding,context:selected}),{message:'NATIVE_READ_OBSERVATION_REFUSED'});
});
