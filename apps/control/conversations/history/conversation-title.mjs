/** Sidebar name for a chat the person has not renamed: the first prompt, shortened. Presentation only. */
export const UNNAMED_CONVERSATION_TITLE='New conversation';
const WORDS=6,MAX_CHARS=80;
const EDGE_PUNCTUATION=/^[\p{P}\s]+|[\p{P}\s]+$/gu;
export function derivedConversationTitle(prompt){
 if(typeof prompt!=='string')return null;
 const head=prompt.split(/\s+/u).filter(Boolean).slice(0,WORDS).join(' ');
 const title=(head.length>MAX_CHARS?head.slice(0,MAX_CHARS):head).replace(EDGE_PUNCTUATION,'');
 return title||null;
}
