import test from 'node:test';
import assert from 'node:assert/strict';
import {composePreparedRunBindings} from './prepared-candidate.mjs';

const fn=()=>{};
const bindings=()=>({runIssuance:{issue:fn},issuanceIntent:fn,admissionForBinding:fn,issuer:{sign:fn},facts:{},prepareOriginal:fn,
 prepareInitial:fn,retireInitial:fn,configurationSha256:'a'.repeat(64),proposeInitialExpiry:fn,runWindowMs:900000});

test('startup bindings carry the run issuer the poststart authority signs against',()=>{
 const b=bindings(),initialBindings={claim:fn,readConversation:fn};
 const composed=composePreparedRunBindings(b,initialBindings);
 assert.equal(composed.issuer,b.issuer);
 assert.equal(composed.admissionForBinding,b.admissionForBinding);
 assert.equal(composed.runIssuance,b.runIssuance);
 assert.equal(composed.prepareOriginal,b.prepareOriginal);
 assert.deepEqual(Object.keys(composed).sort(),['admissionForBinding','configurationSha256','initialBindings','issuanceIntent','issuer','prepareInitial','prepareOriginal','proposeInitialExpiry','retireInitial','runIssuance']);
 assert.equal(composed.initialBindings,initialBindings);
 // Static first-run mode: no initial-run ports, still the issuer.
 const fixed=composePreparedRunBindings(b,undefined);
 assert.equal(fixed.issuer,b.issuer);
 assert.equal(Object.hasOwn(fixed,'initialBindings'),false);
 assert.equal(Object.hasOwn(fixed,'prepareInitial'),false);
});

test('a bindings owner without an issuer or admission port refuses instead of composing a partial router',()=>{
 for(const broken of [undefined,null,{...bindings(),issuer:undefined},{...bindings(),issuer:null},{...bindings(),admissionForBinding:undefined}]){
  assert.throws(()=>composePreparedRunBindings(broken,undefined),/PREPARED_CANDIDATE_REFUSED/);
 }
});
