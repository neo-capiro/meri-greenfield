import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {writeFileSync} from 'node:fs';
import ts from '/workspace/meri-greenfield/packages/contracts/node_modules/typescript/lib/typescript.js';
const before='e0cc78711e741c80bfb2d6459a622a9ed7560586',after='347c0278bd206246afe75b6dbaca1782c9e39da2';
function tree(node){const value={kind:ts.SyntaxKind[node.kind]};if(typeof node.text==='string')value.text=node.text;else if(typeof node.escapedText==='string')value.text=node.escapedText;
 const children=[];ts.forEachChild(node,child=>{if(child.kind<ts.SyntaxKind.FirstJSDocNode||child.kind>ts.SyntaxKind.LastJSDocNode)children.push(tree(child));});if(children.length)value.children=children;return value;}
const paths=['apps/worker/conversation/options.mjs','apps/worker/conversation/continuation/options.mjs'],results=[];
for(const path of paths){const parse=commit=>tree(ts.createSourceFile(path,execFileSync('git',['show',commit+':'+path],{encoding:'utf8'}),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));const a=parse(before),b=parse(after);assert.deepEqual(a,b);results.push({path,semanticAstEqual:true,sha256:createHash('sha256').update(JSON.stringify(a)).digest('hex')});}
const out={before,after,parserVersion:ts.version,results,jsdocAndArrowParameterParenthesesOnly:true};writeFileSync(new URL('./post-e0-ast-details.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
