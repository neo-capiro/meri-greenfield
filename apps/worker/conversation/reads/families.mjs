// @ts-check
/** Read families the general `meri_reads` server can construct, keyed by the canonical contract binding `group`
 * (`resolveOperationContract(op).binding.group`). A family is added here only when its adapter, trusted dispatch
 * context and tests exist (FABLE-GENERAL-READ-TOOLS-20261015 §6). Phase 1.1 is `mail`. Being listed constructs
 * nothing by itself: every availability gate (`availability.mjs`) still applies and, with no current native
 * installation receipt, no read is available.
 *
 * `clientScope`: `required` lists the family's tools only when the run carries an authorized client scope;
 * `optional` lists them regardless, and a model-supplied client grants nothing (the gateway's subject checks decide).
 * Data only, safe to import from the capability policy. */
/** @typedef {{clientScope:'required'|'optional'}} ReadFamily */
/** @type {Readonly<Record<string,Readonly<ReadFamily>>>} */
export const READ_FAMILIES=Object.freeze({mail:Object.freeze({clientScope:'optional'})});
/** The `readFamilies` policy universe (PROPOSAL P8). */
export const READ_FAMILY_IDS=Object.freeze(Object.keys(READ_FAMILIES));
