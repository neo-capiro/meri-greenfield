import test from 'node:test';
import assert from 'node:assert/strict';
import {awardIdentity,resolveAward,transactionKey,assertAwardRowsDistinct,piidText} from '../award-identity.mjs';
const direct={piid:'0001',awardingSubtierCode:'9700',parentPiid:null,parentSubtierCode:null,awardUniqueId:'CONT_AWD_0001_9700_-NONE-_-NONE-'};
const underIdv={piid:'0001',awardingSubtierCode:'9700',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700',awardUniqueId:'CONT_AWD_0001_9700_HDTRA114D0016_9700'};
const otherAgency={piid:'0001',awardingSubtierCode:'2100',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700',awardUniqueId:null};

test('a numeric or short PIID is a legitimate identifier and is never quarantined',()=>{
 for(const piid of ['0001','1','7','000000000000','A','N0002420C0001'])assert.equal(piidText(piid),piid);
 for(const bad of ['',' ','   ',null,undefined,12,'a b','x'.repeat(65)])assert.throws(()=>piidText(bad),{code:'AWARD_PIID_MALFORMED'});
});
test('award identity is the full key: PIID plus awarding subtier plus the parent dimensions, never PIID alone',()=>{
 const a=awardIdentity(direct),b=awardIdentity(underIdv),c=awardIdentity(otherAgency);
 assert.equal(a.kind,'direct');assert.equal(b.kind,'under_idv');assert.equal(c.kind,'under_idv');
 assert.equal(a.piid,b.piid);assert.equal(b.piid,c.piid);
 assert.notEqual(a.key,b.key);assert.notEqual(b.key,c.key);assert.notEqual(a.key,c.key);
 // encoding is length-prefixed, so component boundaries cannot be forged by delimiters inside a value
 assert.equal(a.key,'6:direct|4:0001|4:9700|-|-');assert.equal(b.key,'9:under_idv|4:0001|4:9700|13:HDTRA114D0016|4:9700');
 assert.notEqual(awardIdentity({piid:'1|4:9700',awardingSubtierCode:'9700'}).key,awardIdentity({piid:'1',awardingSubtierCode:'9700'}).key);
});
test('a partial parent, a missing agency and a composite award id that disagrees with the row fail closed',()=>{
 assert.throws(()=>awardIdentity({...underIdv,parentSubtierCode:null}),{code:'AWARD_PARENT_PARTIAL'});
 assert.throws(()=>awardIdentity({...underIdv,parentPiid:null}),{code:'AWARD_PARENT_PARTIAL'});
 assert.throws(()=>awardIdentity({...direct,awardingSubtierCode:null}),{code:'AWARD_AGENCY_MISSING'});
 assert.throws(()=>awardIdentity({...direct,awardUniqueId:'CONT_AWD_0002_9700_-NONE-_-NONE-'}),{code:'AWARD_UNIQUE_ID_MISMATCH'});
 assert.throws(()=>awardIdentity({...direct,awardUniqueId:'0001_9700'}),{code:'AWARD_UNIQUE_ID_MALFORMED'});
 assert.throws(()=>awardIdentity(null),{code:'AWARD_ROW_MALFORMED'});
});
test('resolution requires exactly one full-identity match and is invariant to candidate order',()=>{
 const candidates=[direct,underIdv,otherAgency];
 for(const order of [candidates,[...candidates].reverse(),[underIdv,direct,otherAgency]]){
  assert.equal(resolveAward(order,{piid:'0001',awardingSubtierCode:'9700',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700'}).award,underIdv);
  assert.equal(resolveAward(order,{piid:'0001',awardingSubtierCode:'9700'}).award,direct);
  assert.equal(resolveAward(order,{piid:'0001',awardingSubtierCode:'2100',parentPiid:'HDTRA114D0016',parentSubtierCode:'9700'}).award,otherAgency);
 }
 assert.throws(()=>resolveAward(candidates,{piid:'0002',awardingSubtierCode:'9700'}),{code:'AWARD_NOT_FOUND'});
 assert.throws(()=>resolveAward(candidates,{piid:'0001',awardingSubtierCode:'9700',parentPiid:'OTHERIDV',parentSubtierCode:'9700'}),{code:'AWARD_PARENT_MISMATCH'});
 assert.throws(()=>resolveAward([direct,{...direct,awardUniqueId:'CONT_AWD_0001_9700_X_Y'}],{piid:'0001',awardingSubtierCode:'9700'}),{code:'AWARD_AMBIGUOUS'});
 // never first-row-wins: an ambiguous set fails even when the first row would have matched
 assert.throws(()=>resolveAward([direct,{...direct}],{piid:'0001',awardingSubtierCode:'9700'}),{code:'AWARD_AMBIGUOUS'});
});
test('transaction keys depend on the resolved award plus validated action identity; transaction 0 survives',()=>{
 const a=awardIdentity(direct),b=awardIdentity(underIdv);
 const k0=transactionKey(a,{modificationNumber:'0',transactionNumber:0}),k6=transactionKey(a,{modificationNumber:'6',transactionNumber:0});
 assert.notEqual(k0,k6);assert.notEqual(transactionKey(a,{modificationNumber:'6',transactionNumber:0}),transactionKey(b,{modificationNumber:'6',transactionNumber:0}));
 assert.ok(k0.includes('1:0'));
 for(const action of [{modificationNumber:null,transactionNumber:0},{modificationNumber:'6',transactionNumber:null},{modificationNumber:'6',transactionNumber:-1},{modificationNumber:'6',transactionNumber:'0'},{modificationNumber:'',transactionNumber:0}])
  assert.throws(()=>transactionKey(a,action),error=>['ACTION_MODIFICATION_MISSING','ACTION_TRANSACTION_MISSING'].includes(error.code));
});
test('contract-award pages are distinct by row id; a shared PIID or a numeric awardId never refuses a page',()=>{
 const rows=[{id:'r1',awardId:'0001'},{id:'r2',awardId:'0001'},{id:'r3',awardId:null},{id:'r4',awardId:'7'}];
 assert.equal(assertAwardRowsDistinct(rows),rows);
 assert.throws(()=>assertAwardRowsDistinct([{id:'r1',awardId:'0001'},{id:'r1',awardId:'0002'}]),{code:'AWARD_ROW_ID_DUPLICATE'});
 assert.throws(()=>assertAwardRowsDistinct([{id:'',awardId:'0001'}]),{code:'AWARD_ROW_ID_MISSING'});
 assert.throws(()=>assertAwardRowsDistinct([{id:'r1',awardId:'   '}]),{code:'AWARD_PIID_MALFORMED'});
});
