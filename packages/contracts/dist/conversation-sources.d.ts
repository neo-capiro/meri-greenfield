// Generated source provenance. Validation grants no authority or citation mapping.

export type BillTextSourceEnvelope = BillTextSourceReadRequest | BillTextSourceReadResponse | NativeBillTextSourceEvent;

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

declare const admittedSourceRequest:unique symbol;
export type AdmittedBillTextSourceRequest=Readonly<BillTextSourceReadRequest>&{readonly [admittedSourceRequest]:true};
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
