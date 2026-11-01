/** Narrow offline closure for the canonical artifact schema. No operation or persisted skill identity changes. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {executionSchemaSources} from './retrieval-0.2/execution-schema-sources.mjs';
import {CATALOG_OPERATION_BINDINGS} from './retrieval-0.2/catalog-validation.mjs';
import {canonicalSha256} from './validate.mjs';
const here=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=value=>`${value.id}@${value.version}`;
const fail=message=>{throw Error(message);};

export function bindArtifactCatalog(catalog,schema,sha256,bindings=CATALOG_OPERATION_BINDINGS){
 if(!/^[a-f0-9]{64}$/u.test(sha256)||typeof schema.$id!=='string'||!schema.$defs)fail('Invalid artifact schema');
 const selected=bindings.filter(binding=>binding.group==='artifacts');
 const expected=new Map(selected.map(binding=>[identity(binding),binding]));
 if(!selected.length||expected.size!==selected.length)fail('Missing or duplicate artifact bindings');
 const result=structuredClone(catalog),seen=new Set(),all=new Set();
 for(const row of result.operations){
  const key=identity(row.operation);if(all.has(key))fail('Duplicate catalog operation');all.add(key);
  const binding=expected.get(key);
  if(!binding){
   if([row.inputSchema,row.outputSchema].some(ref=>ref.id.startsWith(schema.$id+'#')))fail('Unexpected artifact catalog binding');
   continue;
  }
  seen.add(key);
  for(const [field,definition] of [['inputSchema',binding.input],['outputSchema',binding.output]]){
   if(!Object.hasOwn(schema.$defs,definition)||row[field].id!==`${schema.$id}#/$defs/${definition}`||!/^[a-f0-9]{64}$/u.test(row[field].sha256))fail('Unexpected artifact schema reference');
   row[field].sha256=sha256;
  }
 }
 if(seen.size!==expected.size)fail('Missing artifact catalog operation');
 return result;
}

export async function generateArtifactCatalog({check=false}={}){
 const sources=executionSchemaSources.filter(source=>source.group==='artifacts');
 if(sources.length!==1)fail('Missing or duplicate canonical artifact source');
 const sourceUrl=new URL(sources[0].path,new URL('retrieval-0.2/',here)),raw=await readFile(sourceUrl),schema=JSON.parse(raw),sha256=hash(raw);
 const planned=[],catalogs=[];
 for(const family of ['0.2','0.3']){
  const path=`retrieval-${family}/catalog.json`,before=await readFile(new URL(path,here),'utf8'),catalog=JSON.parse(before);
  const next=bindArtifactCatalog(catalog,schema,sha256);
  catalogs.push({before:canonicalSha256(catalog),after:canonicalSha256(next)});
  planned.push({path,before,after:JSON.stringify(next,null,2)+'\n'});
 }
 const assetPath='../skills/assets.json',assetBefore=await readFile(new URL(assetPath,here),'utf8'),assets=JSON.parse(assetBefore);
 if(assets.installationCatalogSha256!==catalogs[0].before)fail('Existing preserved installation pin mismatch');
 assets.installationCatalogSha256=catalogs[0].after;
 planned.push({path:assetPath,before:assetBefore,after:JSON.stringify(assets,null,2)+'\n'});
 const indexPath='../skills/index.mjs',indexBefore=await readFile(new URL(indexPath,here),'utf8');
 const pattern=/const installationCatalogSha256='([a-f0-9]{64})';/gu,matches=[...indexBefore.matchAll(pattern)];
 if(matches.length!==1||matches[0][1]!==catalogs[1].before)fail('Existing current installation pin mismatch');
 planned.push({path:indexPath,before:indexBefore,after:indexBefore.replace(pattern,`const installationCatalogSha256='${catalogs[1].after}';`)});
 const changes=planned.filter(item=>item.before!==item.after);
 if(check&&changes.length)fail('Artifact catalog closure drift: '+changes.map(item=>item.path).join(', '));
 if(!check)for(const item of changes)await writeFile(new URL(item.path,here),item.after);
 return {schemaId:schema.$id,schemaSha256:sha256,catalogs,changes:changes.map(item=>({path:item.path,beforeSha256:hash(item.before),afterSha256:hash(item.after)}))};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length>1||args.length&&args[0]!=='--check')throw Error('Usage: node generate-artifact-catalog.mjs [--check]');
 console.log(JSON.stringify(await generateArtifactCatalog({check:args[0]==='--check'}),null,2));
}
