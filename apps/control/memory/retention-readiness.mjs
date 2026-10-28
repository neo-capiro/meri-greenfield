/** Memory admission requires every durable payload owner and its erasure guards. */
const owners=Object.freeze([
 {name:'meri_memory.candidates',columns:['candidate','candidate_purged_at'],guards:['candidates_immutable','candidates_no_delete','expired_memory_payload']},
 {name:'meri_commands.approval_metadata',columns:['payload'],guards:['conversation_tombstone']},
 {name:'meri_commands.command_journal',columns:['payload','outcome'],guards:['conversation_tombstone']},
 {name:'meri_intents.preparations',columns:['outcome','outcome_purged_at'],guards:['immutable_preparation','preparations_no_truncate']},
]);
export const MEMORY_TABLES=Object.freeze(owners.map(owner=>owner.name));
export async function assertMemoryRetentionSchema(pool){
 const result=await pool.query(`SELECT required.name,
   to_regclass(required.name) IS NOT NULL
   AND has_table_privilege(to_regclass(required.name),'SELECT') AND has_table_privilege(to_regclass(required.name),'INSERT')
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(required.columns) AS col(name)
     WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass(required.name) AND a.attname=col.name AND NOT a.attisdropped)
       OR NOT has_column_privilege(to_regclass(required.name),col.name,'UPDATE'))
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(required.guards) AS guard(name)
     WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass(required.name) AND t.tgname=guard.name AND t.tgenabled IN ('O','A')))
   AS ready FROM jsonb_to_recordset($1::jsonb) AS required(name text,columns jsonb,guards jsonb)`,[JSON.stringify(owners)]);
 if(result.rows.length!==owners.length||owners.some(owner=>!result.rows.some(row=>row.name===owner.name&&row.ready===true)))
  throw Object.assign(new Error('MEMORY_SCHEMA_UNAVAILABLE'),{code:'MEMORY_SCHEMA_UNAVAILABLE'});
}
