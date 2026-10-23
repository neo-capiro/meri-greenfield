// Runs a ship kit's 05-measurement-prepare with node-only deployment inputs (decision O47): the release-E measurement
// packet refuses any non-node difference from its pinned C baseline, and the launch measurement covers only the node
// runtime. Writes deployment-inputs.measurement.json = the candidate inputs with images.proxy/proxySourceCommit set back
// to the pinned baseline, then calls prepare-measurement.mjs exactly as kit.mjs does with that one file swapped.
// Render and deploy keep deployment-inputs.candidate.json. Usage: node measurement-prepare-node-only.mjs <kit dir>
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const KIT=process.argv[2].replaceAll('\\','/');
const K=JSON.parse(readFileSync(`${KIT}/kit.json`,'utf8'));
const O=K.outDir,SRC=K.sourceRoot;
const json=f=>JSON.parse(readFileSync(f,'utf8'));
if(existsSync(`${O}/measurement-prepared`))throw new Error('already prepared');
const candidate=json(`${O}/deployment-inputs.candidate.json`),baseline=json(`${O}/baseline-C.deployment-inputs.pre-proxy.json`);
const measurement={...candidate,images:{...candidate.images,proxy:baseline.images.proxy,proxySourceCommit:baseline.images.proxySourceCommit}};
writeFileSync(`${O}/deployment-inputs.measurement.json`,JSON.stringify(measurement,null,2)+'\n',{flag:'wx'});
const r=spawnSync(process.execPath,[`${O}/measurement-packet/prepare-measurement.mjs`,'--source-root',SRC,'--request',`${O}/request.json`,
 '--product-receipt',`${O}/product-image-receipt.json`,'--deployment',`${O}/deployment-inputs.measurement.json`,
 '--policy',`${SRC}/infra/product-preview/first-chat/policy.json`,'--allocation',`${SRC}/infra/product-preview/first-chat/allocation.json`,
 '--project-role-arn',K.projectRoleArn,'--attempt',K.measurementAttempt,'--out',`${O}/measurement-prepared`],{cwd:O,encoding:'utf8',stdio:['ignore','pipe','pipe']});
process.stdout.write((r.stdout??'').split('\n').slice(-4).join('\n'));process.stderr.write((r.stderr??'').split('\n').slice(-6).join('\n'));
if(r.status!==0)process.exit(r.status??2);
console.log('\nOUTCOME payload prepared (node-only measurement inputs). NEXT 06-measurement-payload-put');
