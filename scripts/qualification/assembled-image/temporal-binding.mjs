/** The runtime owns Temporal resolution; both hoisted and prefix installs remain image-contained. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
export function resolveTemporal(root) {
  root=fs.realpathSync(root);
  const runtime=path.join(root,'apps/runtime');
  const owner=JSON.parse(fs.readFileSync(path.join(runtime,'package.json'),'utf8'));
  if(owner.name!=='@meri/assembled-runtime'||owner.dependencies?.['@temporalio/worker']!=='1.24.0')throw Error('Temporal runtime owner pin differs');
  const require=createRequire(path.join(runtime,'temporal-worker.mjs'));
  const entry=fs.realpathSync(require.resolve('@temporalio/worker'));
  const packageFile=fs.realpathSync(require.resolve('@temporalio/worker/package.json'));
  const packageRoot=path.dirname(packageFile);
  const pkg=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  const inside=(base,file)=>{const relative=path.relative(base,file);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
  if(pkg.name!=='@temporalio/worker'||pkg.version!==owner.dependencies['@temporalio/worker']||!inside(root,packageFile)||!inside(packageRoot,entry))throw Error('Temporal package binding differs');
  return {entry,version:pkg.version,packageRoot,name:pkg.name};
}
