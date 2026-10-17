/** Offline alternative: installed json-schema-to-ts owns schema inference; TypeScript expands its result.
 * No DTO fields or schema interpretation are reproduced here. No temporary source or install is written. */
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export async function compileTaskCommandDeclarations(schema,names,{typescriptRoot,typeModulesRoot}){
 const require=createRequire(resolve(typescriptRoot,'package.json')),ts=(await import(pathToFileURL(require.resolve('typescript')).href)).default;
 const typeEntry=async name=>{const root=resolve(typeModulesRoot,name),pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));return resolve(root,pkg.types);};
 const entries={'json-schema-to-ts':await typeEntry('json-schema-to-ts'),'ts-algebra':await typeEntry('ts-algebra')};
 const input=resolve(typescriptRoot,'task-command-canonical-type-input.ts'),source="import type {FromSchema} from 'json-schema-to-ts';\nconst schema="+JSON.stringify(schema)+" as const;\n"+names.map(name=>`export type ${name}=FromSchema<{readonly $ref:'#/$defs/${name}';readonly $defs:typeof schema.$defs}>;`).join('\n');
 const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,types:[]};
 const host=ts.createCompilerHost(options),baseGet=host.getSourceFile.bind(host);
 host.getSourceFile=(path,version,onError,create)=>resolve(path)===input?ts.createSourceFile(input,source,version,true):baseGet(path,version,onError,create);
 host.resolveModuleNames=(modules,containingFile)=>modules.map(name=>entries[name]?{resolvedFileName:entries[name],extension:ts.Extension.Dts}:ts.resolveModuleName(name,containingFile,options,host).resolvedModule);
 const program=ts.createProgram([input],options,host),diagnostics=ts.getPreEmitDiagnostics(program);if(diagnostics.length)throw Error('Canonical schema type inference failed: '+ts.formatDiagnostics(diagnostics,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>typescriptRoot,getNewLine:()=>'\n'}));
 const checker=program.getTypeChecker(),file=program.getSourceFile(input),outputs=[];
 for(const declaration of file.statements.filter(ts.isTypeAliasDeclaration)){
  const type=checker.getTypeAtLocation(declaration.name),expanded=checker.typeToString(type,undefined,ts.TypeFormatFlags.NoTruncation|ts.TypeFormatFlags.InTypeAlias);
  if(expanded==='any'||expanded==='never'||/\b(?:FromSchema|ParseSchema|Canonical_|import\(|M\.)/u.test(expanded))throw Error('Unexpanded canonical public type '+declaration.name.text+': '+expanded.slice(0,160));
  outputs.push('export type '+declaration.name.text+' = '+expanded+';');
 }
 if(outputs.length!==names.length)throw Error('Missing canonical public declarations');
 return '// Generated from canonical schema by installed json-schema-to-ts and TypeScript. No authorization implied.\n'+outputs.join('\n')+'\n';
}
