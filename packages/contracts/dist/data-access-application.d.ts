// Generated additive data-access contract from its canonical route/reader owners. No authority implied.

export type DataAccessApplicationEnvelope =
  | DataAccessClientId
  | DataAccessRequest
  | DataAccessState
  | DataAccessFamily
  | DataAccessRelation
  | DataAccessResponse
  | DataAccessErrorResponse;
export type DataAccessClientId = string | null;
export type DataAccessState = 'not_installed' | 'policy_off' | 'client_required' | 'available';

export interface DataAccessRequest {
  clientId: DataAccessClientId;
}
export interface DataAccessFamily {
  family: string;
  covers: string | null;
  freshness: string | null;
  structured: boolean;
  clientScope: 'required' | 'optional';
  state: DataAccessState;
  requires: 'mailbox' | null;
}
export interface DataAccessRelation {
  name: string;
  source: 'public' | 'client_records';
  state: DataAccessState;
}
export interface DataAccessResponse {
  schemaVersion: 'meri.data-access/1';
  checkedAt: string;
  clientId: DataAccessClientId;
  generalReads: boolean;
  /**
   * @maxItems 256
   */
  families: DataAccessFamily[];
  /**
   * @maxItems 256
   */
  relations: DataAccessRelation[];
}
export interface DataAccessErrorResponse {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'UNAUTHENTICATED'
      | 'ACCESS_DENIED'
      | 'MEMBERSHIP_REVOKED'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'DEADLINE'
      | 'MEMBERSHIP_CHANGED'
      | 'REQUEST_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'CANCELLED'
      | 'PRODUCT_UNAVAILABLE'
      | 'DATA_ACCESS_REQUEST_INVALID'
      | 'DATA_ACCESS_CLIENT_REFUSED'
      | 'DATA_ACCESS_POLICY_UNAVAILABLE'
      | 'DATA_ACCESS_UNAVAILABLE';
    outcome?: 'NOT_DISPATCHED';
    field?: string;
  };
}

export declare class DataAccessResponseError extends Error {readonly code:string;}
export declare const dataAccessVersion:'0.1.0';
export declare const dataAccessMetadata:{
  "contractVersion": "0.1.0",
  "schemaId": "urn:meri:data-access-application:0.1.0",
  "schemaVersion": "meri.data-access/1",
  "routes": {
    "read": {
      "method": "POST",
      "path": "/api/data-access/read",
      "response": "json"
    }
  },
  "authentication": {
    "scheme": "Bearer",
    "authority": "native session admitted by Core membership on every request; tenant, actor, role and clients come only from that admission, never from the body"
  },
  "limits": {
    "requestBytes": 1024,
    "responseBytes": 1048576,
    "requestMs": 30000,
    "jsonDepth": 64,
    "jsonNodes": 100000
  },
  "errorStatuses": {
    "INVALID_REQUEST": 400,
    "UNAUTHENTICATED": 401,
    "ACCESS_DENIED": 403,
    "MEMBERSHIP_REVOKED": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "DEADLINE": 408,
    "MEMBERSHIP_CHANGED": 409,
    "REQUEST_TOO_LARGE": 413,
    "UNSUPPORTED_MEDIA_TYPE": 415,
    "CANCELLED": 499,
    "PRODUCT_UNAVAILABLE": 502,
    "DATA_ACCESS_REQUEST_INVALID": 400,
    "DATA_ACCESS_CLIENT_REFUSED": 403,
    "DATA_ACCESS_POLICY_UNAVAILABLE": 503,
    "DATA_ACCESS_UNAVAILABLE": 503
  },
  "states": [
    "not_installed",
    "policy_off",
    "client_required",
    "available"
  ],
  "requirements": [
    "mailbox"
  ],
  "semantics": {
    "read": "a read-only view over the registry of constructible read families, the control's installed read operations and the member's resolved capability policy (platform, tenant, role) for the named client or General; it reads no source and changes no policy",
    "state": "not_installed: no operation of the family is in this installation; policy_off: the resolved policy does not admit the family or none of its installed operations is active; client_required: the family needs a selected client and the request named none; available: a run for this member would list the family (every gate still applies on each call)",
    "requires": "mailbox means the family answers only through a mailbox connection the member owns; the caller reads their own connections to say whether one is connected",
    "relations": "the relation names the describe path publishes; public relations follow the best SQL family state, client_records relations also need a selected client",
    "correlation": "an answer is admitted only against the captured request: it describes the same client, lists each family and relation once, and its families are sorted"
  }
};
export declare function receiveDataAccessRequest(jsonText:unknown):DataAccessRequest;
export declare function receiveDataAccessResponse(httpStatus:number,jsonText:unknown,request:DataAccessRequest):DataAccessResponse|DataAccessErrorResponse;
