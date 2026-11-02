#!/usr/bin/env node
/** Build-time publication of the signed ClamAV definition snapshot the AgentCore inspection image serves.
 *
 * `apps/runtime/Dockerfile` runs this ONCE, as root, while the image is being built, into
 * `UPLOAD_BAKED_DEFINITIONS_ROOT`. It is the SAME updater and the SAME store the hosts use (`native-definitions.mjs`):
 * freshclam fetches the full signed `.cvd` containers into a staging area, every container is verified against the
 * publisher signature with `sigtool --info`, the verified set is published as a content-addressed immutable snapshot
 * and `current` is moved onto it. The publication is then re-resolved through the read-only store exactly as a scan
 * would resolve it, so an image whose baked snapshot would not serve cannot be built. The provenance it prints
 * (stdout, one JSON object: the snapshot's public hash, publication time, container names and the age it may serve)
 * is kept in the image at `/usr/share/meri/upload-definitions-provenance.json`, and the runtime's startup event
 * reports the same hash and date, so an operator can read from a container's log which definitions it scans with.
 *
 * It takes no network, mirror, program or path from its arguments beyond the root to publish into: the mirror is the
 * fixed vendor CDN in the freshclam configuration the updater writes, and the programs are the fixed image paths.
 * Exit 0 on a proved publication, 2 on any failure (nothing partial is ever left under `current`). */
import {pathToFileURL} from 'node:url';
import {createSignedDefinitionStore,createSignedDefinitionUpdater,runDefinitionProgram} from './native-definitions.mjs';
import {UPLOAD_BAKED_DEFINITIONS_ROOT,UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS} from './native-sandbox.mjs';

/** A full signed download plus verification, generously bounded; the build fails rather than waits longer. */
export const UPLOAD_DEFINITIONS_BAKE_MS=10*60*1000;

export async function bakeUploadDefinitions({root=UPLOAD_BAKED_DEFINITIONS_ROOT,now=Date.now,run=runDefinitionProgram,
 deadlineMs,maxAgeMs=UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS,chmod,chown,lstat}={}){
 const until=Number.isSafeInteger(deadlineMs)?deadlineMs:now()+UPLOAD_DEFINITIONS_BAKE_MS;
 const updater=createSignedDefinitionUpdater({root,run,now,...(chmod===undefined?{}:{chmod}),...(chown===undefined?{}:{chown}),
  ...(lstat===undefined?{}:{lstat})});
 const published=await updater.provision({deadlineMs:until});
 // Prove the publication the way the image will resolve it: the read-only store over the same root, same signature
 // re-verification, same age bound. A snapshot that does not resolve here would not resolve for a scan either.
 const store=createSignedDefinitionStore({root,now,run,maxAgeMs});
 const resolved=await store.snapshot({deadlineMs:until});
 try{resolved.reader.release({completed:true});}catch{}
 if(resolved.sha256!==published.sha256)throw Object.assign(new Error('UPLOAD_DEFINITIONS_BAKE_MISMATCH'),{code:'UPLOAD_DEFINITIONS_BAKE_MISMATCH'});
 return Object.freeze({root,sha256:resolved.sha256,publishedAt:resolved.publishedAt,publishedAtMs:resolved.publishedAtMs,
  files:resolved.files.map(file=>file.name),maxAgeMs});
}

export async function main(argv=process.argv.slice(2),{stdout=process.stdout,stderr=process.stderr}={}){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){stdout.write('Bake the signed ClamAV definition snapshot into an image root: definitions-bake-cli.mjs [root]. Prints the publication provenance as JSON. Exit 0 proved, 2 failed.\n');return 0;}
 if(argv.length>1||argv.length===1&&!argv[0].startsWith('/')){stderr.write('UPLOAD_DEFINITIONS_BAKE_USAGE\n');return 2;}
 try{const provenance=await bakeUploadDefinitions(argv.length===1?{root:argv[0]}:{});stdout.write(JSON.stringify(provenance)+'\n');return 0;}
 catch(error){stderr.write((typeof error?.code==='string'?error.code:'UPLOAD_DEFINITIONS_BAKE_FAILED')+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
