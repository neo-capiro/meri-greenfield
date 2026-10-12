import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createCertificationStatusValidators} from '../retrieval-0.2/certification-status-validation.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/certification-status.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape=(name,value)=>{const check=checks.get(name);assert.ok(check(value),ajv.errorsText(check.errors));return value;};
const {normalizeCertificationStatusInput:normalize,assertCertificationStatusOutput:check}=createCertificationStatusValidators({validateShape,schema});
const MARKETPLACE_URL=schema.$defs.CertificationMarketplaceUrl.const,NOW='2026-10-12T17:00:00.000Z';
const context=(comparisonLocale='en-US')=>({comparisonLocale});
const input=(query='Synthetic')=>({program:'fedramp',query});
const base=()=>({tool:'get_certification_status',program:'fedramp',searchedEntireDataset:true});
const record=(productId='FR123')=>({program:'fedramp',productId,cspName:'Synthetic CSP',csoName:'Synthetic Cloud',status:'FedRAMP Certified',impactLevel:'Moderate',authorizationDate:null,sponsoringAgencies:[],sourceUrl:MARKETPLACE_URL,observedAt:NOW});
const single=()=>({...base(),found:true,ambiguous:false,record:record()});
const absent=()=>({...base(),found:false,evidenceOfAbsence:true,note:schema.$defs.CertificationStatusAbsent.properties.note.const,sourceUrl:MARKETPLACE_URL,observedAt:NOW});
const ambiguous=(count=2)=>({...base(),found:true,ambiguous:true,candidateCount:count,candidates:Array.from({length:Math.min(count,10)},(_,i)=>record(`FR${123+i}`)),note:schema.$defs.CertificationStatusAmbiguous.properties.note.const});

