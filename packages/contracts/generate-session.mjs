/** Additive browser session export generated from the CONTROL issuance schema. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {conversationSessionSchema} from './session-receipt/schema.mjs';
const HERE=new URL('./',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
export async function generateSessionContracts({check=false}={}){
 const [{default:Ajv},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{const schema=conversationSessionSchema(),ajv=new Ajv({strict:true,code:{source:true,esm:true}});ajv.addSchema(schema);
  const refs={validateReceipt:schema.$id+'#/$defs/ConversationSessionReceipt',validateExpected:schema.$id+'#/$defs/ConversationSessionExpectedContext'};
  for(const ref of Object.values(refs))ajv.compile({$ref:ref});
  const validator=await esbuild.build({absWorkingDir:fileURLToPath(HERE),preserveSymlinks:true,stdin:{contents:standalone(ajv,refs),sourcefile:'session-validator.mjs',resolveDir:fileURLToPath(HERE)},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',metafile:true});
  if(Object.values(validator.metafile.outputs).some(o=>o.imports.length))throw Error('Unexpected shared session validator import');
  const generated=validator.outputFiles[0].text;
  const bundled=await esbuild.build({absWorkingDir:fileURLToPath(HERE),preserveSymlinks:true,entryPoints:['conversation-session/receive.mjs'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',metafile:true,plugins:[{name:'session-validator',setup(b){b.onResolve({filter:/generated-validator\.mjs$/},()=>({path:'validator',namespace:'session'}));b.onLoad({filter:/.*/,namespace:'session'},()=>({contents:generated,resolveDir:fileURLToPath(HERE),loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Unexpected browser session import');
  const declarations=await compile({title:'ConversationSessionEnvelope',anyOf:Object.keys(schema.$defs).map(name=>({$ref:'#/$defs/'+name})),$defs:schema.$defs},'ConversationSessionEnvelope',{bannerComment:'// Generated from the canonical CONTROL session receipt. No authority.',style:{singleQuote:true}});
  const sources=[];for(const path of ['research-portfolio-scope.mjs','session-receipt/schema.mjs','session-receipt/validate.mjs','conversation-session/receive.mjs','document-application/boundary.mjs','generate-session.mjs']){const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});}
  const outputs=new Map([['../session-receipt/generated-validator.mjs',generated],['conversation-session.mjs',bundled.outputFiles[0].text],['conversation-session.schema.json',JSON.stringify(schema,null,2)+'\n'],['conversation-session.d.ts',declarations+`\nexport declare const conversationSessionVersion:'1.1.0';
export declare const conversationSessionMetadata:Readonly<{packageVersion:'0.1.43';sessionVersion:'1.1.0';responseBytes:4096;scopeSource:string;authority:string}>;
export declare class ConversationSessionResponseError extends Error {readonly code:'CONVERSATION_SESSION_REFUSED';}
export declare function receiveConversationSessionExpectedContext(utf8Bytes:Uint8Array):Readonly<ConversationSessionExpectedContext>;
export declare function receiveConversationSessionReceipt(utf8Bytes:Uint8Array,expectedContextBytes:Uint8Array,at:number):Readonly<ConversationSessionReceipt>;
`],['conversation-session.metadata.json',JSON.stringify({packageVersion:'0.1.43',schemaId:schema.$id,sources,browserInputs:Object.keys(bundled.metafile.inputs).sort(),browserImports:[]},null,2)+'\n']]);
  if(check){for(const[name,value]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==value)throw Error('Generated session drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,value]of outputs)await writeFile(new URL('dist/'+name,HERE),value);}
  return [...outputs.keys()];
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-session.mjs [--check|--help]');else if(args.length>1||args.length&&args[0]!=='--check'){console.error('Invalid arguments');process.exitCode=1;}else generateSessionContracts({check:args[0]==='--check'}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e);process.exitCode=1;});}
