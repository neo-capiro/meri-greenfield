/** Closed private protocol for the Workspace generation leaf.
 *
 * These are private routes on the control's protected listener (see
 * control-route-boundary.mjs). Transport trust comes from the listener, and the
 * request must additionally present the existing Core service secret. The
 * body never selects authority: the `authorization` header carries the CURRENT
 * authenticated identity credential, which this leaf verifies through the
 * existing action-session owner before anything is submitted.
 */
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export const workspaceGenerationPaths = freeze({
  turn: '/v1/internal/workspace-generation/turn',
  read: '/v1/internal/workspace-generation/read',
  cancel: '/v1/internal/workspace-generation/cancel',
});

/** One wire shape version for all three routes. */
export const WORKSPACE_GENERATION_SCHEMA_VERSION = 1;

/** The five supported Workspace generated phases, in the Workspace's own vocabulary. */
export const workspaceGenerationPhases = freeze(['brief', 'context-recommend', 'context-analyze', 'outline', 'document']);

export const workspaceGenerationErrorStatuses = freeze({
  WORKSPACE_GENERATION_UNAVAILABLE: [503],
  WORKSPACE_GENERATION_REFUSED: [400],
  WORKSPACE_GENERATION_AUTHORITY_REFUSED: [403],
  WORKSPACE_GENERATION_SCOPE_REFUSED: [403],
  WORKSPACE_GENERATION_REQUEST_REFUSED: [409],
  WORKSPACE_GENERATION_OUTPUT_REFUSED: [502],
  WORKSPACE_GENERATION_UNKNOWN: [503],
  WORKSPACE_GENERATION_DEADLINE: [408],
});

export const workspaceGenerationLimits = freeze({
  requestBytes: 16384,
  responseBytes: 1048576,
  /** One turn's whole observation window: the conversation routes' own request bound. */
  maxRequestMs: 30000,
  /** A single call observes this long before answering UNKNOWN; the caller reconciles. */
  observeMs: 20000,
  observePollMs: 50,
  observeIdleRecheckMs: 1000,
});
