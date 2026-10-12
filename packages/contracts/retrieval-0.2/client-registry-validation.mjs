// Lookup boundary only. Current tenant/client authorization and producer failure
// handling belong to the gateway/source adapter; reported guidance grants nothing.
import {types} from 'node:util';

export function createClientRegistryValidators({validateShape}) {
  function normalizeClientRegistryInput(request) {
    // This selector is flat. Avoid invoking accessors even when called directly;
    // the canonical resolver additionally owns bounded recursive JSON admission.
    if (!request || typeof request !== 'object' || Array.isArray(request) || types.isProxy(request))
      throw new Error('Client registry requires an inert request object');
    const prototype = Object.getPrototypeOf(request);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error('Client registry requires a plain request');
    for (const key of Reflect.ownKeys(request)) {
      const field = Object.getOwnPropertyDescriptor(request, key);
      if (key !== 'name' || !field.enumerable || !Object.hasOwn(field, 'value'))
        throw new Error('Client registry refuses unknown, hidden or accessor fields');
    }
    validateShape('ClientRegistryRequest', request);
    const input = {name: request.name.trim().slice(0, 300)};
    validateShape('ClientRegistryInput', input);
    return Object.freeze(input);
  }

  function assertClientRegistryResult(value) {
    validateShape('ClientRegistryResult', value);
    // JSON Schema counts Unicode code points; the frozen projection truncates
    // JavaScript strings by UTF-16 code units, including surrogate pairs.
    const rows = [...value.ldaCandidates, ...(value.ldaExactMatch === null ? [] : [value.ldaExactMatch])];
    if (rows.some(row => row.description !== null && row.description.length > 200))
      throw new Error('Client registry description exceeds 200 UTF-16 code units');
    const ids = new Set(value.ldaCandidates.map(row => row.ldaClientId));
    if (ids.size !== value.ldaCandidates.length)
      throw new Error('Duplicate client registry candidate identity');
    if (value.ldaExactMatch !== null && ids.has(value.ldaExactMatch.ldaClientId))
      throw new Error('Exact client registry match repeated as a candidate');
    return value;
  }
  return Object.freeze({normalizeClientRegistryInput, assertClientRegistryResult});
}
