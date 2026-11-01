import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFederalRawSource,normalizeFederalRawRequest} from '../federal-workbench/raw-source.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import vector from './fixtures/federal-raw-source.wire.json' with {type:'json'};
import old from './fixtures/federal-draft-source.wire.json' with {type:'json'};
const legacy=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
test('dedicated raw receiver admits the exact Core byte fixture and leaves frozen SDK wire unchanged',()=>{
 assert.deepEqual(normalizeFederalRawRequest(vector.request),vector.request);
 assert.deepEqual(assertFederalRawSource(vector.response,vector.request),vector.response);
 assert.equal(vector.response.raw.text.charCodeAt(0),0xfeff);
 assert.throws(()=>legacy.normalizeInput(vector.request));
 assert.throws(()=>legacy.assertOutput(vector.response,{request:old.request}));
 assert.doesNotThrow(()=>legacy.assertOutput(old.response,{request:old.request}));
});
test('raw receiver rejects altered byte provenance, shape, negotiated format and source identity',()=>{
 for(const mutate of [v=>v.raw.text+='x',v=>v.raw.sha256='0'.repeat(64),v=>v.raw.capture.byteLength++,
  v=>v.raw.capture.sha256='0'.repeat(64),v=>v.raw.capture.utf8RoundTrip=false,v=>v.raw.format='txt',
  v=>v.raw.capture.mediaType='application/xml; charset=latin1',v=>v.raw.capture.extra=true,
  v=>v.source.evidenceParserVersion='old-parser',v=>v.representation='anything',v=>delete v.raw]){
  const changed=structuredClone(vector.response);mutate(changed);
  assert.throws(()=>assertFederalRawSource(changed,vector.request));
 }
});
test('historical unreported and current absence are explicit negotiated unavailable results',()=>{
 const {representation,...selection}=vector.request;
 for(const reason of ['raw_capture_unreported','raw_capture_unsupported','raw_capture_unverified','exact_current_source_unavailable']){
  const value={tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',selection,representation,reason};
  assert.deepEqual(assertFederalRawSource(value,vector.request),value);
  assert.throws(()=>assertFederalRawSource({...value,raw:vector.response.raw},vector.request));
 }
});
