/** Real control HTTP -> execution -> current Core authority -> native handler.
 * Source transport is synthetic. No provider, quota, upsert, model or DB is called. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,uuid} from './reads-native-fixture.mjs';
import {storedCase,billKey} from '../../gateway/sources/state-status-votes/test/fixture.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';

async function selectedFixture({skill=selectSkill('quick_skill.bill_watch','1.1.0').pin,mutate,unavailable=false,...options}={}){
 let f;const conversationStore={async read(){if(unavailable)throw Error('SYNTHETIC_STORE_UNAVAILABLE');
  const value={run:{binding:f.binding,scopes:f.scopes,state:'running'},request:{skill}};mutate?.(value);return value;
 },async appendSource(){assert.fail('status is not a source publication');}};
 const scene=storedCase('get_state_bill_status',options),subject=scene.authority.subject;
 if(!options.privateUser){subject.kind='client';subject.entityType='client';subject.entityIds=[uuid('d')];
  subject.scopes=[{...subject.scopes[0],kind:'client',resourceId:uuid('d')}];}
 f=await fixture('state-status-votes','get_state_bill_status',{scene,conversationStore,...options});return f;
}
const dispatched=f=>f.calls.filter(path=>path==='/api/clio/tools/get_state_bill_status').length;

for(const args of [{},{billId:null},{billId:'TX HB 1234'},{billId:'hb1234',state:'TX'},{query:billKey},{billId:'hr1'},{billId:'ca-2025-ab1',state:'TX'},{billId:billKey,tenantId:'foreign'},{billId:{key:billKey}},{billId:'TX-2025-HB1234'}])
 test(`selected Bill Watch refuses noncanonical/foreign arguments before native dispatch: ${JSON.stringify(args)}`,async()=>{
  const f=await selectedFixture();const response=await f.execute(args);assert.equal(response.status,400,await response.clone().text());assert.equal(dispatched(f),0);assert.equal(f.scene.wire.length,0);
 });

for(const options of [{},{request:{billId:'tx-2025-hb9999'},nativeOutcome:'absent'},{request:{billId:'ca-2025-ab9999'},nativeOutcome:'absent'}])
 test(`selected canonical status dispatch preserves stored found/absent outcome: ${JSON.stringify(options)}`,async()=>{
  const f=await selectedFixture(options);const response=await f.execute();assert.equal(response.status,200,await response.clone().text());assert.equal(dispatched(f),1);assert.equal(f.scene.wire.length,1);
  assert.deepEqual(f.scene.wire[0].body,f.scene.contract.normalizeInput(f.scene.arguments,{}).input);
  const result=JSON.parse((await response.json()).resultJson).result;assert.equal(result.found,options.nativeOutcome!=='absent');
 });

for(const [name,mutate]of [
 ['wrong binding',s=>{s.run.binding={...s.run.binding,runId:'11111111-1111-4111-8111-111111111111'};}],
 ['wrong scopes',s=>{s.run.scopes=[];}],['terminal run',s=>{s.run.state='completed';}],
 ['missing selection field',s=>{delete s.request.skill;}],['missing pin',s=>{s.request.skill={skillId:'quick_skill.bill_watch',skillVersion:'1.1.0'};}],
 ['tampered pin',s=>{s.request.skill={...s.request.skill,manifestSha256:'0'.repeat(64)};}],
 ['unknown version',s=>{s.request.skill={...s.request.skill,skillVersion:'9.0.0'};}],
 ['foreign skill identity',s=>{s.request.skill={...s.request.skill,skillId:'quick_skill.mail_history'};}],
 ])test(`persisted ${name} refuses instead of taking the generic designation path`,async()=>{
  const f=await selectedFixture({mutate});const response=await f.execute({billId:'TX HB 1234'});assert.equal(response.status,403,await response.clone().text());assert.equal(dispatched(f),0);
 });

test('unavailable persisted selection fails closed, without a source attempt',async()=>{const f=await selectedFixture({unavailable:true});assert.equal((await f.execute()).status,503);assert.equal(dispatched(f),0);});
test('selected Bill Watch requires the current selected client',async()=>{const f=await selectedFixture({privateUser:true});assert.equal((await f.execute()).status,403);assert.equal(dispatched(f),0);});
for(const skill of [null,selectSkill('quick_skill.bill_watch','1.0.1').pin])test('ordinary and exact old Bill selection retain designation behavior',async()=>{
 const f=await selectedFixture({skill,request:{billId:'TX HB 1234'}});const response=await f.execute();assert.equal(response.status,200,await response.clone().text());assert.equal(dispatched(f),1);
});
