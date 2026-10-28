import {decodeRunCursor,encodeRunCursor} from './cursor.mjs';
import {projectRunRow} from './projection.mjs';
import {refuse} from '../../product-access/errors.mjs';
const select=`SELECT to_jsonb(c) AS conversation_row,to_jsonb(r) AS run_row,to_jsonb(e) AS status_row
 FROM meri_conversations.runs r JOIN meri_conversations.conversations c USING(tenant_id,conversation_id)
 LEFT JOIN LATERAL (SELECT * FROM meri_conversations.events e WHERE e.tenant_id=r.tenant_id AND e.conversation_id=r.conversation_id AND e.run_id=r.run_id
  AND e.event->>'type'='run.status' ORDER BY e.sequence DESC LIMIT 1) e ON true
 WHERE r.tenant_id=$1 AND c.owner_actor_id=$2
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.projection->'scopes') s WHERE s->>'kind'='client' AND NOT (s->>'resourceId'=ANY($3::text[])))`;
/** Query the durable run table directly. No conversation-page accumulation or second inventory writer. */
export function createRunIndexStore({tx}){
 async function list({principal,request},check){
  if(request.scope.kind==='client'&&!principal.clientIds.includes(request.scope.clientId))refuse('ACCESS_DENIED');
  const before=decodeRunCursor(principal,request);
  return tx({tenantId:principal.tenantId,conversationId:'run-index:'+principal.actorId},check,async c=>{
   const rows=(await c.query(select+`
    AND ($4='all' OR ($4='general' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.projection->'scopes') s WHERE s->>'kind'='client'))
     OR ($4='client' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.projection->'scopes') s WHERE s->>'kind'='client' AND s->>'resourceId'=$5)))
    AND ($6='all' OR ($6='terminal')=(r.projection->>'state' IN ('completed','failed','cancelled')))
    AND ($7::timestamptz IS NULL OR ((r.projection->>'createdAt')::timestamptz,r.run_id,r.conversation_id)<($7::timestamptz,$8::uuid,$9::uuid))
    ORDER BY (r.projection->>'createdAt')::timestamptz DESC,r.run_id DESC,r.conversation_id DESC LIMIT $10`,
    [principal.tenantId,principal.actorId,principal.clientIds,request.scope.kind,request.scope.clientId??null,request.status,before?.createdAt??null,before?.runId??null,before?.conversationId??null,request.limit+1])).rows;check();
   const selected=rows.slice(0,request.limit).map(row=>projectRunRow(row,principal));
   const last=selected.at(-1)?.summary,nextCursor=rows.length>request.limit?encodeRunCursor(principal,request,{createdAt:last.createdAt,runId:last.runId,conversationId:last.conversationId}):null;
   return {entries:selected,nextCursor};
  });
 }
 async function detail({principal,request},check){return tx({tenantId:principal.tenantId,conversationId:request.conversationId},check,async c=>{
  const rows=(await c.query(select+' AND r.conversation_id=$4 AND r.run_id=$5',[principal.tenantId,principal.actorId,principal.clientIds,request.conversationId,request.runId])).rows;check();
  if(rows.length!==1)refuse('RUN_INDEX_NOT_FOUND');return projectRunRow(rows[0],principal);
 });}
 return Object.freeze({list,detail});
}
