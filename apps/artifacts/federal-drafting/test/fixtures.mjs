import {FEDERAL_TEXT_PARSER,textSha256} from '../engine.mjs';
export function sourceFor(sections=['SEC. 1. Payment is $100.\n','SEC. 2. Payment is $100.\n']){
 const text='Synthetic Federal Act\n'+sections.join('')+'End.\n';let start='Synthetic Federal Act\n'.length;
 const scopes=sections.map((text,index)=>{const scope={id:'section-'+(index+1),label:'section '+(index+1),start,end:start+text.length,sha256:textSha256(text)};start=scope.end;return scope;});
 return {documentId:'Synthetic Act',publisher:'Synthetic federal publisher',sourceVersion:'introduced-1',sourceUrl:'https://legislation.example/act/introduced-1',publishedAt:'2026-10-28',parserVersion:FEDERAL_TEXT_PARSER,
  text,sha256:textSha256(text),coverage:{complete:false,limitations:['Synthetic plain-text test source; no official source verification.']},scopes};
}
export function opFor(source,{id='op-1',scopeId='section-1',expectedText='$100',kind='replace',text='$150',...over}={}){
 return {id,scopeId,kind,expectedScopeSha256:source.scopes.find(scope=>scope.id===scopeId).sha256,expectedText,expectedTextSha256:textSha256(expectedText),dependsOn:[],...(kind==='delete'?{}:{text}),...over};
}
