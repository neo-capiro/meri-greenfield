/** Shared, browser-safe layout rules. Locations describe exact text, not legal hierarchy. */
export const FEDERAL_SCOPED_TEXT_PARSER='federal-scoped-text/2';
const fail=code=>{throw Object.assign(Error(code),{code});};
const boundary=(text,at)=>at===0||at===text.length||!(text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff);
export function assertFederalTextLayout(source){
 const nested=source.parserVersion===FEDERAL_SCOPED_TEXT_PARSER;
 if(!nested&&source.parserVersion!=='federal-plain-text/1')fail('DRAFT_SOURCE_MISMATCH');
 // A retained XML/HTML document is not a plain-text editing baseline. This is a
 // refusal guard, not an XML parser or a claim that arbitrary text is schema-valid.
 if(/^[\s\uFEFF]*(?:<\?xml\b|<!DOCTYPE\b|<!--|<[A-Za-z_][\w.:-]*(?=[\s/>]|$))/iu.test(source.text))fail('DRAFT_SOURCE_FORMAT_UNSUPPORTED');
 const stack=[],seen=new Set();let end=0;
 for(const scope of source.scopes){
  if(seen.has(scope.id)||!Number.isSafeInteger(scope.start)||!Number.isSafeInteger(scope.end)||scope.start<0||scope.end<=scope.start||scope.end>source.text.length||!boundary(source.text,scope.start)||!boundary(source.text,scope.end))fail('DRAFT_SCOPE_INVALID');
  if(nested){
   while(stack.length&&scope.start>=stack.at(-1).end)stack.pop();
   if(stack.length&&(scope.start<stack.at(-1).start||scope.end>stack.at(-1).end))fail('DRAFT_SCOPE_INVALID');
   if(!Array.isArray(scope.ancestorPath)||scope.ancestorPath.length!==stack.length||scope.ancestorPath.some((id,index)=>id!==stack[index].id))fail('DRAFT_ANCESTOR_INVALID');
   stack.push(scope);
  }else if(scope.start<end||Object.hasOwn(scope,'ancestorPath'))fail('DRAFT_SCOPE_INVALID');
  seen.add(scope.id);end=scope.end;
 }
 return source;
}
