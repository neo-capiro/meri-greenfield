/** A document operation's declared formats in a run's intent offer: the owner's own admission for this composition (for
 * example `pdf` only when the document application admits it). One closed shape for the control mount that declares it,
 * the runner client that relays it and the worker that advertises it: a short unique list of lowercase tokens. */
const FORMAT=/^[a-z0-9]{1,8}$/u;
export const MAX_DECLARED_FORMATS=8;
export const isDeclaredFormats=value=>Array.isArray(value)&&value.length>=1&&value.length<=MAX_DECLARED_FORMATS&&value.every(f=>typeof f==='string'&&FORMAT.test(f))&&new Set(value).size===value.length;
