import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import raw from '../../../../packages/contracts/test/fixtures/federal-raw-source.wire.json' with {type:'json'};
import old from '../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};
import {readFederalSourceEnvelope,currentFederalSource} from '../source-custody.mjs';
import {projectNativeFederalSource,projectRawFederalSource} from '../native-source.mjs';
const {representation,...selection}=raw.request;
test('raw v2 import retains exact capture and declared hierarchy, and every current read uses the negotiated mode',async()=>{
 const calls=[],read=async request=>{calls.push(request);return structuredClone(raw.response);};
 const envelope=await readFederalSourceEnvelope(read,selection,{deadlineMs:1000,representation});
 assert.equal(envelope.schema,'meri.federal-source.v2');assert.equal(envelope.representation,representation);
 assert.deepEqual(envelope.capture,raw.response.raw.capture);assert.equal(envelope.source.text,raw.response.raw.text);
 assert.equal(envelope.source.sha256,raw.response.raw.sha256);
 assert.deepEqual(envelope.source.scopes.map(s=>s.id),['document','synthetic:s1']);
 assert.deepEqual(await currentFederalSource(envelope,read,{deadlineMs:1000}),envelope.source);
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.representation===representation));
 assert.ok(envelope.source.coverage.limitations.some(line=>line.startsWith('Captured response-body receipt:')));
 assert.ok(envelope.source.coverage.limitations.some(line=>line.includes('schema validity')));
});
test('v1 envelope bytes and legacy reread never silently upgrade to captured mode',async()=>{
 const calls=[],read=async request=>{calls.push(request);return old.response;};
 const expected={schema:'meri.federal-source.v1',selection:old.request,source:projectNativeFederalSource(old.request,old.response,{structured:true})};
 const envelope=await readFederalSourceEnvelope(read,old.request,{deadlineMs:1000});
 assert.equal(JSON.stringify(envelope),JSON.stringify(expected));
 assert.deepEqual(await currentFederalSource(envelope,read,{deadlineMs:1000}),expected.source);
 assert.ok(calls.every(call=>!Object.hasOwn(call,'representation')));
});
test('v2 reread refuses changed receipt, unsupported mode and current source loss',async()=>{
 const envelope=await readFederalSourceEnvelope(async()=>raw.response,selection,{deadlineMs:1000,representation});
 const changed=structuredClone(raw.response);changed.raw.capture.mediaType='application/xml';
 await assert.rejects(currentFederalSource(envelope,async()=>changed,{deadlineMs:1000}),{code:'DRAFT_SOURCE_STALE'});
 const unavailable={tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',selection,representation,reason:'raw_capture_unreported'};
 await assert.rejects(currentFederalSource(envelope,async()=>unavailable,{deadlineMs:1000}),{code:'DRAFT_SOURCE_STALE'});
 await assert.rejects(readFederalSourceEnvelope(async()=>raw.response,selection,{deadlineMs:1000,representation:'other'}),{code:'DRAFT_SOURCE_FORMAT'});
});

test('raw projection refuses declared-format and parser mismatch despite valid byte custody',()=>{
 const declaredText=structuredClone(raw.response);
 declaredText.raw.format='txt';declaredText.raw.capture.format='txt';
 assert.throws(()=>projectRawFederalSource(selection,declaredText),/FEDERAL_RAW_SOURCE_INVALID/);
 const declaredXml=structuredClone(raw.response),text='Synthetic plain source.\r\n',sha256=createHash('sha256').update(text).digest('hex');
 Object.assign(declaredXml.source,{text,textHash:sha256,versionHash:sha256});
 Object.assign(declaredXml.raw,{text,sha256,byteLength:Buffer.byteLength(text)});
 Object.assign(declaredXml.raw.capture,{sha256,byteLength:Buffer.byteLength(text)});
 assert.throws(()=>projectRawFederalSource({...selection,textHash:sha256,versionHash:sha256},declaredXml),/FEDERAL_RAW_SOURCE_INVALID/);
 declaredXml.raw.format='txt';declaredXml.raw.capture.format='txt';
 const plain=projectRawFederalSource({...selection,textHash:sha256,versionHash:sha256},declaredXml);
 assert.equal(plain.parserVersion,'federal-plain-text/1');assert.equal(plain.text,text);
});
