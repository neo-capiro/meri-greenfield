/** The actual data-access reader, routes and product HTTP application over a SYNTHETIC policy resolver and membership gate. Real
 * handler output is fed to the public receiver; hostile mutations of it are refused. No PostgreSQL, Core, runtime mount or deployment. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {receiveDataAccessRequest as request,receiveDataAccessResponse as receive,DataAccessResponseError,dataAccessMetadata} from '../dist/data-access-application.mjs';
import {createDataAccessReader} from '../../../apps/control/data-access/reader.mjs';
import {createDataAccessRoutes} from '../../../apps/control/data-access/http.mjs';
import * as protocol from '../../../apps/control/data-access/protocol.mjs';
import {createProductApplication} from '../../../apps/control/product-access/http.mjs';
import {ProductError} from '../../../apps/control/product-access/errors.mjs';
import {familyReads} from '../../../apps/worker/conversation/reads/availability.mjs';
const NOW=Date.UTC(2026,10,1,12),CLIENT='00000000-0000-4000-8000-000000000901',rows=familyReads(),ops=family=>rows.filter(row=>row.family===family).map(row=>row.operation);
const clone=value=>structuredClone(value),refused=code=>e=>e instanceof DataAccessResponseError&&e.code===code;
function setup({policy='on'}={}){
 const installed=[...ops('mail'),...ops('capiro-data-v5'),...ops('action-items-complete')];
 const reader=createDataAccessReader({installed,now:()=>NOW,async policyForActor(){if(policy==='down')throw Error('synthetic');return policy==='on'?{generalReads:true,readFamilies:['mail','capiro-data-v5','action-items-complete'],activeReadOperations:installed}:null;}});
 const principal={tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[CLIENT],membershipRevision:'m1'};
 const gate={async admit({credential}){if(credential!=='token')throw new ProductError('ACCESS_DENIED');return {principal,expiresAtMs:NOW+60000};},async recheck({principal}){return principal;}};
 const app=createProductApplication({gate,now:()=>NOW,limits:{maxRequestMs:5000,maxRequestBytes:1024,maxResponseBytes:1048576},routes:createDataAccessRoutes({reader})});
 async function exchange(body,{token='token'}={}){
  const response=await app.handle(new Request('http://127.0.0.1'+protocol.DATA_ACCESS_PATH,{method:'POST',headers:{'content-type':'application/json',...(token===null?{}:{authorization:'Bearer '+token})},body:JSON.stringify(body)}));
  const text=await response.text();return {status:response.status,text,json:JSON.parse(text),admitted:receive(response.status,text,body)};
 }
 return {app,exchange};
}

test('actual answers for a client and General are admitted; the page is frozen and describes the registry',async()=>{
 const s=setup(),client=await s.exchange({clientId:CLIENT});assert.equal(client.status,200);
 assert.equal(client.admitted.schemaVersion,'meri.data-access/1');assert.equal(client.admitted.clientId,CLIENT);assert.equal(client.admitted.generalReads,true);
 const by=Object.fromEntries(client.admitted.families.map(row=>[row.family,row]));
 assert.equal(by.mail.state,'available');assert.equal(by.mail.requires,'mailbox');assert.equal(by['action-items-complete'].state,'available');assert.equal(by['federal-legislation'].state,'not_installed');
 assert(client.admitted.relations.every(r=>r.state==='available'));assert(Object.isFrozen(client.admitted)&&Object.isFrozen(client.admitted.families[0]));
 const general=await s.exchange({clientId:null});assert.equal(general.admitted.clientId,null);
 assert.equal(Object.fromEntries(general.admitted.families.map(row=>[row.family,row]))['action-items-complete'].state,'client_required');
 assert(general.admitted.relations.filter(r=>r.source==='client_records').every(r=>r.state==='client_required'));
 const off=await setup({policy:null}).exchange({clientId:null});assert.equal(off.admitted.generalReads,false);assert(off.admitted.families.every(r=>['policy_off','not_installed'].includes(r.state)));
});
test('hostile pages refuse: another client, repeated or unsorted family, repeated relation, available while reads are off, invented state or authority',async()=>{
 const s=setup(),page=await s.exchange({clientId:CLIENT});
 for(const [name,mutate] of Object.entries({
  'another client':v=>{v.clientId=null;},'repeated family':v=>{v.families.push(clone(v.families[0]));},'unsorted families':v=>{v.families.reverse();},
  'repeated relation':v=>{v.relations.push(clone(v.relations[0]));},'available while off':v=>{v.generalReads=false;},'invented state':v=>{v.families[0].state='granted';},
  'authority':v=>{v.authorized=true;},'policy control':v=>{v.families[0].enable=true;},'unknown requirement':v=>{v.families[0].requires='crm';}}))
  {const value=clone(page.json);mutate(value);assert.throws(()=>receive(200,JSON.stringify(value),{clientId:CLIENT}),refused(/^(?:another client|available while off|repeated|unsorted)/u.test(name)?'DATA_ACCESS_CORRELATION':'DATA_ACCESS_SHAPE'),name);}
 assert.throws(()=>receive(200,page.text,{clientId:null}),refused('DATA_ACCESS_CORRELATION'),'an answer for another captured request');
 assert.throws(()=>receive(201,page.text,{clientId:CLIENT}),refused('DATA_ACCESS_SHAPE'));
});
test('actual error bodies are admitted against the closed table; a request the contract refuses never leaves',async()=>{
 const s=setup();
 assert.throws(()=>request(JSON.stringify({clientId:'x'})),refused('DATA_ACCESS_SHAPE'));assert.throws(()=>request(JSON.stringify({})),refused('DATA_ACCESS_SHAPE'));
 assert.deepEqual(request(JSON.stringify({clientId:null})),{clientId:null});
 const refused403=await s.exchange({clientId:'00000000-0000-4000-8000-000000000902'});assert.equal(refused403.status,403);assert.deepEqual(refused403.admitted,{error:{code:'DATA_ACCESS_CLIENT_REFUSED',field:'clientId'}});
 const unauthenticated=await s.exchange({clientId:null},{token:null});assert.equal(unauthenticated.status,401);assert.equal(unauthenticated.admitted.error.code,'UNAUTHENTICATED');
 const down=await setup({policy:'down'}).exchange({clientId:null});assert.equal(down.status,503);assert.deepEqual(down.admitted,{error:{code:'DATA_ACCESS_POLICY_UNAVAILABLE'}});
 assert.throws(()=>receive(404,JSON.stringify({error:{code:'DATA_ACCESS_CLIENT_REFUSED'}}),{clientId:null}),refused('DATA_ACCESS_STATUS'),'a status that does not match the closed table');
 assert.deepEqual(receive(503,JSON.stringify({error:{code:'DATA_ACCESS_UNAVAILABLE',outcome:'NOT_DISPATCHED'}}),{clientId:null}),{error:{code:'DATA_ACCESS_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},'the fixed mount answer while the family is not composed is admitted');
});
test('metadata and the distribution describe the canonical route and nothing more',async()=>{
 assert.deepEqual(dataAccessMetadata.routes,{read:{method:'POST',path:protocol.DATA_ACCESS_PATH,response:'json'}});assert.deepEqual(dataAccessMetadata.errorStatuses,protocol.DATA_ACCESS_ERROR_STATUSES);
 assert.deepEqual(dataAccessMetadata.states,['not_installed','policy_off','client_required','available']);assert.equal(dataAccessMetadata.errorStatuses.DATA_ACCESS_UNAVAILABLE,503);assert.deepEqual(dataAccessMetadata.requirements,['mailbox']);assert(Object.isFrozen(dataAccessMetadata));
 const source=await readFile(new URL('../dist/data-access-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/data-access-application.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.browserImports,[]);assert(!/(?:^|\n)\s*import\s/u.test(source));
 for(const path of ['../../apps/control/data-access/protocol.mjs','../../apps/control/data-access/reader.mjs','../../apps/control/data-access/http.mjs','../../apps/runtime/product-ports/data-access.mjs','../../apps/worker/conversation/reads/families.mjs'])assert(metadata.sources.some(s=>s.path===path),path);
 const schema=JSON.parse(await readFile(new URL('../dist/data-access-application.schema.json',import.meta.url),'utf8'));assert.equal(schema.$id,'urn:meri:data-access-application:0.1.0');assert(!/"\$ref":"(?!#)/u.test(JSON.stringify(schema)));
});
