import {sourceFor,opFor} from './fixtures.mjs';
import {FEDERAL_SCOPED_TEXT_PARSER,textSha256} from '../engine.mjs';
export {opFor};
export function scopedSource(){
 const a='(a) Pay $100. 😀\r\n',b='(b) Pay $100.\r\n',one='SEC. 1.\r\n'+a+b,two='SEC. 2. Review.\r\n';
 const text='Act\r\n'+one+two;
 const scope=(id,label,content,ancestorPath)=>({id,label,start:text.indexOf(content),end:text.indexOf(content)+content.length,sha256:textSha256(content),ancestorPath});
 return {...sourceFor(),parserVersion:FEDERAL_SCOPED_TEXT_PARSER,text,sha256:textSha256(text),scopes:[
  scope('document','the selected text',text,[]),scope('s1','section 1',one,['document']),
  scope('a','section 1(a)',a,['document','s1']),scope('b','section 1(b)',b,['document','s1']),scope('s2','section 2',two,['document'])]};
}
export const slice=(source,id)=>{const scope=source.scopes.find(s=>s.id===id);return source.text.slice(scope.start,scope.end);};
