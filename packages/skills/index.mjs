/** Original immutable assets only. Control and the gateway own runtime admission. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assets from './assets.json' with {type:'json'};
import catalog from '../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import installationCatalog from '../contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {assertCatalog} from '../contracts/retrieval-0.2/validate.mjs';
import {assertInstalledSkillManifest} from '../contracts/retrieval-0.3/installed-skill.mjs';
import {canonicalSha256} from '../contracts/validate.mjs';
import {snapshotPreservationData} from '../contracts/retrieval-0.2/operation-contracts.mjs';

const key=(id,version)=>`${id}@${version}`;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
const index=new Map(assets.assets.map(asset=>[key(asset.skillId,asset.skillVersion),asset]));
const cache=new Map();
// Current process installation, distinct from immutable persisted selection pins.
const installationCatalogSha256='ebe50de0d0de13ac69fd28444edc663c3cd5d3babb6d739a3c50b59ee8dcbedd';

function verifyCatalog(){
  assertCatalog(catalog);
  if(assets.schema!=='meri-original-skill-assets/1'||index.size!==assets.assets.length||canonicalSha256(catalog)!==assets.installationCatalogSha256)fail('SKILL_CATALOG_PIN');
  assertCatalog(installationCatalog);
  const installedRows=new Set(installationCatalog.operations.map(canonicalSha256));
  if(canonicalSha256(installationCatalog)!==installationCatalogSha256||
    installationCatalog.sourceRegistryCommit!==catalog.sourceRegistryCommit||
    catalog.operations.some(old=>!installedRows.has(canonicalSha256(old))))fail('SKILL_INSTALLATION_CATALOG_PIN');
}
function readAsset(path){
  const bytes=readFileSync(new URL(path,import.meta.url));
  if(bytes.length>65536)fail('SKILL_ASSET_LIMIT');
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('SKILL_ASSET_ENCODING');}
}
function load(asset){
  verifyCatalog();
  const manifest=JSON.parse(readAsset(asset.manifestPath)),prose=readAsset(asset.prosePath);
  // Admission is dispatched on the manifest's own contractVersion by the canonical installed-skill owner, not
  // by skillId: the closed 0.2.0 foundation keeps refusing every id it does not enumerate, an additive 0.3.0
  // identity is admitted only through the versioned receiver, and an unavailable operation stays unavailable.
  assertInstalledSkillManifest(manifest,catalog);
  assertInstalledSkillManifest(manifest,installationCatalog);
  if(manifest.skillId!==asset.skillId||manifest.skillVersion!==asset.skillVersion||
    manifest.prose.sha256!==asset.proseSha256||digest(Buffer.from(prose))!==asset.proseSha256||
    canonicalSha256(manifest)!==asset.manifestSha256)fail('SKILL_ASSET_PIN');
  return snapshotPreservationData({manifest,prose,installationCatalogSha256,pin:{skillId:asset.skillId,skillVersion:asset.skillVersion,
    manifestSha256:asset.manifestSha256,proseSha256:asset.proseSha256,catalogSha256:asset.catalogSha256??assets.catalogSha256}});
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
