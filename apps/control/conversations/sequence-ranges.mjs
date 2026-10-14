/** A successor seals its predecessor's event range under the conversation lock.
 * Late controls may retain their receipts, but cannot append into a closed range. */
import {same,fail} from './boundary.mjs';
export async function closeSequenceRange(c,b,rowRun,check){
 const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows.map(rowRun);
 check();const latest=rows.sort((a,z)=>a.projection.binding.writerFence-z.projection.binding.writerFence).at(-1);
 if(!latest||!same(latest.projection.binding,b))fail('NEXT_RUN_NOT_LATEST');
 const end=Number(latest.sequence_base)+Number(latest.last_sequence);
 if(!Number.isSafeInteger(end)||end<1)fail('EVENT_LIMIT');
 if(latest.sequence_end!=null&&Number(latest.sequence_end)!==end)fail('STORE_CORRUPT');
 if(latest.sequence_end==null)await c.query('UPDATE meri_conversations.runs SET sequence_end=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,end]);
 check();return end;
}
