// Private syntax only: no session selection, source lookup, clock or authority.
const keyPattern = /^[a-z]{2}-\d{4}(x\d+)?-[a-z]+\d+[a-z]?$/;

export function inspectStateBillSelector(raw, stateHint = null) {
  if ((raw !== null && typeof raw !== 'string') || (stateHint !== null && typeof stateHint !== 'string'))
    throw new Error('State bill selector requires primitive strings or null');
  if (!raw) return Object.freeze({kind: 'missing'});
  const text = raw.trim();
  const key = text.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (keyPattern.test(key)) return Object.freeze({kind: 'canonical', key});
  const hint = stateHint?.toUpperCase();
  const leading = /^([A-Za-z]{2})\s+(.+)$/.exec(text);
  const candidates = [];
  if (hint && /^[A-Z]{2}$/.test(hint)) candidates.push([hint, text]);
  if (leading) candidates.push([leading[1].toUpperCase(), leading[2]]);
  for (const [state, body] of candidates) {
    const match = /^([A-Za-z]+)\s*([0-9]+(?:-[0-9]+)*)([A-Za-z]?)$/.exec(body.trim().replace(/\./g, ''));
    if (match) return Object.freeze({kind: 'designation', state,
      billNumber: `${match[1]}${match[2].replace(/-/g, '')}${match[3]}`.toLowerCase()});
  }
  return Object.freeze({kind: 'invalid'});
}
