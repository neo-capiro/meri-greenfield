// Future isolated-validator probe only. No image materialization, model or cloud calls.
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
const expected='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c';
const hash=createHash('sha256');for await(const chunk of createReadStream(process.execPath))hash.update(chunk);
const sha256=hash.digest('hex'),result={scope:'exact-node-metadata-only-not-image-acceptance',sha256,expectedSha256:expected,platform:process.platform,arch:process.arch,node:process.versions.node,zlib:process.versions.zlib,exactPinnedNode:sha256===expected};
console.log(JSON.stringify(result,null,2));
if(!result.exactPinnedNode||result.platform!=='linux'||result.arch!=='x64'||result.node!=='24.21.0')process.exitCode=1;
