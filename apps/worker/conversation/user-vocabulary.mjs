// @ts-check
/** The user's vocabulary for model-facing text composed from frozen catalog descriptors.
 *
 * Catalog descriptor bytes (displayName, whenToUse, negative examples, limitations) are pinned and never rewritten,
 * but the model repeats their words to the user. This closed, ordered phrase map projects the composed tool text into
 * the terms the user hears (`tools.mjs`, `intents/tools.mjs`): SQL-writing text keeps "table"; the argument name
 * `relations:` and result field names are never touched. Prose this repository owns is written in user terms directly
 * and is not routed through here. */
/** @type {readonly (readonly [RegExp,string])[]} */
const PHRASES=Object.freeze([
 [/\brelation(s?)\b(?!:)/gu,'table$1'],
 [/\bgoverned memory\b/giu,'saved memory'],
 [/\bProvider acceptance\b/gu,'Provider acknowledgement'],
 [/\bprovider acceptance\b/gu,'provider acknowledgement'],
 [/\bdelivery from acceptance\b/gu,'delivery from the provider\'s acknowledgement'],
 [/\bacceptance\b/gu,'approval'],
 [/\btrusted gateway\b/gu,'trusted run'],
 [/\bthe gateway\b/gu,'the trusted run'],
]);
/** @param {string} text */
export function userVocabulary(text){
 let out=text;for(const [pattern,replacement] of PHRASES)out=out.replace(pattern,replacement);return out;
}
