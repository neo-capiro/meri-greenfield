/** Original immutable assets only. Control and the gateway own runtime admission. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assets from './assets.json' with {type:'json'};
import catalog from '../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {validateShape,assertCatalog} from '../contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../contracts/validate.mjs';
import {snapshotPreservationData} from '../contracts/retrieval-0.2/operation-contracts.mjs';

const key=(id,version)=>`${id}@${version}`;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
const index=new Map(assets.assets.map(asset=>[key(asset.skillId,asset.skillVersion),asset]));
const cache=new Map();

function verifyCatalog(){
  assertCatalog(catalog);
  if(assets.schema!=='meri-original-skill-assets/1'||index.size!==assets.assets.length||canonicalSha256(catalog)!==assets.catalogSha256)fail('SKILL_CATALOG_PIN');
}
function readAsset(path){
  const bytes=readFileSync(new URL(path,import.meta.url));
  if(bytes.length>65536)fail('SKILL_ASSET_LIMIT');
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('SKILL_ASSET_ENCODING');}
}
function load(asset){
  verifyCatalog();
  const manifest=JSON.parse(readAsset(asset.manifestPath)),prose=readAsset(asset.prosePath);
  validateShape('SkillManifest',manifest); // Not assertSkillManifest: unavailable operations must stay unavailable.
  if(manifest.skillId!==asset.skillId||manifest.skillVersion!==asset.skillVersion||
    manifest.prose.sha256!==asset.proseSha256||digest(Buffer.from(prose))!==asset.proseSha256||
    canonicalSha256(manifest)!==asset.manifestSha256)fail('SKILL_ASSET_PIN');
  const operations=manifest.allowedOperations.map(ref=>catalog.operations.find(row=>canonicalSha256(row.operation)===canonicalSha256(ref)));
  if(operations.some(row=>!row)||new Set(manifest.allowedOperations.map(ref=>key(ref.id,ref.version))).size!==operations.length)fail('SKILL_OPERATION_PIN');
  const required=manifest.requiredSources.map(canonicalSha256),declared=manifest.requiredSources.map(row=>`${row.sourceId}:${row.purpose}`);
  const legal=operations.flatMap(row=>row.sourceRequirements),derived=[...new Set(legal.map(row=>`${row.sourceId}:${row.purpose}`))];
  if(new Set(declared).size!==required.length||declared.length!==derived.length||declared.some(id=>!derived.includes(id))||
    required.some(hash=>!legal.some(row=>canonicalSha256(row)===hash)))fail('SKILL_SOURCE_PIN');
  return snapshotPreservationData({manifest,prose,pin:{skillId:asset.skillId,skillVersion:asset.skillVersion,
    manifestSha256:asset.manifestSha256,proseSha256:asset.proseSha256,catalogSha256:assets.catalogSha256}});
}

/** Explicit selection; no latest-version fallback, fuzzy routing, grants or activation. */
export function selectSkill(skillId,skillVersion){
  if(typeof skillId!=='string'||typeof skillVersion!=='string')fail('SKILL_SELECTION_REQUIRED');
  const identity=key(skillId,skillVersion),asset=index.get(identity);
  if(!asset)fail('SKILL_VERSION_UNAVAILABLE');
  if(!cache.has(identity))cache.set(identity,load(asset));
  return cache.get(identity);
}
export function listSkills(){
  verifyCatalog();
  return snapshotPreservationData(assets.assets.map(({skillId,skillVersion,manifestSha256,proseSha256})=>({skillId,skillVersion,manifestSha256,proseSha256})));
}
