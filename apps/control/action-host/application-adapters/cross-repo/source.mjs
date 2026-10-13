/** Qualification loader only: exact Git blobs -> transient AST/JS, no vendored bodies. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import vm from 'node:vm';
import pins from './pins.json' with {type:'json'};
const hash=x=>createHash('sha256').update(x).digest('hex');
export function readPinnedSource({sourceRepository,typescriptModulePath}){
 if(!isAbsolute(sourceRepository)||!isAbsolute(typescriptModulePath))throw Error('PINNED_SOURCE_CONFIGURATION');
 const git=args=>execFileSync('git',['-c','gc.auto=0','--git-dir='+resolve(sourceRepository),...args],{encoding:'utf8',timeout:5000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
 if(git(['rev-parse',pins.commit+'^{tree}']).trim()!==pins.tree)throw Error('PINNED_SOURCE_TREE');
 const sources=new Map();for(const member of pins.members){const source=git(['show',pins.commit+':'+member.path]);if(Buffer.byteLength(source)!==member.bytes||hash(source)!==member.sha256)throw Error('PINNED_SOURCE_HASH');sources.set(member.path,source);}
 const bytes=readFileSync(typescriptModulePath);if(bytes.length!==pins.compiler.bytes||hash(bytes)!==pins.compiler.sha256)throw Error('PINNED_COMPILER_HASH');
 const ts=createRequire(import.meta.url)(typescriptModulePath);if(ts.version!==pins.compiler.version)throw Error('PINNED_COMPILER_VERSION');
 const selections=[];
 function source(path){if(!sources.has(path))throw Error('UNPINNED_SOURCE');return sources.get(path);}
 function select(path,{declarations,owner,methods}){
  const text=source(path),ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let result;
  if(owner){const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===owner);if(!cls)throw Error('PINNED_CLASS_MISSING');const selected=methods.map(name=>{const n=cls.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(ast)===name);if(!n)throw Error('PINNED_METHOD_MISSING');selections.push({path,owner,method:name,sha256:hash(n.getText(ast))});return n;});result=[ts.factory.updateClassDeclaration(cls,cls.modifiers,cls.name,cls.typeParameters,cls.heritageClauses,selected)];}
  else result=declarations.map(name=>{const n=ast.statements.find(n=>n.name?.text===name||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)===name));if(!n)throw Error('PINNED_DECLARATION_MISSING');selections.push({path,declaration:name,sha256:hash(n.getText(ast))});return n;});
  return ts.createPrinter().printList(ts.ListFormat.MultiLine,ts.factory.createNodeArray(result),ast);
 }
 function compile(path,imports={},globals={},selection){
  const text=selection?select(path,selection):source(path),module={exports:{}};
  try{const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,esModuleInterop:true}}).outputText;
   vm.runInNewContext(js,{module,exports:module.exports,Object,Reflect,Array,Number,String,Boolean,Math,JSON,Map,Set,WeakMap,WeakSet,Promise,Error,TypeError,Buffer,URL,setTimeout,clearTimeout,process:{env:{}},...globals,require(id){if(Object.hasOwn(imports,id))return imports[id];throw Error('UNADMITTED_IMPORT');}},{filename:'pinned-owner.js',timeout:1000});
  }catch{throw Error('PINNED_OWNER_LOAD_REFUSED:'+path);}return module.exports;
 }
 return Object.freeze({compile,metadata:()=>({commit:pins.commit,tree:pins.tree,sourceMembers:pins.members.map(({path,bytes,sha256})=>({path,bytes,sha256})),compiler:pins.compiler,selections:[...selections]})});
}