test('program selector is exact and required, never defaulted or aliased',()=>{
 for(const raw of [{query:'x'},{program:null,query:'x'},{program:'FedRAMP',query:'x'},{program:'fisma',query:'x'},{program:'fedramp ',query:'x'}])assert.throws(()=>normalize(raw,context()));
});
test('query trims only; no inherited240-character truncation or lowercase mutation',()=>{
 assert.deepEqual(normalize(input('  Mixed Case  '),context()),input('Mixed Case'));
 assert.equal(normalize(input('A'.repeat(300)),context()).query.length,300);
 const page=single();page.record.csoName='A'.repeat(300);check(page,input('A'.repeat(300)),context());
});
test('missing, blank and non-string query refuse instead of creating a dataset miss',()=>{
 for(const raw of [{program:'fedramp'},input(null),input(''),input(' \n '),input(1),input(false)])assert.throws(()=>normalize(raw,context()));
});
test('model selectors cannot inject source authority, locale or alternate provider',()=>{
 for(const key of ['comparisonLocale','tenantId','authorized','sourceUrl','limit','searchedEntireDataset'])assert.throws(()=>normalize({...input(),[key]:'x'},context()));
});
test('explicit canonical comparison locale is required and closed',()=>{
 for(const c of [undefined,null,{},[],{comparisonLocale:1},{comparisonLocale:'en-us'},{comparisonLocale:'en_US'},{comparisonLocale:'en-US',nowMs:1}])assert.throws(()=>normalize(input(),c));
 assert.deepEqual(normalize(input(),context('tr-TR')),input());
});
test('all three raw snapshot variants round-trip without caller mutation',()=>{
 for(const page of [single(),ambiguous(),absent()]){const before=structuredClone(page);assert.equal(check(page,input(),context()),page);assert.deepEqual(page,before);}
});
test('canonical but unsupported locale is an explicit new context refusal',()=>{
 assert.deepEqual(Intl.getCanonicalLocales('zz-ZZ'),['zz-ZZ']);
 assert.throws(()=>normalize(input(),context('zz-ZZ')));
 for(const locale of ['en-US','tr-TR','de-DE'])assert.deepEqual(normalize(input(),context(locale)),input());
});
test('exact product ID takes precedence without requiring query in names',()=>{
 const page=single();page.record.cspName='Other CSP';page.record.csoName='Other Cloud';check(page,input(' fr123 '),context());
});
test('a non-exact single record must match a returned owner name',()=>{
 const page=single();assert.throws(()=>check(page,input('Unrelated'),context()));
 page.record.cspName='A sought owner';check(page,input('SOUGHT'),context());
 page.record.cspName='Other';page.record.csoName='The sought cloud';check(page,input('SOUGHT'),context());
});
test('single record permits ID-looking name query when that ID is not the returned product',()=>{
 const page=single();page.record.cspName='Vendor FR999';check(page,input('FR999'),context());
});
test('an observable exact ID makes ambiguous output impossible under pinned precedence',()=>{
 const page=ambiguous();page.candidates.forEach(r=>r.csoName='FR123 names');assert.throws(()=>check(page,input('fr123'),context()));
});
test('every ambiguous row must match a name when no returned exact ID matches',()=>{
 const page=ambiguous();page.candidates[1].cspName='Other';page.candidates[1].csoName='Other';assert.throws(()=>check(page,input(),context()));
});
test('locale-sensitive matching is explicit for Turkish I, not host-selected',()=>{
 const page=single();page.record.cspName='I';page.record.csoName='Other';
 check(page,input('ı'),context('tr-TR'));assert.throws(()=>check(page,input('ı'),context('en-US')));
 check(page,input('i'),context('en-US'));assert.throws(()=>check(page,input('i'),context('tr-TR')));
});
test('ambiguity retains full matched count with an exact first-ten window',()=>{
 check(ambiguous(15),input(),context());
 for(const mutate of [p=>p.candidateCount=1,p=>p.candidateCount=1.5,p=>p.candidates.pop(),p=>p.candidates.push(record('FR999')),p=>p.candidateCount=11]){const p=ambiguous();mutate(p);assert.throws(()=>check(p,input(),context()));}
 const p=ambiguous(15);p.candidates.pop();assert.throws(()=>check(p,input(),context()));
});
test('duplicate parsed product IDs are not silently deduplicated or treated as one match',()=>{
 const page=ambiguous();page.candidates[1]=structuredClone(page.candidates[0]);check(page,input(),context());
});
test('ambiguity cannot choose a record or claim absence',()=>{
 for(const mutate of [p=>p.record=record(),p=>p.evidenceOfAbsence=true,p=>p.found=false,p=>delete p.note]){const p=ambiguous();mutate(p);assert.throws(()=>check(p,input(),context()));}
});
test('single branch cannot invent matched totals or carry unresolved candidates',()=>{
 for(const key of ['candidateCount','candidates','evidenceOfAbsence','note']){const page=single();page[key]=key==='candidates'?[record()]:1;assert.throws(()=>check(page,input(),context()));}
});
test('all six status and five impact strings remain source vocabularies without synonym upgrades',()=>{
 for(const status of schema.$defs.CertificationStatusVocabulary.enum)for(const impactLevel of schema.$defs.CertificationImpactVocabulary.enum){const p=single();Object.assign(p.record,{status,impactLevel});check(p,input(),context());}
 for(const [key,value]of [['status','Authorized'],['status','FedRAMP Ready'],['status','FedRAMP certified'],['impactLevel','medium'],['impactLevel','moderate']]){const p=single();p.record[key]=value;assert.throws(()=>check(p,input(),context()));}
});
test('record values are preserved without inventing authorization-date/status relationships',()=>{
 const page=single();page.record.status='Unknown';page.record.authorizationDate='2030-01-01T12:30:00.000Z';check(page,input(),context());
 page.record.status='FedRAMP Certified';page.record.authorizationDate=null;check(page,input(),context());
});
test('parsed product IDs require literal uppercase FR digits, no arbitrary canonical ID',()=>{
 for(const id of ['fr123','FR','FRabc',' FR123','FR123x']){const p=single();p.record.productId=id;assert.throws(()=>check(p,input(),context()));}
 const page=single();page.record.productId='FR000';check(page,input(),context());
});
test('names and sponsoring agencies preserve parser truthiness and duplicates',()=>{
 const page=single();page.record.cspName=' ';page.record.csoName=' ';page.record.sponsoringAgencies=['Agency','Agency',' '];check(page,input('FR123'),context());
 for(const mutate of [p=>p.record.cspName='',p=>p.record.sponsoringAgencies.push(''),p=>p.record.sponsoringAgencies.push(null)]){const p=single();mutate(p);assert.throws(()=>check(p,input(),context()));}
});
test('snapshot provenance points to the pinned marketplace and a canonical timestamp',()=>{
 for(const mutate of [p=>p.record.sourceUrl='https://example.test/',p=>p.record.observedAt='2026-10-12',p=>p.record.authorizationDate='2016-12-31T23:59:60Z',p=>p.record.observedAt='2026-10-12T17:00:00Z']){const p=single();mutate(p);assert.throws(()=>check(p,input(),context()));}
});
test('one returned ambiguous page cannot mix observation timestamps',()=>{
 const page=ambiguous();page.candidates[1].observedAt='2026-10-12T17:00:01.000Z';assert.throws(()=>check(page,input(),context()));
});
test('absence is a snapshot assertion with exact caveat, not a current negative grant',()=>{
 check(absent(),input('Not in observed source'),context());
 for(const mutate of [p=>p.evidenceOfAbsence=false,p=>p.searchedEntireDataset=false,p=>p.currentVerified=true,p=>p.note='Not certified',p=>p.record=record()]){const p=absent();mutate(p);assert.throws(()=>check(p,input(),context()));}
});
test('optional no-match provenance may be omitted together without invented clock/source keys',()=>{
 const page=absent();delete page.sourceUrl;delete page.observedAt;check(page,input(),context());
 page.sourceUrl=MARKETPLACE_URL;assert.throws(()=>check(page,input(),context()));delete page.sourceUrl;page.observedAt=NOW;assert.throws(()=>check(page,input(),context()));
});
test('no query/generatedAt echo or authority wrapper is introduced on any branch',()=>{
 for(const fixture of [single,absent,ambiguous])for(const key of ['query','generatedAt','binding','subject','verified','completeCoverage']){const p=fixture();p[key]='invented';assert.throws(()=>check(p,input(),context()));}
});
test('program discriminators and searched-dataset markers stay exact on records/envelopes',()=>{
 for(const mutate of [p=>p.program='other',p=>p.record.program='other',p=>p.tool='get_status',p=>p.searchedEntireDataset=false]){const p=single();mutate(p);assert.throws(()=>check(p,input(),context()));}
});
test('transport admission refuses excessive data rather than truncating a selected name',()=>{
 assert.throws(()=>normalize(input('x'.repeat(1048577)),context()));
 const page=single();page.record.sponsoringAgencies=Array(10001).fill('A');assert.throws(()=>check(page,input(),context()));
});
test('inert admission rejects accessor, proxy and coercion payloads without effects',()=>{
 let calls=0;assert.throws(()=>normalize({program:'fedramp',get query(){calls++;return'x';}},context()));
 assert.throws(()=>normalize(input(),{get comparisonLocale(){calls++;return'en-US';}}));
 assert.throws(()=>normalize(new Proxy({}, {ownKeys(){calls++;return[];}}),context()));
 assert.throws(()=>normalize(input({toString(){calls++;return'x';}}),context()));assert.equal(calls,0);
});
test('outputs reject cycles, unknown nested fields and nonfinite data',()=>{
 const p=single();p.record.self=p;assert.throws(()=>check(p,input(),context()));
 const a=ambiguous();a.candidateCount=Infinity;assert.throws(()=>check(a,input(),context()));
 const extra=single();extra.record.authorizationVerified=true;assert.throws(()=>check(extra,input(),context()));
});

test('parsed FR identifier cannot hide a trailing line terminator behind a name match',()=>{
 for(const suffix of ['\n','\r','\r\n','\u2028','\u2029']){const page=single();page.record.productId='FR123'+suffix;assert.throws(()=>check(page,input(),context()));}
});
