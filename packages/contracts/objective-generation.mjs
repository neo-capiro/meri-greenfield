/** Public wire boundary for the existing Objective workflow starter. No authorization is implied. */
export const objectiveGenerationStartMetadata = Object.freeze({
 path: '/api/objective-generation/start', method: 'POST', requestBytes: 1024, responseBytes: 4096,
});
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const invalid = () => { throw Error('OBJECTIVE_GENERATION_WIRE_INVALID'); };
function object(value, keys) {
 if (!value || typeof value !== 'object' || Array.isArray(value) ||
     ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) invalid();
 const captured = {};
 for (const key of keys) {
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d?.enumerable || !('value' in d)) invalid();
  captured[key] = d.value;
 }
 return captured;
}
export function requireObjectiveGenerationStartRequest(value) {
 const request = object(value, ['generationJobId']);
 if (!uuid(request.generationJobId)) invalid();
 return Object.freeze(request);
}
export function receiveObjectiveGenerationStartResponse(status, jsonText, expectedJobId) {
 if (!uuid(expectedJobId) || typeof jsonText !== 'string' || new TextEncoder().encode(jsonText).byteLength > objectiveGenerationStartMetadata.responseBytes) invalid();
 let value; try { value = JSON.parse(jsonText); } catch { invalid(); }
 if (status === 202) {
  const receipt = object(value, ['state', 'generationJobId']);
  if (receipt.state !== 'requested' || receipt.generationJobId !== expectedJobId) invalid();
  return Object.freeze(receipt);
 }
 const failure = object(object(value, ['error']).error, ['code']);
 const codes = status === 400 || status === 403 ? ['OBJECTIVE_GENERATION_REFUSED'] :
  status === 401 ? ['SESSION_REFUSED'] : status === 503 ? ['OBJECTIVE_GENERATION_UNAVAILABLE', 'OBJECTIVE_GENERATION_UNKNOWN'] : [];
 if (!codes.includes(failure.code)) invalid();
 return Object.freeze({error: Object.freeze(failure)});
}
