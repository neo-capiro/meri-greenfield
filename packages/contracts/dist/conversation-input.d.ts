// Generated additive input receipt over accepted canonical schemas. No authorization implied.

export type ConversationInputEnvelope =
  | Canonical_ConversationSubmitRequest_1Ec41363
  | Canonical_ConversationStoredRequest_79D6Cc7B
  | ConversationInputAdmittedResponse
  | ConversationInputExpectedContext
  | Canonical_ConversationErrorResponse_68Bab4E3;
export type Canonical_Canonical_WindowRequestF314F340_6Bb8C023 =
  | {
      basis: 'calendar-week';
      offset: -1 | 0;
      timezone: string;
      weekStartsOn: 'monday' | 'sunday';
    }
  | {
      basis: 'calendar-month';
      offset: -1 | 0;
      timezone: string;
    }
  | {
      basis: 'calendar-year';
      offset: -1 | 0;
      timezone: string;
    }
  | {
      basis: 'relative-duration';
      days: number;
      anchorAt: string;
      timezone: string;
    }
  | {
      basis: 'explicit';
      startInclusive: string;
      endExclusive: string;
      timezone: string;
    }
  | {
      basis: 'fiscal-year';
      year: number;
      calendarId: string;
      stage: 'requested' | 'authorized' | 'appropriated' | 'obligated' | 'actual' | 'outlay';
      revisionId: string;
      timezone: string;
    }
  | {
      basis: 'unbounded';
    };
export type Canonical_CanonicalSkillId_31E12E8ECae56271 =
  | 'quick_skill.research_company'
  | 'quick_skill.relationship_brief'
  | 'quick_skill.client_changes'
  | 'quick_skill.portfolio_changes'
  | 'quick_skill.portfolio_overlap'
  | 'quick_skill.mail_history'
  | 'quick_skill.meeting_prep'
  | 'quick_skill.commitments_audit'
  | 'quick_skill.funding_opportunity_match'
  | 'quick_skill.pe_deep_dive'
  | 'quick_skill.bill_watch'
  | 'quick_skill.hearing_watch'
  | 'quick_skill.representation_lookup'
  | 'quick_skill.regulatory_docket_brief';
export type Canonical_CanonicalSkillVersion_7E2Af095_7F0F4343 = string;
export type Canonical_Canonical_NormalizedWindowE50Ec0Ed_8A69A7E3 =
  | {
      basis: 'calendar-week' | 'calendar-month' | 'calendar-year' | 'relative-duration' | 'explicit';
      startInclusive: string;
      endExclusive: string;
      timezone: string;
      weekStartsOn: ('monday' | 'sunday') | null;
    }
  | {
      basis: 'fiscal-year';
      year: number;
      calendarId: string;
      stage: 'requested' | 'authorized' | 'appropriated' | 'obligated' | 'actual' | 'outlay';
      revisionId: string;
      startInclusive: string;
      endExclusive: string;
      timezone: string;
    }
  | {
      basis: 'unbounded';
    };

