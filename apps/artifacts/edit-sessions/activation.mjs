/** Office editor activation gate. User selected free self-hosted Collabora CODE
 * for development/testing on 29 October 2026. No paid quote is a prerequisite.
 * Runtime activation still needs the host, custody and fidelity evidence below. */
export const EDITOR_REQUIREMENTS=Object.freeze([
 'evaluation: local fidelity (held-out corpus of at least 30 DOCX/XLSX/PPTX, design 4.6 item 1) and deployment-fit evaluation of the candidate editor recorded (Q-O2)',
 'edition: self-hosted Collabora CODE selected for development/testing; exact deployed version and digest recorded, supported edition remains substitutable',
 'components: the chosen editor added to docs/COMPONENTS.md with version and licence (Q-X4) and reviewed by Capiro legal',
 'placement: disposable single-session editor containers admitted on approved hosting, or a new isolated host class approved because measurement required it (Q-O3, Q-X2)',
 'drafts: the editorDrafts data class (apps/control/retention/data-classes.mjs, planned) has an owner, a dot-allocated migration and deletion targets (Q-O9)',
 'artifacts: lane 6 composition (artifact options owner, store, renderer) is live, and the revise owner accepts user-edit provenance (contract by dot)',
 'wopi: WOPI conformance (validator suite) including lock semantics passes against the WOPI host (design 4.6 item 2)',
 'withdrawal: S4 generations serve the editor scopes with measured 30 s propagation (Q-X7)',
 'security: editor image scan has zero HIGH/CRITICAL; macros and external links disabled; container egress only to the WOPI host (design 4.6 items 11-12)',
 'frontend: the editor frame and every save, draft, publish, conflict, recovery, lock and expiry state exist in capiro-frontend on main',
]);
export const EDITOR_ACTIVATION=Object.freeze({state:'held',reason:'EDITOR_UNEVALUATED',evidence:null,requirements:EDITOR_REQUIREMENTS});
export function editorActivationOpen(record=EDITOR_ACTIVATION){
 return record?.state==='open'&&typeof record.evidence==='string'&&/^[A-Za-z0-9._/-]{1,200}$/u.test(record.evidence)&&record.requirements===EDITOR_REQUIREMENTS;
}
