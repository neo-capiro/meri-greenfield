/** Installed original-skill execution cohort. This is implementation support, never an installation or authorization receipt. */
export const originalRuntimeSkillIds=Object.freeze(['quick_skill.relationship_brief','quick_skill.commitments_audit']);
export const originalRuntimeSupports=pin=>originalRuntimeSkillIds.includes(pin.skillId);
