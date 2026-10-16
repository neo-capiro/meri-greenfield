/** Synthetic source-only configuration; no HTTP listener, artifact generation or external owner. */
import test from 'node:test';import assert from 'node:assert/strict';
import {previewConfiguration} from '../preview-route.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';
test('synthetic: preview configuration preserves durable claim/object custody methods and their owner binding',async()=>{
 const calls=[],port={tag:'owner',async read(){return null;},async commit(){},async claim(value){calls.push([this.tag,'claim',value]);return {claimed:true,claim:value};},async recordObject(claim,object){calls.push([this.tag,'object',claim,object]);}};
 const config=previewConfiguration({previews:port,renderer:null});const claim={versionId:'synthetic'},object={objectId:'synthetic'};
 assert.deepEqual(await config.previews.claim(claim),{claimed:true,claim});await config.previews.recordObject(claim,object);
 assert.deepEqual(calls,[['owner','claim',claim],['owner','object',claim,object]]);
 assert.throws(()=>previewConfiguration({previews:{read(){},commit(){}},renderer:null}),/DOCUMENT_CONFIGURATION/);
 assert.equal(typeof createRuntimeArtifactApplication,'function','runtime composition imports inertly');
});
