/** Money Flow reproduced from serving-data shapes with fixtures only: no clone, no DEV copy, no population. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {moneyFlow,logicalActions,federalFiscalYear} from '../money-flow.mjs';
// Two awards share PIID 0001 and modification 6: one direct award at subtier 9700, one under IDV HDTRA114D0016 at
// subtier 2100. The applied view's DISTINCT ON (piid) would keep one of them and attribute both money streams to it.
const awards=[
 {piid:'0001',awardingSubtierCode:'9700',parentPiid:null,parentSubtierCode:null,awardUniqueId:'CONT_AWD_0001_9700_-NONE-_-NONE-',recipientUei:'UEI-ALPHA',recipientName:'Alpha Corp'},
 {piid:'0001',awardingSubtierCode:'2100',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700',awardUniqueId:'CONT_AWD_0001_2100_HDTRA114D0016_9700',recipientUei:'UEI-BETA',recipientName:'Beta LLC'},
 {piid:'7',awardingSubtierCode:'9700',parentPiid:null,parentSubtierCode:null,awardUniqueId:'CONT_AWD_7_9700_-NONE-_-NONE-',recipientUei:'UEI-ALPHA',recipientName:'Alpha Corp'},
];
const revision=(over)=>({piid:'0001',awardingSubtierCode:'9700',parentPiid:null,parentSubtierCode:null,modificationNumber:'6',transactionNumber:0,actionDate:'2026-10-15',federalActionObligation:1000,sourceObservedAt:'2026-10-20T00:00:00.000Z',revisionId:'rev-1',...over});
const revisions=[
 revision({}),                                                                                                   // direct award, FY2027 (October)
 revision({revisionId:'rev-1b',sourceObservedAt:'2026-10-21T00:00:00.000Z'}),                                     // re-observation of the same action: no new money
 revision({awardingSubtierCode:'2100',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700',federalActionObligation:250,revisionId:'rev-2'}), // the other award, same PIID/mod
 revision({modificationNumber:'0',actionDate:'2026-03-01',federalActionObligation:500,revisionId:'rev-3'}),       // base award action, FY2026
 revision({piid:'7',modificationNumber:'0',actionDate:'2026-03-02',federalActionObligation:40,revisionId:'rev-4'}),// numeric PIID award stays eligible
 revision({modificationNumber:'0',actionDate:'2026-03-01',federalActionObligation:450,sourceObservedAt:'2026-10-25T00:00:00.000Z',revisionId:'rev-3c'}), // corrected observation replaces 500
];

test('federal fiscal year follows the action date: October to December belong to the next fiscal year',()=>{
 assert.equal(federalFiscalYear('2026-09-30'),2026);assert.equal(federalFiscalYear('2026-10-01'),2027);assert.equal(federalFiscalYear('2026-01-15'),2026);
 assert.throws(()=>federalFiscalYear('2026-13-01'),{code:'ACTION_DATE_MALFORMED'});assert.throws(()=>federalFiscalYear('10/01/2026'),{code:'ACTION_DATE_MALFORMED'});
});
test('logical actions collapse repeated observations and keep the corrected one, per full award identity',()=>{
 const actions=logicalActions(awards,revisions);
 assert.equal(actions.length,4,'two awards share PIID 0001 and modification 6, plus the base action, plus PIID 7');
 const direct6=actions.find(a=>a.identity.key.startsWith('6:direct')&&a.modificationNumber==='6'),idv6=actions.find(a=>a.identity.kind==='under_idv');
 assert.equal(direct6.observations,2);assert.equal(direct6.federalActionObligation,1000);assert.equal(direct6.revisionId,'rev-1b');
 assert.equal(idv6.observations,1);assert.equal(idv6.federalActionObligation,250);
 const base=actions.find(a=>a.modificationNumber==='0'&&a.identity.piid==='0001');
 assert.equal(base.observations,2);assert.equal(base.federalActionObligation,450,'the later observation corrects, never adds');assert.equal(base.revisionId,'rev-3c');
 assert.ok(actions.some(a=>a.identity.piid==='7'),'a numeric PIID is never quarantined');
});
test('row order never changes the projection and distinct legitimate same-date actions are not collapsed',()=>{
 const shuffled=[...revisions].reverse();
 assert.deepEqual(logicalActions([...awards].reverse(),shuffled),logicalActions(awards,revisions));
 const twin=[revision({}),revision({transactionNumber:1,revisionId:'rev-twin'})];
 assert.equal(logicalActions(awards,twin).length,2,'same date, modification and delta with a different transaction number are two actions');
 assert.throws(()=>logicalActions(awards,[revision({}),revision({federalActionObligation:999,revisionId:'rev-x'})]),{code:'OBSERVATION_CONFLICT'},'two different values at the same observation instant are a conflict, not a sum');
});
test('Money Flow attributes money by full award identity and vendor without cross-award collapse or double counting',()=>{
 const flow=moneyFlow(awards,revisions);
 assert.equal(flow.currency,'USD');assert.equal(flow.identity,'full_award_identity');assert.equal(flow.basis,'latest_observation_per_logical_action');assert.equal(flow.fiscalYearBasis,'federal_fiscal_year_of_action_date');
 assert.equal(flow.awards.length,3);
 const direct=flow.awards.find(a=>a.recipientUei==='UEI-ALPHA'&&a.piid==='0001'),idv=flow.awards.find(a=>a.recipientUei==='UEI-BETA'),seven=flow.awards.find(a=>a.piid==='7');
 assert.deepEqual(direct.byFiscalYear,{2026:450,2027:1000});assert.equal(direct.totalObligation,1450);assert.equal(direct.logicalActions,2);assert.equal(direct.physicalObservations,4);
 assert.deepEqual(idv.byFiscalYear,{2027:250});assert.equal(idv.totalObligation,250);
 assert.deepEqual(seven.byFiscalYear,{2026:40});
 assert.deepEqual(flow.byVendor,[{key:'UEI-ALPHA',currency:'USD',totalObligation:1490,awards:2},{key:'UEI-BETA',currency:'USD',totalObligation:250,awards:1}]);
 assert.deepEqual(flow.byAwardingSubtier,[{key:'2100',currency:'USD',totalObligation:250,awards:1},{key:'9700',currency:'USD',totalObligation:1490,awards:2}]);
 // the rejected consumer semantics would have produced one PIID-0001 line carrying 1250 for modification 6 alone
 assert.notEqual(direct.totalObligation+idv.totalObligation,1000+1000+250+500+450,'physical rows are not summed');
});
test('a transaction that resolves to zero, several or a mismatched-parent award fails closed instead of first-row attribution',()=>{
 assert.throws(()=>moneyFlow(awards,[revision({piid:'0002'})]),{code:'AWARD_NOT_FOUND'});
 assert.throws(()=>moneyFlow(awards,[revision({parentPiid:'OTHER',parentSubtierCode:'9700'})]),{code:'AWARD_PARENT_MISMATCH'});
 assert.throws(()=>moneyFlow([awards[0],{...awards[0],awardUniqueId:'CONT_AWD_0001_9700_X_Y'}],[revision({})]),{code:'AWARD_AMBIGUOUS'});
 assert.throws(()=>moneyFlow(awards,[revision({federalActionObligation:'1000'})]),{code:'OBLIGATION_MALFORMED'});
 assert.throws(()=>moneyFlow(awards,[revision({revisionId:''})]),{code:'REVISION_ID_MISSING'});
});
