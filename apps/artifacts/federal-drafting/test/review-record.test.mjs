import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {compileFederalDraft} from '../engine.mjs';
import {sourceFor,opFor} from './fixtures.mjs';
import {FEDERAL_REVIEW_SCHEMA,federalRevisionRecord,federalApprovalRecord,encodeFederalReview,decodeFederalReview,assertFederalApprovalBinds} from '../review-record.mjs';

function prepared(text='$150'){
 const source=sourceFor(),draft=compileFederalDraft(source,[opFor(source,{text})]);
 const sourceArtifact={versionId:randomUUID(),sha256:source.sha256,specSha256:'1'.repeat(64)};
 return {sourceArtifact,draft,revisionSha256:canonicalSha256({sourceArtifact,draftSha256:draft.revisionSha256}),approval:'unapproved'};
}

test('an unapproved revision record keeps the original saved-review bytes',()=>{
 const p=prepared(),record=federalRevisionRecord(p);
 assert.equal(record.approval,null);
 assert.equal(encodeFederalReview(record),JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:p}));
 assert.deepEqual(decodeFederalReview(encodeFederalReview(record)),{prepared:p,approval:null});
 assert.equal(assertFederalApprovalBinds(null,p,randomUUID()),null);
});

test('an approval binds one revision hash to the version it approved and survives encode/decode',()=>{
 const p=prepared(),reviewVersionId=randomUUID(),record=federalApprovalRecord(p,reviewVersionId);
 assert.deepEqual(record.approval,{revisionSha256:p.revisionSha256,reviewVersionId});
 const decoded=decodeFederalReview(encodeFederalReview(record));
 assert.deepEqual(decoded.approval,record.approval);
 assert.deepEqual(assertFederalApprovalBinds(decoded.approval,p,reviewVersionId),record.approval);
 assert.throws(()=>federalApprovalRecord(p,'not-a-version'),{code:'DRAFT_APPROVAL_INVALID'});
});

test('store rule: a revision invalidates the prior approval; an approval cannot name another revision or parent',()=>{
 const original=prepared(),revised=prepared('$175'),reviewVersionId=randomUUID(),approval=federalApprovalRecord(original,reviewVersionId).approval;
 assert.notEqual(revised.revisionSha256,original.revisionSha256);
 // The record a revision save writes carries no approval whatever its parent carried.
 assert.equal(federalRevisionRecord(revised).approval,null);
 // A stored approval re-read against the revised compilation is invalid, as is one claiming a different parent.
 assert.throws(()=>assertFederalApprovalBinds(approval,revised,reviewVersionId),{code:'DRAFT_APPROVAL_INVALID'});
 assert.throws(()=>assertFederalApprovalBinds(approval,original,randomUUID()),{code:'DRAFT_APPROVAL_INVALID'});
 assert.throws(()=>assertFederalApprovalBinds(approval,original,null),{code:'DRAFT_APPROVAL_INVALID'});
});

test('malformed retained records are refused as invalid rather than read as unapproved',()=>{
 const p=prepared();
 for(const text of ['not json',JSON.stringify({schema:'other',prepared:p}),JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA}),
  JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:p,approval:{revisionSha256:'x',reviewVersionId:randomUUID()}}),
  JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:p,approval:{revisionSha256:p.revisionSha256}}),
  JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:p,approval:null,approved:true})]){
  assert.throws(()=>decodeFederalReview(text),{code:'DRAFT_REVIEW_INVALID'});
 }
 assert.equal(decodeFederalReview(JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:p,approval:null})).approval,null);
});