export interface Canonical_ConversationSubmitRequest_1Ec41363 {
  requestId: string;
  prompt: string;
  windowRequest?: Canonical_Canonical_WindowRequestF314F340_6Bb8C023;
  skill?: {
    skillId: Canonical_CanonicalSkillId_31E12E8ECae56271;
    skillVersion: Canonical_CanonicalSkillVersion_7E2Af095_7F0F4343;
  };
}
export interface Canonical_ConversationStoredRequest_79D6Cc7B {
  requestId: string;
  prompt: string;
  skill: Canonical_ConversationSkillAssetPin_338818F9 | null;
  window: Canonical_Canonical_NormalizedWindowE50Ec0Ed_8A69A7E3 | null;
  windowRequest: Canonical_Canonical_WindowRequestF314F340_6Bb8C023 | null;
}
export interface Canonical_ConversationSkillAssetPin_338818F9 {
  skillId: Canonical_CanonicalSkillId_31E12E8ECae56271;
  skillVersion: Canonical_CanonicalSkillVersion_7E2Af095_7F0F4343;
  manifestSha256: string;
  proseSha256: string;
  catalogSha256: string;
}
export interface ConversationInputAdmittedResponse {
  run: Canonical_RunAeee1939;
  request: Canonical_ConversationStoredRequest_79D6Cc7B;
  lastSequence: number;
  replayed: boolean;
}
export interface Canonical_RunAeee1939 {
  binding: Canonical_RunBinding_84F2304C;
  state: 'queued' | 'starting' | 'running' | 'waiting-for-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /**
   * @minItems 1
   */
  scopes: [Canonical_ScopeF882Edb5, ...Canonical_ScopeF882Edb5[]];
  createdAt: string;
  policyRevision: string;
  versions: Canonical_RuntimeVersions_7Edb8Efc;
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
export interface Canonical_RuntimeVersions_7Edb8Efc {
  imageDigest: string;
  sdk: string;
  cli: string;
  contracts: '0.1.0';
  skillsDigest: string;
  checkpointFormat: '0.1.0';
}
export interface ConversationInputExpectedContext {
  tenantId: string;
  actorId: string;
  conversationId: string;
  runId: string;
  clientId: string;
}
export interface Canonical_ConversationErrorResponse_68Bab4E3 {
  error: {
    code:
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'SESSION_REFUSED'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'INVALID_REQUEST'
      | 'INVALID_CURSOR'
      | 'REQUEST_REPLAY_REFUSED'
      | 'SCOPE_REFUSED'
      | 'SESSION_CHANGED'
      | 'STALE_WRITER'
      | 'CONVERSATION_SELECTOR_REFUSED'
      | 'DEADLINE'
      | 'CANCELLED'
      | 'REQUEST_TOO_LARGE'
      | 'CONVERSATION_UNAVAILABLE';
  };
}

import type {AdmittedConversationRequest,AdmittedConversationView,ConversationHistoryResponse} from '@capiro/meri-contracts/conversation-application';
export type AdmittedConversationInputRequest=AdmittedConversationRequest<'submit'>;
declare const admittedInputReceipt:unique symbol;
export type AdmittedConversationInputReceipt=Readonly<ConversationInputAdmittedResponse>&{readonly [admittedInputReceipt]:true};
export type ConversationInputView=Readonly<ConversationHistoryResponse>&AdmittedConversationView;
export declare class ConversationInputResponseError extends Error {readonly code:string;}
export declare const conversationInputMetadata: {
  "packageVersion": "0.1.7",
  "inputVersion": "1.0.0",
  "schemaId": "urn:meri:conversation-input:1.0.0",
  "routes": {
    "admit": {
      "method": "POST",
      "path": "/api/conversations/input/admit",
      "response": "json"
    }
  },
  "authentication": {
    "header": "authorization",
    "scheme": "Bearer",
    "owner": "current authenticated opaque session",
    "validationGrantsAuthority": false,
    "expectedContext": "independently authenticated tenant, actor, conversation, run and selected client"
  },
  "limits": {
    "requestBytes": 131072,
    "responseBytes": 2097152
  },
  "receipt": "durable immutable input; queued is not evidence of provider execution",
  "recovery": "positive stored request only; errors, absent history and RESERVED mappings grant no input or dispatch authority",
  "errorStatuses": {
    "NOT_FOUND": [
      404
    ],
    "METHOD_NOT_ALLOWED": [
      405
    ],
    "SESSION_REFUSED": [
      401,
      403
    ],
    "UNSUPPORTED_MEDIA_TYPE": [
      415
    ],
    "INVALID_REQUEST": [
      400
    ],
    "INVALID_CURSOR": [
      400
    ],
    "REQUEST_REPLAY_REFUSED": [
      400
    ],
    "SCOPE_REFUSED": [
      403
    ],
    "SESSION_CHANGED": [
      403
    ],
    "STALE_WRITER": [
      403
    ],
    "CONVERSATION_SELECTOR_REFUSED": [
      403
    ],
    "DEADLINE": [
      408
    ],
    "CANCELLED": [
      408
    ],
    "REQUEST_TOO_LARGE": [
      413
    ],
    "CONVERSATION_UNAVAILABLE": [
      502
    ]
  }
};
export declare const conversationInputVersion:'1.0.0';
export declare const conversationInputPath:'/api/conversations/input/admit';
export declare function receiveConversationInputRequest(utf8Bytes:Uint8Array):AdmittedConversationInputRequest;
export declare function receiveConversationInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInputRequest,expectedContext:Readonly<ConversationInputExpectedContext>,currentView?:AdmittedConversationView|AdmittedConversationInputReceipt):Promise<AdmittedConversationInputReceipt|ConversationInputErrorResponse>;
export declare function conversationInputView(receipt:AdmittedConversationInputReceipt):ConversationInputView;
