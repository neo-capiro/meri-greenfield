-- Admit the existing canonical upload custody target. No content is erased by
-- installation; the retention owner still checks suppression, expiry and holds.
BEGIN;
ALTER TABLE meri_conversations.retention_purge_targets
 DROP CONSTRAINT retention_purge_targets_class_check;
ALTER TABLE meri_conversations.retention_purge_targets
 ADD CONSTRAINT retention_purge_targets_class_check CHECK (class IN (
  'sdkSession','meriMemoryCandidates','meriMemoryApprovalMetadata','meriMemoryCommandJournal',
  'meriMemoryIntentPreparations','conversation','events','lifecycle','completionCheckpoints',
  'nextRuns','selectedOutputs','nativeJournals','receipts','uploads'));
COMMIT;
