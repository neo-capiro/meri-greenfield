/** SYNTHETIC SDK MCP transport to real control task-update preparation and native HTTP serialization. */
import test from 'node:test';import assert from 'node:assert/strict';
import {intentFixture,mountIntents} from './fixture.mjs';
test('owner-backed task update is listed, returns a private task-update proposal and requires exact approval',async()=>{
 const f=intentFixture({action:'task.update'}),m=await mountIntents(f);
 try{
  assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name),['propose_task_update']);
  const response=await m.call('propose_task_update',{operation:'update_task',arguments:{taskId:'00000000-0000-4000-8000-000000000021',title:'Updated',status:'open'}});
  assert.equal(response.isError,undefined);const {proposal}=JSON.parse(response.content[0].text);
  assert.equal(proposal.command.action,'task.update');assert.equal(proposal.command.contractVersion,'0.2.0');
  assert.equal(f.sql.rows.size,1);assert.equal(m.runtime.receipts()[0].outcome,'prepared');
 }finally{await m.close();}
});
