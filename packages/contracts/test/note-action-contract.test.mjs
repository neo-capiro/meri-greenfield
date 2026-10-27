/** Closed saved-note boundary: the caller request Core accepts, the body-free request view Core returns, the
 *  three destination receipts, Core's finite envelope, and the recorded result this side releases. The same
 *  canonical fixtures are also compiled through the published JSON schema, so the JS boundary and the schema
 *  cannot drift apart. Core remains the current authority and the effect owner; nothing here holds note text. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalSha256,validateShape} from '../validate.mjs';
import {createSavedNoteValidators} from '../retrieval-0.2/note-action-validation.mjs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=Date.parse('2026-10-12T20:00:00.000Z'),ISO=n=>new Date(n).toISOString();
const body='note body text',bodyHash=canonicalSha256({body,length:body.length});
const binding={tenantId:id(80),actorId:id(81),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scope={tenantId:id(80),kind:'client',resourceId:id(5),policyRevision:'p1'};
const v=createSavedNoteValidators({validateShape,canonicalSha256});
const request=(over={})=>({body,title:'A title',clientId:id(5),confidential:false,accessLevel:'internal',...over});
const view=(over={})=>({tool:'save_note',bodyHash,bodyLength:body.length,title:'A title',clientId:id(5),meetingId:null,confidential:false,accessLevel:'internal',...over});
const context=(over={})=>({conversationId:id(1),selectedClientId:id(5),identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),...over});
const receipt={
 general:()=>({destination:'general',noteId:id(43),clientId:null,readiness:'ready',bodyHash,generatedAt:ISO(NOW)}),
 client_document:()=>({destination:'client_document',noteId:id(42),documentId:id(42),location:'https://core.invalid/files?attachmentId='+id(42),indexingStatus:'pending',reused:false,readiness:'indexing',bodyHash,generatedAt:ISO(NOW)}),
 meeting:()=>({destination:'meeting',noteId:id(40),meetingNoteId:id(41),meetingNoteStatus:'published',confidential:false,accessLevel:'internal',readiness:'ready',bodyHash,generatedAt:ISO(NOW)})};
const core=(over={})=>({version:'0.1.0',proposalId:id(20),status:'succeeded',policyOutcome:'PASS',request:view(),context:context(),createdAt:ISO(NOW),expiresAt:ISO(NOW+50000),receipt:receipt.client_document(),...over});
const envelope=(over={})=>({status:'saved',operation:'save_note',binding,scopes:[scope],bodyHash,bodyLength:body.length,proposalId:id(20),policyOutcome:'PASS',
 createdAt:ISO(NOW),expiresAt:ISO(NOW+50000),recordedAt:ISO(NOW),destination:'general',noteId:id(43),meetingNoteId:null,documentId:null,location:null,indexingStatus:null,readiness:'ready',reused:null,generatedAt:ISO(NOW),...over});

test('the closed caller request refuses extra keys, an injected conversation and out-of-bounds fields',()=>{
 assert.equal(v.request(request()).body,body);
 assert.throws(()=>v.request({...request(),extra:true}),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.throws(()=>v.request({...request(),conversationId:id(99)}),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.throws(()=>v.request({...request(),requestKey:'caller-chosen'}),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.throws(()=>v.request({body:''}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body:'x'.repeat(40001)}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body,title:'x'.repeat(161)}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body,clientId:'not-a-uuid'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body,meetingId:'not-a-uuid'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body,confidential:'false'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.request({body,accessLevel:'x'.repeat(81)}),{code:'INVALID_RESULT'});
});

test('the returned request view is body-free and correlates to the exact body that was carried',()=>{
 assert.equal(v.publicRequest(view()).bodyHash,bodyHash);
 assert.throws(()=>v.publicRequest(view({body})),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.throws(()=>v.publicRequest(view({conversationId:id(99)})),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.equal(v.publicRequest(view({bodyHash:'0'.repeat(64)})).bodyHash,'0'.repeat(64));
 const matched=v.coreResult(core(),request());
 assert.equal(matched.request.bodyHash,bodyHash);
 assert.equal(matched.context.identityRevision,'a'.repeat(64));
 assert.throws(()=>v.coreResult(core(),request({body:'a different body'})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult(core({request:view({bodyHash:canonicalSha256({body:'elsewhere',length:9})})}),request()),{code:'INVALID_RESULT'});
});

test("Core's finite envelope never fakes an outcome or a receipt",()=>{
 v.coreResult(core({request:view({clientId:null}),receipt:receipt.general()}),{body});
 v.coreResult(core({receipt:receipt.client_document()}),request());
 v.coreResult(core({request:view({meetingId:id(7)}),receipt:receipt.meeting()}),request({meetingId:id(7)}));
 assert.throws(()=>v.coreResult(core({receipt:null}),request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult(core({status:'blocked',policyOutcome:'BLOCK',errorCode:'note_blocked',errorMessage:null}),request()),{code:'INVALID_RESULT'});
 v.coreResult(core({status:'blocked',policyOutcome:'BLOCK',receipt:null,errorCode:'note_blocked',errorMessage:'Blocked by policy'}),request());
 v.coreResult(core({status:'outcome_unknown',policyOutcome:'PASS',receipt:null,errorCode:'note_outcome_unknown',errorMessage:'No confirmed receipt'}),request());
 assert.throws(()=>v.coreResult(core({status:'outcome_unknown',receipt:null}),request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult(core({status:'invalid'}),request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult(core({policyOutcome:'MAYBE'}),request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult(core({expiresAt:ISO(NOW-1)}),request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult({...core(),errorCode:'unexpected'},request()),{code:'INVALID_RESULT'});
 assert.throws(()=>v.coreResult({...core(),errorMessage:'unexpected'},request()),{code:'INVALID_RESULT'});
});

test('a receipt carries exactly the identity its destination has',()=>{
 assert.equal(v.receipt(receipt.general()).destination,'general');
 assert.equal(v.receipt(receipt.client_document()).readiness,'indexing');
 assert.equal(v.receipt(receipt.meeting()).meetingNoteId,id(41));
 assert.throws(()=>v.receipt({...receipt.general(),clientId:id(5)}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.general(),readiness:'indexed'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.client_document(),documentId:null}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.client_document(),reused:null}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.client_document(),indexingStatus:'unknown-state'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.meeting(),meetingNoteId:null}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.meeting(),readiness:'indexing'}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.receipt({...receipt.meeting(),destination:'memory'}),{code:'INVALID_RESULT'});
});

test('the released saved-note result is truthful and the body never crosses the boundary',()=>{
 v.envelope(envelope());
 v.envelope(envelope({destination:'client_document',noteId:id(42),documentId:id(42),location:'https://core.invalid/files?attachmentId='+id(42),indexingStatus:'pending',readiness:'indexing',reused:false}));
 v.envelope(envelope({destination:'meeting',noteId:id(40),meetingNoteId:id(41)}));
 v.envelope(envelope({status:'withheld',policyOutcome:'WARN',destination:null,noteId:null,readiness:null,errorCode:'note_withheld_policy'}));
 v.envelope(envelope({status:'blocked',policyOutcome:'BLOCK',destination:null,noteId:null,readiness:null,errorCode:'note_blocked'}));
 v.envelope(envelope({status:'unknown',destination:null,noteId:null,readiness:null,errorCode:'note_unknown'}));
 v.envelope(envelope({status:'failed',destination:null,noteId:null,readiness:null,errorCode:'note_not_saved'}));
 assert.ok(!JSON.stringify(envelope()).includes(body));
 assert.throws(()=>v.envelope(envelope({status:'withheld',policyOutcome:'WARN',errorCode:'note_withheld_policy'})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({status:'blocked',policyOutcome:'WARN',destination:null,noteId:null,readiness:null,errorCode:'note_blocked'})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({status:'unknown',destination:null,noteId:null,readiness:null,errorCode:null})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({status:'saved',policyOutcome:'WARN'})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({destination:'general',documentId:id(42)})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({meetingNoteId:id(41)})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({readiness:'unavailable'})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({scopes:[scope,{...scope,policyRevision:'p2'}]})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope(envelope({scopes:[{...scope,tenantId:id(99)}]})),{code:'INVALID_RESULT'});
 assert.throws(()=>v.envelope({...envelope(),privateBody:body}),{name:'CommandError',message:'INVALID_COMMAND'});
 assert.equal(v.result(envelope(),{body}).bodyLength,body.length);
 assert.throws(()=>v.result(envelope({bodyHash:canonicalSha256({body:'elsewhere',length:9})}),{body}),{code:'INVALID_RESULT'});
 assert.throws(()=>v.result(envelope({bodyLength:body.length+1}),{body}),{code:'INVALID_RESULT'});
});

test('the published schema accepts the same canonical results and rejects tampering',async()=>{
 const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
 ajv.addSchema(JSON.parse(await readFile(new URL('../meri.schema.json',import.meta.url))));
 ajv.addSchema(JSON.parse(await readFile(new URL('../retrieval-0.2/note-action.schema.json',import.meta.url))));
 const validate=ajv.compile({$ref:'urn:meri:retrieval:note-action:0.2.0#/$defs/SavedNoteResult'});
 const accepted=[envelope(),envelope({destination:'meeting',noteId:id(40),meetingNoteId:id(41)}),envelope({status:'withheld',policyOutcome:'WARN',destination:null,noteId:null,readiness:null,errorCode:'note_withheld_policy'})];
 for(const value of accepted){assert.equal(validate(value),true,JSON.stringify(validate.errors));v.envelope(value);}
 for(const value of [envelope({privateBody:body}),envelope({operation:'apply_legiwatch_suggestion'}),envelope({bodyLength:0}),envelope({status:'archived'}),envelope({scopes:[]})])
  assert.equal(validate(value),false,JSON.stringify(value));
 // The published schema is the wire shape; it cannot state the outcome truth rules, so the JS boundary is
 // what refuses a withheld result that still claims a receipt identity.
 const shapeOnly=envelope({status:'withheld',policyOutcome:'WARN',errorCode:'note_withheld_policy'});
 assert.equal(validate(shapeOnly),true,JSON.stringify(validate.errors));
 assert.throws(()=>v.envelope(shapeOnly),{code:'INVALID_RESULT'});
});


test('note request and receipt retain canonical normalization and exact destination/body binding',()=>{
 assert.deepEqual(v.request({body:'  body\n',title:' title ',accessLevel:' internal '}),{body:'body',title:'title',accessLevel:'internal'});
 for(const value of [{body:'   '},{body,clientId:null},{body,meetingId:null},{body,title:'  '},{body,accessLevel:'  '}])assert.throws(()=>v.request(value));
 assert.throws(()=>v.coreResult(core({receipt:{...receipt.client_document(),bodyHash:'0'.repeat(64)}}),request()));
 assert.throws(()=>v.coreResult(core({receipt:receipt.general()}),request()));
 assert.throws(()=>v.coreResult(core({receipt:receipt.meeting()}),request()));
 assert.equal(v.coreResult(core({status:'proposed',policyOutcome:'WARN',receipt:null,errorCode:null,errorMessage:null}),request()).status,'proposed');
});
