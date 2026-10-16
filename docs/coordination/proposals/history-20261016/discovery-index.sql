-- LOCAL PROPOSAL M-L3-INDEX. No migration number allocated; never executed by this lane.
-- Optional discovery query support. Existing 0001/0009 schemas suffice for correctness.
CREATE INDEX conversations_owner_created_cursor
 ON meri_conversations.conversations
 (tenant_id,owner_actor_id,((projection->>'createdAt')) DESC,conversation_id DESC);
