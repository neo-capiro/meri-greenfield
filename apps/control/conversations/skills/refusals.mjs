/** The one owner of the typed skill-selection refusal names and of their only projection onto the wire. A typed refusal keeps
 * its code and detail from the admission owner or the service through to the public 400 body; the availability
 * unavailability is the one skill failure that is the service's, not the choice's, and reaches the routes' unavailable answer. */
export const SKILL_TYPED_REFUSALS=Object.freeze(['SKILL_SCOPE_REFUSED','SKILL_SOURCES_UNAVAILABLE']);
/** The admission could not learn availability (session role, gateway snapshot or policy read failed): not a refusal of the choice. */
export const SKILL_AVAILABILITY_UNAVAILABLE='SKILL_AVAILABILITY_UNAVAILABLE';
/** The conversation scope a refused skill needs: `client` for a client-only skill in General, `general` for a General-only skill in a client conversation. */
export const SKILL_REQUIRED_SCOPES=Object.freeze(['client','general']);
export function skillRefusal(code,detail={}){
 if(!SKILL_TYPED_REFUSALS.includes(code)&&code!==SKILL_AVAILABILITY_UNAVAILABLE)throw Object.assign(new Error('SKILL_REFUSAL_CONFIGURATION'),{code:'SKILL_REFUSAL_CONFIGURATION'});
 return Object.assign(new Error(code),{code,...detail});
}
export const isSkillTypedRefusal=error=>SKILL_TYPED_REFUSALS.includes(error?.code)||error?.code===SKILL_AVAILABILITY_UNAVAILABLE;
/** `{code, requiredScope}` or `{code, sources}` for a typed refusal; null for anything else. */
export function skillRefusalBody(error){
 if(error?.code==='SKILL_SCOPE_REFUSED'&&SKILL_REQUIRED_SCOPES.includes(error.requiredScope))return {code:error.code,requiredScope:error.requiredScope};
 if(error?.code==='SKILL_SOURCES_UNAVAILABLE'&&Array.isArray(error.sources)&&error.sources.length&&error.sources.every(s=>typeof s==='string'&&s))return {code:error.code,sources:[...error.sources]};
 return null;
}
