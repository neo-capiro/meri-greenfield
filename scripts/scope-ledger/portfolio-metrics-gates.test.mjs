/** M40: the hub/Portfolio metric gates (Core 354 G02 tracker metrics, Core 355 G03 recorded activity) are enabled only by
 *  Release on the frontend/Core side. No Meri source, configuration or infrastructure may read, default or render them. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),self=fileURLToPath(import.meta.url);
const GATES=['CAPIRO_RECORDED_ACTIVITY_VERSION','CAPIRO_TRACKER_METRICS_VERSION'];
const SKIP=new Set(['node_modules','dist','.git','evidence']);
function* files(dir){for(const name of readdirSync(dir)){if(SKIP.has(name))continue;const path=join(dir,name);const s=statSync(path);
 if(s.isDirectory())yield* files(path);else if(/\.(mjs|ts|json|yml|yaml|env|sh)$/u.test(name)&&path!==self)yield path;}}
test('no Meri source, configuration or infrastructure reads or sets the hub/Portfolio metric gates',()=>{
 const hits=[];
 for(const scope of ['apps','packages','infra','scripts'])for(const path of files(join(root,scope))){
  const text=readFileSync(path,'utf8');for(const gate of GATES)if(text.includes(gate))hits.push(`${path}: ${gate}`);
 }
 assert.deepEqual(hits,[]);
});
