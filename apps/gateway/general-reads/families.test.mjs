/** Existing typed family constructors through current execution and ordinary Core HTTP. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createGeneralReadFamilyHandlers,GENERAL_READ_ADAPTER_FAMILIES} from './integration.mjs';
import {familyCase} from './test/family-cases.mjs';
import {fixture} from '../../runtime/test/reads-native-fixture.mjs';
const cases=[['meeting-source','meeting.list_upcoming_meetings'],['meeting-source','meeting.query_debriefs'],['meeting-source','meeting.read_client_meetings'],['action-items-complete','actions.query'],['operational-reads','query_tasks'],['operational-reads','query_action_items'],['tenant-contacts','find_contacts'],['entity-candidates','resolve_entity'],['client-knowledge-profile','get_client_context'],['client-documents','read_client_documents'],['dataset-metadata','list_global_datasets']];
for(const [family,id] of cases){
 test(`${id}: actual ordinary owner returns canonical typed result`,async()=>{const f=await fixture(family,id,{scene:familyCase(family,id)}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,family==='dataset-metadata'?0:1);const out=JSON.parse((await r.json()).resultJson);assert(out&&typeof out==='object');});
 if(family!=='dataset-metadata')for(const mode of ['deny','revoke'])test(`${id}: ${mode} withholds source content`,async()=>{const f=await fixture(family,id,{scene:familyCase(family,id)});if(mode==='deny')f.deny();else f.scene.state.afterSource=f.revoke;const r=await f.execute();assert.equal(r.status,403,await r.clone().text());});
}
test('finite family registration stays inert and rejects unknown fields and accessors',async()=>{
 assert.equal(GENERAL_READ_ADAPTER_FAMILIES.length,48);assert.equal((await createGeneralReadFamilyHandlers({families:{},now:Date.now,newId:()=>''})).size,0);
 assert.throws(()=>createGeneralReadFamilyHandlers({families:{'florida-budget':{}},now:Date.now,newId:()=>''}));
 let touched=0;assert.throws(()=>createGeneralReadFamilyHandlers({families:{'operational-reads':{get origin(){touched++;return 'https://example.invalid';}}},now:Date.now,newId:()=>''}));assert.equal(touched,0);
});
