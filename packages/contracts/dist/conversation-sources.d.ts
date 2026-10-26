// Generated source provenance. Validation grants no authority or citation mapping.

export type BillTextSourceEnvelope =
  | BillTextSourceReadRequest
  | BillTextSourceReadResponse
  | NativeBillTextSourceEvent
  | HearingSourceReadRequest
  | HearingSourceReadResponse
  | NativeHearingSourceEvent
  | HearingMediaReadRequest
  | HearingMediaReadResponse;

export interface BillTextSourceReadRequest {
  schemaVersion: 'meri.bill-text-source-read/1';
  conversationId: string;
  runId: string;
  referenceId: string;
}
export interface BillTextSourceReadResponse {
  schemaVersion: 'meri.bill-text-source-read/1';
  event: NativeBillTextSourceEvent;
  current: {
    text: string;
    sourceModifiedAt: string | null;
    publishedAt: string | null;
    fetchedAt: string;
    coverage: {
      totalCharacters: number;
      pageComplete: true;
      contentComplete: boolean;
      paginationComplete: boolean;
      complete: boolean;
      truncated: boolean;
      nextCursor: string | null;
      locator: {
        offset: number;
        endOffset: number;
      };
    };
    sourceLocator: string | null;
    linkStatus: 'available' | 'unsafe';
  };
}
export interface NativeBillTextSourceEvent {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-bill-text';
  data: NativeBillTextSource;
}
export interface Canonical_RunBinding_84F2304C {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  attemptId: string;
  workerId: string;
  writerFence: number;
}
export interface Canonical_ScopeF882Edb5 {
  tenantId: string;
  kind: 'tenant' | 'client' | 'mailbox' | 'memory' | 'document' | 'private-user' | 'public';
  resourceId: string;
  policyRevision: string;
}
export interface NativeBillTextSource {
  schemaVersion: 'meri.native-bill-text-source/1';
  deliveryId: string;
  operation: {
    id: 'read_bill_text';
    version: '0.2.0';
  };
  requestSha256: string;
  argumentsSha256: string;
  resultSha256: string;
  executionSha256: string;
  policyRevision: string;
  source: {
    authoritativeOwner: 'federal_evidence_current';
    billId: string;
    versionCode: string;
    revisionId: string;
    packageId: string;
    provider: string;
    lineageKey: string;
    versionHash: string;
    textHash: string;
  };
  page: {
    offset: number;
    endOffset: number;
    totalCharacters: number;
    textSha256: string;
    pageComplete: true;
    contentComplete: boolean;
    paginationComplete: boolean;
    truncated: boolean;
  };
}
export interface HearingSourceReadRequest {
  schemaVersion: 'meri.hearing-source-read/1';
  conversationId: string;
  runId: string;
  referenceId: string;
}
export interface HearingSourceReadResponse {
  schemaVersion: 'meri.hearing-source-read/1';
  event: Canonical_NativeHearingSourceEvent_685F6175;
  current: {
    result: Canonical_PublicDomainHearingsOutputD5669Afb;
    sourceLocator: string | null;
    linkStatus: 'available' | 'unsafe';
  };
}
export interface Canonical_NativeHearingSourceEvent_685F6175 {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-hearing-record';
  data: Canonical_NativeHearingSourceF31B5A94;
}
export interface Canonical_NativeHearingSourceF31B5A94 {
  schemaVersion: 'meri.native-hearing-source/1';
  deliveryId: string;
  operation: {
    id: 'search_committee_hearings';
    version: '0.2.0';
  };
  requestSha256: string;
  argumentsSha256: string;
  resultSha256: string;
  executionSha256: string;
  policyRevision: string;
  source: {
    recordId: string;
    provenance: Canonical_HearingProvenanceBf0528Dd;
  };
  page: {
    part: number;
    format: 'json' | 'json_fragment';
    characterStart: number;
    characterEnd: number;
    totalCharacters: number;
    contentComplete: boolean;
    payloadSha256: string;
  };
  selection: {
    recordsView: 'published' | 'briefs' | 'reconciliation';
    hearingId: string;
    recordId: string;
    clientId: string | null;
    asOf: string | null;
    cursor: string | null;
  };
  coverage: Canonical_HearingCoverageCe9Cf8B6;
}
export interface Canonical_HearingProvenanceBf0528Dd {
  adapter: 'hearings';
  sourceTable:
    | 'committee_hearing'
    | 'official_hearing_transcript'
    | 'public_hearing_transcript_segment'
    | 'public_hearing_insight'
    | 'tenant_hearing_relevance'
    | 'published_legislative_record'
    | 'intel_hearing_record_briefs'
    | 'intel_hearing_record_reconciliation';
  sourceRecordId: string;
  hearingId: string | null;
  contentHash: string;
  sourceKey?: string;
  tenantId?: string;
  historical?: boolean;
}
export interface Canonical_HearingCoverageCe9Cf8B6 {
  requestedDomains: ['hearings'];
  /**
   * @maxItems 1
   */
  searchedDomains: [] | ['hearings'];
  requestedEntityCount: number;
  searchedEntityCount: number;
  recordsEvaluated: number;
  recordsReturned: number;
  paginationComplete: boolean;
  /**
   * @maxItems 1
   */
  unavailableSources: [] | ['hearings'];
  /**
   * @minItems 1
   * @maxItems 1
   */
  sources: [Canonical_HearingSourceCoverage_0301Fc6C];
  complete: false;
  stopReason: string;
}
export interface Canonical_HearingSourceCoverage_0301Fc6C {
  domain: 'hearings';
  sourceStatus: 'healthy' | 'degraded' | 'unavailable' | 'unauthorized' | 'unsupported' | 'error';
  total?: number;
  returned: number;
  recordsEvaluated: number;
  requestedEntityCount: number;
  searchedEntityCount: number;
  pagesRead: number;
  hasMore: boolean;
  nextCursor?: string;
  truncated: boolean;
  paginationComplete: boolean;
  coverageComplete: false;
  lastSyncAt?: string;
  stopReason: string;
}
export interface Canonical_PublicDomainHearingsOutputD5669Afb {
  tool: 'search_committee_hearings';
  coverage: Canonical_HearingCoverageCe9Cf8B6;
  note: 'One complete evidence chunk per page. Follow the hearings nextCursor for remaining official transcript chunks, machine segments and intelligence. Coverage reports unsupported browser-session material; search results never imply a complete transcript.';
  /**
   * @maxItems 1
   */
  records: [] | [Canonical_HearingRecordE97C5004];
  observability: Canonical_HearingObservabilityDb31267E;
}
export interface Canonical_HearingRecordE97C5004 {
  domain: 'hearings';
  recordId: string;
  occurredAt: string | null;
  updatedAt: string | null;
  payload:
    | Canonical_HearingEventPayload_50623205
    | Canonical_HearingOfficialPayload_3746C2F6
    | Canonical_HearingSegmentPayload_7E3Abba9
    | Canonical_HearingIntelligencePayload_1D38Af15
    | Canonical_HearingRelevancePayload_91F1E4Ae
    | Canonical_HearingJsonFragment_4256Cbb4
    | Canonical_HearingPublishedVersionB9155A63
    | Canonical_HearingPublishedBrief_85B11166
    | Canonical_HearingReconciliation_56F73D75;
  provenance: Canonical_HearingProvenanceBf0528Dd;
}
export interface Canonical_HearingEventPayload_50623205 {
  kind: 'hearing';
  id: string;
  title: string;
  committee: string;
  chamber: string;
  congress: number | null;
  date: string;
  startsAt: string | null;
  timezone: string;
  eventStatus: string;
  coverageStatus: string;
  sourceUrl: string | null;
  witnesses: string[];
  sourceRevision: number;
  lastOfficialUpdateAt: string | null;
  syncedAt: string;
}
export interface Canonical_HearingOfficialPayload_3746C2F6 {
  kind: 'official_transcript_chunk';
  id: string;
  hearingId: string | null;
  title: string;
  date: string;
  congress: number;
  chamber: string;
  sourceUrl: string;
  publishedAt: string | null;
  fetchedAt: string;
  text: string;
  characterStart: number;
  characterEnd: number;
  totalCharacters: number;
  chunkCount: number;
  textIsCompleteChunk: true;
  isOfficialTranscript: true;
}
export interface Canonical_HearingSegmentPayload_7E3Abba9 {
  kind: 'machine_transcript_segment';
  id: string;
  hearingId: string;
  captureId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel: string | null;
  speakerConfidence: number | null;
  transcriptionConfidence: number | null;
  hasGapBefore: boolean;
  revision: number;
  sourceUrl: string | null;
  isOfficialTranscript: false;
  captureStatus: string;
  transcriptGapSeconds: number;
}
export interface Canonical_HearingIntelligencePayload_1D38Af15 {
  kind: 'hearing_intelligence';
  id: string;
  hearingId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  insightType: string;
  title: string;
  summary: string;
  evidenceText: string | null;
  speakerName: string | null;
  confidence: number | null;
  preliminary: boolean;
  entities: unknown;
  sourceUrl: string | null;
  derivedFromMachineTranscript: true;
}
export interface Canonical_HearingRelevancePayload_91F1E4Ae {
  kind: 'client_hearing_relevance';
  id: string;
  clientId: string;
  hearingId: string;
  insightId: string;
  score: number;
  matchedOn: unknown;
  rationale: string;
  updatedAt: string;
}
export interface Canonical_HearingJsonFragment_4256Cbb4 {
  kind: 'hearing_evidence_json_chunk';
  originalKind: string | null;
  id?: string | number | boolean | null;
  hearingId?: string | number | boolean | null;
  captureId?: string | number | boolean | null;
  segmentId?: string | number | boolean | null;
  sequence?: string | number | boolean | null;
  startMs?: string | number | boolean | null;
  endMs?: string | number | boolean | null;
  speakerLabel?: string | number | boolean | null;
  speakerName?: string | number | boolean | null;
  speakerConfidence?: string | number | boolean | null;
  transcriptionConfidence?: string | number | boolean | null;
  confidence?: string | number | boolean | null;
  preliminary?: string | number | boolean | null;
  isOfficialTranscript?: string | number | boolean | null;
  derivedFromMachineTranscript?: string | number | boolean | null;
  hasGapBefore?: string | number | boolean | null;
  revision?: string | number | boolean | null;
  date?: string | number | boolean | null;
  publishedAt?: string | number | boolean | null;
  fetchedAt?: string | number | boolean | null;
  syncedAt?: string | number | boolean | null;
  title: string;
  sourceUrl: string | null;
  contentFormat: 'json_fragment';
  text: string;
  characterStart: number;
  characterEnd: number;
  totalCharacters: number;
  chunk: number;
  chunkCount: number;
  contentHash: string;
  note: 'Complete range of the original record JSON. Join consecutive text fragments to read all fields; this fragment is not the complete record.';
}
export interface Canonical_HearingPublishedVersionB9155A63 {
  id: string;
  hash: string;
  evidence: unknown;
  observed: string;
  date: string | null;
  billId: string | null;
  kind: string;
  current: boolean;
  eventId: string;
  historical: boolean;
  authority: 'Published source version; bill agenda membership alone does not establish hearing occurrence';
}
export interface Canonical_HearingPublishedBrief_85B11166 {
  kind: 'capiro_published_record_brief';
  id: string;
  seriesId: string;
  version: number;
  createdAt: string;
  contentHash: string;
  payload: Canonical_HearingBriefPayload_40873039;
  current: boolean;
  approvedAt: string;
  status: 'superseded' | 'reviewed' | 'draft';
  historical: boolean;
  authority: 'Capiro assessment; source citations retain separate publisher authority';
}
export interface Canonical_HearingBriefPayload_40873039 {
  schema: 'legiwatch.published-record-brief.v1';
  label: 'Brief based on published records';
  author: 'Capiro';
  title: string;
  eventId: string;
  runId: string;
  clientId: string | null;
  folders: {
    id: string;
    version: number;
    clientId: string | null;
  }[];
  sourceHash: string;
  cutoff: string;
  claims: Canonical_HearingRecordClaim_2F26Fb6D[];
  records: Canonical_HearingPublishedRecordF1E97226[];
  observation: Canonical_HearingSourceObservationB2F1E9Cd | null;
  coverage: unknown[];
  selectedObservationIds: string[];
  provenance: {
    promptVersion: 'published-record-brief-v1';
    clientContext: 'applied' | 'unavailable' | 'none';
  };
  correction?: Canonical_HearingBriefCorrection_270435Fb;
  edit?: {
    actor: string;
    rationale: string;
    previousId: string;
  };
}
export interface Canonical_HearingRecordClaim_2F26Fb6D {
  id: string;
  text: string;
  kind: 'fact' | 'quote' | 'analysis';
  scope: 'bill_record' | 'hearing_event';
  billId: string | null;
  /**
   * @maxItems 20
   */
  references:
    | []
    | [Canonical_HearingRecordReferenceDe0F6106]
    | [Canonical_HearingRecordReferenceDe0F6106, Canonical_HearingRecordReferenceDe0F6106]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ]
    | [
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106,
        Canonical_HearingRecordReferenceDe0F6106
      ];
  proposition?: {
    field: string;
    expected: string | number | boolean;
    body: string;
    motion: string;
    date: string;
  };
  parentClaimId?: string | null;
  section?: string;
  outcome?: string;
  rationale?: string;
  supported?: string[];
  unresolved?: string[];
  [k: string]: unknown;
}
export interface Canonical_HearingRecordReferenceDe0F6106 {
  id: string;
  hash: string;
  locator: string;
}
export interface Canonical_HearingPublishedRecordF1E97226 {
  id: string;
  billId: string | null;
  kind: string;
  hash: string;
  identity: string;
  date: string | null;
  observedAt: string;
  evidence: {};
  association: 'explicit_event' | 'bill_context_only';
}
export interface Canonical_HearingSourceObservationB2F1E9Cd {
  sessionId: string;
  publicationId: string;
  hash: string;
  clientId: string | null;
}
export interface Canonical_HearingBriefCorrection_270435Fb {
  priorKind: 'brief' | 'publication';
  priorId: string;
  sessionId?: string;
  priorHash: string;
  priorCreatedAt: string;
  /**
   * @maxItems 100
   */
  items: {
    priorClaimId: string;
    priorText: string;
    classification: 'wrong_then' | 'later_change' | 'still_supported' | 'uncertain';
    claimIds: string[];
    rationale: string;
  }[];
}
export interface Canonical_HearingReconciliation_56F73D75 {
  kind: 'capiro_record_reconciliation';
  id: string;
  inputHash: string;
  payload: Canonical_HearingReconciliationPayload_733C8142;
  current: boolean;
  createdAt: string;
  assessments: Canonical_HearingRecordAssessmentB1Cc23F2[];
  historical: boolean;
  authority: 'Capiro assessment of the preserved captured account';
}
export interface Canonical_HearingReconciliationPayload_733C8142 {
  schema: 'legiwatch.record-reconciliation.v1';
  event: Canonical_HearingRecordEvent_27B3E28B;
  records: Canonical_HearingPublishedRecordF1E97226[];
  sourceHash: string;
  claims: Canonical_HearingRecordClaim_2F26Fb6D[];
  originalClaims: Canonical_HearingRecordClaim_2F26Fb6D[];
  observation: Canonical_HearingSourceObservationB2F1E9Cd | null;
  cutoff: string;
  coverage: unknown[];
  sourceSelections: Canonical_HearingSourceSelectionAbe06030[];
}
export interface Canonical_HearingRecordEvent_27B3E28B {
  id: string;
  title: string;
  jurisdiction: string | null;
  session: string | null;
  date: string;
  body: string | null;
  revision: number;
}
export interface Canonical_HearingSourceSelectionAbe06030 {
  identity: string;
  locators: string[] | null;
}
export interface Canonical_HearingRecordAssessmentB1Cc23F2 {
  id: string;
  claimId: string;
  claimHash: string;
  outcome:
    | 'supported'
    | 'partially_supported'
    | 'contradicted'
    | 'not_addressed'
    | 'pending_records'
    | 'needs_review'
    | 'capiro_analysis';
  rationale: string;
  supported: string[];
  unresolved: string[];
  references: Canonical_HearingRecordReferenceDe0F6106[];
  requiresReview: boolean;
  ruleVersion: string;
  reviews: Canonical_HearingRecordReview_58A81965[];
}
export interface Canonical_HearingRecordReview_58A81965 {
  id: string;
  createdAt: string;
  outcome: string;
  rationale: string;
  references: Canonical_HearingRecordReferenceDe0F6106[];
  reviewer: string;
}
export interface Canonical_HearingObservabilityDb31267E {
  queryClass: 'lookup';
  requestedDomains: ['hearings'];
  /**
   * @maxItems 1
   */
  queriedDatasets: [] | ['hearings'];
  requestedEntityCount: number;
  queriedEntityCount: number;
  pagesByDomain: {
    hearings: number;
  };
  sourceHealth: {
    hearings: 'healthy' | 'degraded' | 'unavailable' | 'unauthorized' | 'unsupported' | 'error';
  };
  freshnessByDomain: {
    hearings: string | null;
  };
  coverageComplete: false;
  stopReason: string;
  reranking?: Canonical_HearingReranking_1Ffbc924;
  scoring?: Canonical_HearingScoringD65E1020;
}
export interface Canonical_HearingReranking_1Ffbc924 {
  status: 'disabled' | 'skipped' | 'applied' | 'fallback';
  provider: string | null;
  model: string | null;
  candidateCount: number;
  rerankedCount: number;
  durationMs: number;
  scores: {
    domain: 'hearings';
    recordId: string;
    originalRank: number;
    finalRank: number;
    score: number;
  }[];
  fallbackReason?: string;
  usage?: {
    promptTokens?: number;
    totalTokens?: number;
  };
}
export interface Canonical_HearingScoringD65E1020 {
  status: 'disabled' | 'shadow' | 'applied';
  algorithm: 'rrf';
  rrfK: number;
  candidateCount: number;
  scoredCount: number;
  applied: boolean;
  signalsUsed: (
    | 'lexical_exactness'
    | 'semantic_similarity'
    | 'entity_match_confidence'
    | 'source_authority'
    | 'freshness'
    | 'graph_relationship_relevance'
    | 'client_relevance'
    | 'temporal_validity'
  )[];
  scores: {
    domain: 'hearings';
    recordId: string;
    baselineRank: number;
    currentRank: number;
    proposedRank: number;
    fusedScore: number;
    sourceAuthority: 'tenant_system_of_record' | 'public_system_of_record' | 'knowledge_plane';
    components: {
      signal:
        | 'lexical_exactness'
        | 'semantic_similarity'
        | 'entity_match_confidence'
        | 'source_authority'
        | 'freshness'
        | 'graph_relationship_relevance'
        | 'client_relevance'
        | 'temporal_validity';
      signalClass: 'relevance' | 'confidence' | 'authority' | 'freshness' | 'validity';
      rawValue: number;
      signalRank: number;
      contribution: number;
    }[];
  }[];
}
export interface NativeHearingSourceEvent {
  contractVersion: '0.1.0';
  eventId: string;
  binding: Canonical_RunBinding_84F2304C;
  sequence: number;
  createdAt: string;
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  type: 'source.native-hearing-record';
  data: Canonical_NativeHearingSourceF31B5A94;
}
export interface HearingMediaReadRequest {
  schemaVersion: 'meri.hearing-media-read/1';
  conversationId: string;
  runId: string;
  referenceId: string;
  playback: null | Canonical_HearingMediaPlaybackSelection_61D6Dedf;
}
export interface Canonical_HearingMediaPlaybackSelection_61D6Dedf {
  epochId: string;
  positionMs: number;
}
export interface HearingMediaReadResponse {
  schemaVersion: 'meri.hearing-media-read/1';
  event: Canonical_NativeHearingSourceEvent_685F6175;
  current: {
    source: {
      hearingId: string;
      recordId: string;
      contentHash: string;
    };
    media:
      | {
          manifest: Canonical_HearingMediaManifest_1Fa05705;
          playback: null;
        }
      | {
          manifest: null;
          playback: Canonical_HearingMediaPlayback_90828F98;
        };
  };
}
export interface Canonical_HearingMediaManifest_1Fa05705 {
  hearingId: string;
  mode: 'server';
  format: 'audio/wav';
  /**
   * @maxItems 50
   */
  epochs: Canonical_HearingMediaEpochF0E9B2Fc[];
}
export interface Canonical_HearingMediaEpochF0E9B2Fc {
  id: string;
  startMs: number;
  durableEndMs: number;
  durableBytes: number;
  state: string;
  transcriptState: string;
  expiresAt: string;
  reason: null | string;
}
export interface Canonical_HearingMediaPlayback_90828F98 {
  epochId: string;
  partId: string;
  startMs: number;
  endMs: number;
  url: string;
  expiresAt: string;
}

