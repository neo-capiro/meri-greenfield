/** One immutable-custody read, shared by the schedule owner and the retention-held serving lease. */
export const SCHEDULED_ORIGIN_SQL="SELECT tenant_id,generation,occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences WHERE tenant_id=$1 AND effect->'binding'->>'conversationId'=$2 LIMIT 2";
