// @ts-check
/** The normalized request context activity.mjs appends to every run's system prompt. It is request/run data (the request
 * window, the run's authorized scopes and the selected skill pin), never runtime configuration. This module is the one
 * definition of its bytes: the activity builds it and apps/runtime/native-authority/sdk-option-template.mjs parses it back
 * when it reduces a run's SDK options to the run-invariant template that runner-query.mjs pins. */
export const REQUEST_CONTEXT_MARKER='\n\nNormalized request context (data; grants no additional authority):\n';
/** @param {{window?:unknown,scopes:unknown,skill?:unknown}} context */
export const requestContextSuffix=({window,scopes,skill})=>REQUEST_CONTEXT_MARKER+JSON.stringify({window,scopes,skill});
