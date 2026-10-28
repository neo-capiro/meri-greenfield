/** Canonical installed-skill manifest admission, dispatched by the manifest's own contractVersion rather
 * than by its skillId, so a new identity can never be smuggled into the closed 0.2.0 family: a 0.2.0
 * manifest is validated by the frozen 0.2.0 shape and keeps refusing every id it does not enumerate, and a
 * 0.3.0 manifest is admitted only through the versioned 0.3.0 receiver, which composes that same shape from
 * the frozen file and enumerates only the identities added at 0.3.0.
 *
 * The catalog-consistency rules below are the ones the installed-asset loader already applied (an allowed
 * operation must exist in the installed catalog with that exact version, and every required source must be
 * declared by one of those operations). They are a data-consistency check over the frozen catalog, not an
 * authorization grant: an operation whose catalog entry is not enabled stays unavailable, and nothing here
 * mounts a tool, widens a scope or enables a source. */
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {validateShape} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';
import receiver from './skill-manifest.schema.json' with {type:'json'};

export const FROZEN_SKILL_CONTRACT_VERSION=Object.freeze('0.2.0');
export const ADDED_SKILL_CONTRACT_VERSION=Object.freeze(receiver['x-contractVersion']);
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const addedSkillIds=Object.freeze([...receiver.$defs.AddedSkillId.enum]);
const foundation=read('../retrieval-0.2/skill.schema.json');
if(foundation.$id!=='urn:meri:retrieval:skill:0.2.0'||!foundation.$defs?.SkillManifest)throw Error('SKILL_MANIFEST_FOUNDATION');
// Read-only composition: the frozen manifest shape, the 0.3.0 version constant and this version's ids.
const shape=foundation.$defs.SkillManifest;
if(receiver['x-composes']!==`${foundation.$id}#/$defs/SkillManifest`)throw Error('SKILL_MANIFEST_RECEIVER_COMPOSITION');
shape.properties.contractVersion={const:receiver['x-contractVersion']};
shape.properties.skillId={type:'string',enum:[...addedSkillIds]};
const ajv=new Ajv({strict:true,allErrors:true});
addFormats(ajv);
ajv.addSchema(read('../meri.schema.json'));
ajv.addSchema(read('../retrieval-0.2/common.schema.json'));
ajv.addSchema({$id:receiver.$id,$defs:{SkillManifest:shape}});
let check;

/** The contractVersion a manifest actually declares, or undefined. */
export const installedSkillContractVersion=manifest=>manifest===null||typeof manifest!=='object'||Array.isArray(manifest)?undefined:manifest.contractVersion;
/** True only for an identity the 0.3.0 receiver enumerates. */
export const addedSkillIdentity=skillId=>typeof skillId==='string'&&addedSkillIds.includes(skillId);
/** The versioned 0.3.0 manifest shape; refuses a 0.2.0 version constant and every identity 0.3.0 does not add. */
export function assertVersionedSkillManifest(manifest){
 if(!addedSkillIdentity(manifest?.skillId))throw Error('SkillManifest: skillId is not an installed 0.3.0 identity');
 check??=ajv.compile({$ref:receiver.$id+'#/$defs/SkillManifest'});
 if(!check(manifest))throw Error(`SkillManifest: ${ajv.errorsText(check.errors)}`);
 return manifest;
}
/** The installed catalog's own consistency rules, shared by both contract versions. */
export function assertInstalledSkillCatalog(manifest,catalog){
 if(!catalog||!Array.isArray(catalog.operations))throw Error('SKILL_CATALOG_UNAVAILABLE');
 const operations=manifest.allowedOperations.map(reference=>catalog.operations.find(row=>canonicalSha256(row.operation)===canonicalSha256(reference)));
 if(operations.some(row=>!row)||new Set(manifest.allowedOperations.map(reference=>`${reference.id}@${reference.version}`)).size!==operations.length)throw Error('SKILL_OPERATION_PIN');
 const declared=manifest.requiredSources.map(row=>`${row.sourceId}:${row.purpose}`),legal=operations.flatMap(row=>row.sourceRequirements),derived=[...new Set(legal.map(row=>`${row.sourceId}:${row.purpose}`))];
 if(new Set(declared).size!==declared.length||declared.length!==derived.length||declared.some(id=>!derived.includes(id))||
  manifest.requiredSources.some(row=>!legal.some(candidate=>canonicalSha256(candidate)===canonicalSha256(row))))throw Error('SKILL_SOURCE_PIN');
 return manifest;
}
/** One admission for an installed manifest, selected by its actual contractVersion. An unknown version is
 * refused rather than coerced into either family. */
export function assertInstalledSkillManifest(manifest,catalog){
 const version=installedSkillContractVersion(manifest);
 if(version===FROZEN_SKILL_CONTRACT_VERSION)validateShape('SkillManifest',manifest);
 else if(version===ADDED_SKILL_CONTRACT_VERSION)assertVersionedSkillManifest(manifest);
 else throw Error('SKILL_MANIFEST_CONTRACT_VERSION');
 return assertInstalledSkillCatalog(manifest,catalog);
}
export const installedSkillReceiver=Object.freeze({id:receiver.$id,composes:receiver['x-composes'],version:receiver['x-contractVersion'],added:addedSkillIds});
