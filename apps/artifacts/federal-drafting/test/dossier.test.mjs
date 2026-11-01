import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {compileFederalDraft} from '../engine.mjs';
import {sourceFor,opFor} from './fixtures.mjs';
import {scopedSource} from './scoped-fixture.mjs';
import {federalDraftDossier,FEDERAL_DOSSIER_LEGEND} from '../dossier.mjs';

function prepared(source,ops){
 const draft=compileFederalDraft(source,ops),sourceArtifact={versionId:randomUUID(),sha256:source.sha256,specSha256:'2'.repeat(64)};
 return {sourceArtifact,draft,revisionSha256:canonicalSha256({sourceArtifact,draftSha256:draft.revisionSha256}),approval:'unapproved'};
}
const texts=request=>request.content.blocks.map(block=>block.runs.map(run=>run.text).join(''));

test('the dossier is the typed Word request carrying source hash, retained source artifact, revision and approval state',()=>{
 const source=sourceFor(),p=prepared(source,[opFor(source)]),approval={revisionSha256:p.revisionSha256,reviewVersionId:randomUUID()};
 const unapproved=federalDraftDossier(p),approved=federalDraftDossier(p,approval);
 assert.equal(unapproved.format,'docx');assert.equal(unapproved.title,'Federal review dossier: Synthetic Act');
 const lines=texts(unapproved);
 assert.ok(lines.includes(`Source text SHA-256 ${source.sha256}; parser federal-plain-text/1; coverage partial.`));
 assert.ok(lines.includes(`Retained source artifact version ${p.sourceArtifact.versionId}; object SHA-256 ${p.sourceArtifact.sha256}; spec SHA-256 ${p.sourceArtifact.specSha256}.`));
 assert.ok(lines.includes(`Revision SHA-256 ${p.revisionSha256}; compiled revision SHA-256 ${p.draft.revisionSha256}.`));
 assert.ok(lines.includes('Approval: unapproved revision.'));
 assert.ok(texts(approved).includes(`Approval: approved revision ${approval.revisionSha256}; approved review version ${approval.reviewVersionId}.`));
 assert.ok(lines.includes(FEDERAL_DOSSIER_LEGEND));
 assert.ok(lines.some(line=>line.startsWith('Source limitation: ')));
 assert.ok(lines.includes('Unresolved: substantive-law (review-required) at Synthetic Act.'));
 assert.ok(lines.includes('op-1. In section 1, strike "$100" and insert "$150".'));
 assert.ok(lines.includes('SEC. 1. Payment is $150.'));
});

test('the comparison keeps one paragraph per source line with struck runs italic and inserted runs bold',()=>{
 const source=scopedSource(),p=prepared(source,[opFor(source,{id:'a1',scopeId:'a',text:'$150'}),opFor(source,{id:'s2',scopeId:'s2',expectedText:'Review.\r\n',text:'Report.\r\nMore.\r\n'})]);
 const request=federalDraftDossier(p),blocks=request.content.blocks,at=blocks.findIndex(b=>b.runs[0].text===FEDERAL_DOSSIER_LEGEND),comparison=blocks.slice(at+1);
 assert.deepEqual(comparison.map(b=>b.runs),[
  [{text:'Act\r'}],[{text:'SEC. 1.\r'}],[{text:'(a) Pay $1'},{text:'0',italic:true},{text:'5',bold:true},{text:'0. 😀\r'}],[{text:'(b) Pay $100.\r'}],
  [{text:'SEC. 2. Re'},{text:'view',italic:true},{text:'port.\r',bold:true}],[{text:'More',bold:true},{text:'.\r'}],[{text:''}]]);
 const consolidatedAt=blocks.findIndex(b=>b.runs[0].text==='Consolidated text');
 assert.deepEqual(blocks.slice(consolidatedAt+1,at-1).map(b=>b.runs[0].text),['Act\r','SEC. 1.\r','(a) Pay $150. 😀\r','(b) Pay $100.\r','SEC. 2. Report.\r','More.\r','']);
});

test('a reviewed revision beyond the Word contract refuses the dossier without touching the text exports',()=>{
 const source=sourceFor(['SEC. 1. Payment is $100.\n'+'Line.\n'.repeat(1200)]),p=prepared(source,[opFor(source)]);
 assert.throws(()=>federalDraftDossier(p),{code:'DRAFT_OUTPUT_UNEXPORTABLE',operationId:null});
 assert.equal(p.draft.outputs.consolidated.includes('$150.'),true);
});
