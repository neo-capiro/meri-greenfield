import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {automaticClientContextRequest,assembleAutomaticClientContext,releaseAutomaticClientContext} from '../automatic-client-context.mjs';
import {clientEvidenceFixture,operations,clientId,NOW,id,sections,profileFields} from '../../../gateway/sources/client-evidence/test/fixtures.mjs';
function fixture(){const f=clientEvidenceFixture(operations.profile,automaticClientContextRequest(clientId)),b=f.authority.binding;
 return {...f,call:{operation:f.operation,input:f.input,request:f.request,authority:f.authority,normalizationContext:f.normalizationContext},receipt:{identitySha256:'a'.repeat(64),principal:{tenantId:b.tenantId,actorId:b.actorId},identityRevision:'identity',conversationId:b.conversationId,selectedClientId:clientId,contextRevision:'context',checkedAtMs:NOW,expiresAtMs:NOW+9000}};}
const assemble=f=>assembleAutomaticClientContext({call:f.call,result:f.page,contextReceipt:f.receipt},()=>NOW);
test('compact automatic packet carries six canonical sections, complete-empty vs unavailable, source digest and unchanged input',()=>{
 const f=fixture(),before=structuredClone(f.call),c=f.page.profileSections.facilities;Object.assign(c,{status:'unavailable',total:null,truncated:null,error:'section_unavailable'});
 const packet=assemble(f),value=JSON.parse(packet.packetJson);assert.deepEqual(Object.keys(value.sections),sections);assert.equal(value.sections.capabilities.coverage.total,0);assert.equal(value.sections.facilities.coverage.total,null);assert.equal(value.sections.facilities.coverage.status,'unavailable');assert.deepEqual(value.sections.facilities.records,[]);assert.equal(value.source.resultSha256,canonicalSha256(f.page));assert.equal(value.trust,'external_untrusted');assert.deepEqual(f.call,before);assert.equal(releaseAutomaticClientContext(packet,{...f.receipt,checkedAtMs:NOW+1},()=>NOW+1),packet);
});
test('all canonical partial rows, cursors and source references survive; packet never turns a bounded sample into complete inventory',()=>{
 const f=fixture(),rows=['a','b','c'].map(n=>({...profileFields('ProfileCapabilitiesSummary'),id:id(n)})),refs=rows.map(row=>({recordId:row.id}));
 f.page.profile.capabilities=rows;f.page.profileSources.capabilities=refs;Object.assign(f.page.profileSections.capabilities,{status:'partial',total:12,returned:3,truncated:true,nextCursor:Buffer.from(JSON.stringify({v:1,clientId,section:'capabilities',afterId:rows[2].id})).toString('base64url')});
 const value=JSON.parse(assemble(f).packetJson);assert.equal(value.sections.capabilities.coverage.total,12);assert.equal(value.sections.capabilities.records.length,3);assert.equal(value.sections.capabilities.coverage.truncated,true);assert.deepEqual(value.sections.capabilities.sources,refs);assert.match(value.coverageNote,/Unavailable or unrequested sections are not empty/);
});
test('malformed/missing sections, foreign client/tenant, stale source window and false completeness are refused by the canonical source validator',()=>{
 for(const change of [f=>delete f.page.profile.people,f=>f.page.context.client.id=id('8'),f=>f.page.context.client.tenantId=id('8'),f=>f.page.readWindow.startedAt=new Date(NOW-6000).toISOString(),f=>f.page.profileSections.people.total=null,f=>f.page.profileSections.people.status='not_requested']){const f=fixture();change(f);assert.throws(()=>assemble(f));}
});
test('automatic context refuses General, client substitution, noncompact reads and oversized data; signed request bytes are never rewritten',()=>{
 for(const change of [f=>f.receipt.selectedClientId=null,f=>f.receipt.selectedClientId=id('8'),f=>f.receipt.principal.actorId='foreign',f=>f.call.request={...f.call.request,limit:25},f=>f.page.context.client.name='x'.repeat(70000)]){const f=fixture();change(f);assert.throws(()=>assemble(f));}
 assert.throws(()=>automaticClientContextRequest(null));
});
test('release rechecks context revision, current identity, owner, time and exact assembly correlation',()=>{
 const f=fixture(),packet=assemble(f);for(const change of [r=>r.contextRevision='changed',r=>r.identityRevision='changed',r=>r.principal.actorId='foreign',r=>r.principal.tenantId='foreign',r=>r.conversationId=id('8'),r=>r.selectedClientId=id('8'),r=>r.checkedAtMs=NOW-1,r=>r.expiresAtMs=NOW+1]){const r=structuredClone(f.receipt);change(r);assert.throws(()=>releaseAutomaticClientContext(packet,r,()=>NOW+1));}
 assert.throws(()=>releaseAutomaticClientContext({...packet},f.receipt,()=>NOW));assert.throws(()=>releaseAutomaticClientContext(packet,{...f.receipt,expiresAtMs:NOW+20000},()=>NOW+10000));
});