declare const admittedSourceRequest:unique symbol;
export type AdmittedBillTextSourceRequest=Readonly<BillTextSourceReadRequest>&{readonly [admittedSourceRequest]:true};
export type AdmittedHearingSourceRequest=Readonly<HearingSourceReadRequest>&{readonly [admittedSourceRequest]:true};
export type AdmittedHearingMediaRequest=Readonly<HearingMediaReadRequest>&{readonly [admittedSourceRequest]:true};
export declare const HEARING_MEDIA_READ_SCHEMA:'meri.hearing-media-read/1';
export declare function receiveHearingMediaRequest(bytes:Uint8Array):AdmittedHearingMediaRequest;
export declare function receiveHearingMediaResponse(status:number,bytes:Uint8Array,request:AdmittedHearingMediaRequest):Promise<HearingMediaReadResponse|BillTextSourceErrorResponse>;
export declare const hearingSourceMetadata:{
  "version": "1.0.0",
  "path": "/api/conversations/source-read",
  "method": "POST",
  "requestBytes": 4096,
  "responseBytes": 131072,
  "authentication": "current native product bearer and Core access",
  "authority": false,
  "claimMapping": false,
  "offsetUnit": "UTF-16 code units",
  "scope": "exact search_committee_hearings@0.2.0 published/briefs/reconciliation pages with absent or UUID client selector",
  "claims": "canonical owner packet only; JSON fragments are not complete claims collections"
};
export declare const HEARING_SOURCE_SCHEMA:'meri.native-hearing-source/1',HEARING_SOURCE_READ_SCHEMA:'meri.hearing-source-read/1',HEARING_SOURCE_EVENT:'source.native-hearing-record';
export declare function receiveHearingSourceRequest(bytes:Uint8Array):AdmittedHearingSourceRequest;
export declare function receiveNativeHearingSourceEvent(bytes:Uint8Array):NativeHearingSourceEvent;
export declare function receiveHearingSourceResponse(status:number,bytes:Uint8Array,request:AdmittedHearingSourceRequest):Promise<HearingSourceReadResponse|BillTextSourceErrorResponse>;
export interface BillTextSourceErrorResponse {error:{code:string};}
export declare class BillTextSourceResponseError extends Error {readonly code:string;}
export declare const billTextSourceMetadata:{
  "version": "1.0.0",
  "packageVersion": "0.1.15",
  "path": "/api/conversations/source-read",
  "method": "POST",
  "requestBytes": 4096,
  "responseBytes": 131072,
  "authentication": "current native product bearer and Core access",
  "authority": false,
  "claimMapping": false,
  "offsetUnit": "UTF-16 code units",
  "scope": "successful sequential read_bill_text@0.2.0 pages only"
};
export declare const BILL_TEXT_SOURCE_SCHEMA:'meri.native-bill-text-source/1',BILL_TEXT_SOURCE_READ_SCHEMA:'meri.bill-text-source-read/1',BILL_TEXT_SOURCE_EVENT:'source.native-bill-text',BILL_TEXT_SOURCE_PATH:'/api/conversations/source-read';
export declare const billTextSourceErrors:Readonly<Record<string,readonly number[]>>;
export declare function receiveBillTextSourceRequest(bytes:Uint8Array):AdmittedBillTextSourceRequest;
export declare function receiveNativeBillTextSourceEvent(bytes:Uint8Array):NativeBillTextSourceEvent;
export declare function receiveBillTextSourceResponse(status:number,bytes:Uint8Array,request:AdmittedBillTextSourceRequest):Promise<BillTextSourceReadResponse|BillTextSourceErrorResponse>;
