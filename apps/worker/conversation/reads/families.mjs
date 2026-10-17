// @ts-check
/** Read families the general `meri_reads` server can construct, keyed by the canonical contract binding `group`
 * (`resolveOperationContract(op).binding.group`). A family is added here only when its adapter, trusted dispatch
 * context and tests exist (FABLE-GENERAL-READ-TOOLS-20261015 §6). Phase1, retained three, bill-text, public reports and acquisition are constructible. Being listed constructs
 * nothing by itself: every availability gate (`availability.mjs`) still applies and, with no current native
 * installation receipt, no read is available.
 *
 * `clientScope`: `required` lists the family's tools only when the run carries an authorized client scope;
 * `optional` lists them regardless, and a model-supplied client grants nothing (the gateway's subject checks decide).
 * Data only, safe to import from the capability policy. */
/** @typedef {{clientScope:'required'|'optional',requiredClientOperations?:readonly string[],operationIds?:readonly string[]}} ReadFamily */
/** @type {Readonly<Record<string,Readonly<ReadFamily>>>} */
export const READ_FAMILIES=Object.freeze({mail:Object.freeze({clientScope:'optional'}),
 'meeting-source':Object.freeze({clientScope:'optional',requiredClientOperations:Object.freeze(['meeting.read_client_meetings'])}),
 'action-items-complete':Object.freeze({clientScope:'required'}),
 'operational-reads':Object.freeze({clientScope:'optional',requiredClientOperations:Object.freeze(['query_action_items'])}),
 'tenant-contacts':Object.freeze({clientScope:'optional'}),
 'entity-candidates':Object.freeze({clientScope:'optional'}),
 'client-knowledge-profile':Object.freeze({clientScope:'required'}),
 'client-documents':Object.freeze({clientScope:'required'}),
 'client-knowledge-memory':Object.freeze({clientScope:'optional'}),
 'client-knowledge-monday':Object.freeze({clientScope:'required'}),
 'dataset-metadata':Object.freeze({clientScope:'optional'}),
 'memory-proposals':Object.freeze({clientScope:'optional'}),
 'research-portfolio-evidence':Object.freeze({clientScope:'optional'}),
 'research-portfolio':Object.freeze({clientScope:'optional'}),
 'florida-budget':Object.freeze({clientScope:'optional'}),
 'bill-text':Object.freeze({clientScope:'optional'}),
 'public-reports':Object.freeze({clientScope:'optional'}),
 'acquisition-personnel':Object.freeze({clientScope:'optional'}),
 'disclosures':Object.freeze({clientScope:'optional'}),
 'legislative-directory':Object.freeze({clientScope:'optional'}),
 'pe-references':Object.freeze({clientScope:'optional'}),
 'federal-legislation':Object.freeze({clientScope:'optional'}),
 'state-legislation':Object.freeze({clientScope:'optional'}),
 'stored-intelligence':Object.freeze({clientScope:'optional'}),
 'regulatory-dockets':Object.freeze({clientScope:'optional'}),
 'intelligence-summary':Object.freeze({clientScope:'optional'}),
 'public-web':Object.freeze({clientScope:'optional'}),
 'data-search':Object.freeze({clientScope:'optional'}),
 'public-domain-query':Object.freeze({clientScope:'optional'}),
 'facility-representation':Object.freeze({clientScope:'required'}),
 'district-nexus':Object.freeze({clientScope:'required'}),
 'client-registry':Object.freeze({clientScope:'optional'}),
 'federal-market':Object.freeze({clientScope:'optional'}),
 'funding-opportunities':Object.freeze({clientScope:'required'}),
 'public-data':Object.freeze({clientScope:'optional',operationIds:Object.freeze(['query_economic_data'])}),
 'client-knowledge-search':Object.freeze({clientScope:'optional',operationIds:Object.freeze(['query_knowledge_graph'])}),
 'business-development':Object.freeze({clientScope:'optional',operationIds:Object.freeze(['get_business_development_context','get_business_development_recent_changes'])}),
});
/** The `readFamilies` policy universe (PROPOSAL P8). */
export const READ_FAMILY_IDS=Object.freeze(Object.keys(READ_FAMILIES));
