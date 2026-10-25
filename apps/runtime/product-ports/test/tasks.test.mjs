import test from 'node:test';
import assert from 'node:assert/strict';
import {createTasksFamily} from '../tasks.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {standaloneFixture} from '../../native-authority/test/standalone-tasks-fixture.mjs';
function fixture({enabled=true,sourceEnabled=true,core=true,gate=true}={}){
 const f=standaloneFixture();
 const context={...f.context,configuration:{...f.context.configuration,sourceEnabled,intents:{enabled,...(enabled&&core?{core:{origin:'https://core.invalid',serviceSecretFile:'C:/synthetic/service-secret'}}:{})}},client:{},native:{call(){assert.fail('No provider call');}},canonicalProductPorts:captureRuntimePorts(gate?{conversationMembership:{admit(){assert.fail('Not a model invocation');},recheck(){}}}:{})};
 return {...f,context,factory:createTasksFamily(context).ports.taskCommandApplicationFactory};
}
for(const options of [{enabled:false},{sourceEnabled:false},{core:false},{gate:false}])test('native tasks stay disabled when required composition is absent '+JSON.stringify(options),()=>{
 const f=fixture(options);assert.equal(f.factory.state(),'disabled');assert.equal(f.factory.create({sessions:{}}),null);assert.equal(f.sql.state.connects,0);
});
test('existing task factory mounts initial-binding preparation with actual shared native owners',async()=>{
 const f=fixture();assert.equal(f.factory.state(),'composed');assert.equal(f.sql.state.connects,0);
 const app=f.factory.create({sessions:f.sessions,conversationStore:f.store,retention:f.retention});assert.equal(f.sql.state.connects,0);
 const response=await app.handle(f.request('prepare',f.raw));assert.equal(response.status,200,await response.clone().text());assert.equal(f.metadata.rows.size,1);assert.equal(f.state.effects,0);
 assert.throws(()=>f.factory.create({sessions:f.sessions}));
});
