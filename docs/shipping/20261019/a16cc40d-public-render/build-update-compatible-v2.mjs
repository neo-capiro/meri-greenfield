// v2: builds the update-compatible Stage 3 templates LOCALLY. No AWS call, no source change.
// Usage: node build-update-compatible-v2.mjs <liveDir> <bindingsDir> <outDir> <frozenSourceRoot>
//   liveDir     directory with the retained live templates (app.live.template.json; for the public 8080 target group)
//   bindingsDir output of `stage3-deploy.mjs bindings` for the new render (app.binding.json, model/issuer.template.json)
// Change from v1 (APP UPDATE_FAILED 2026-10-19T12:40:45Z): the live control service has AvailabilityZoneRebalancing ENABLED,
// which ECS refuses with maximumPercent <= 100. controlService now sets AvailabilityZoneRebalancing DISABLED explicitly.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [liveDir, bindingsDir, out, R] = process.argv.slice(2);
if (!R) throw new Error('usage: <liveDir> <bindingsDir> <outDir> <frozenSourceRoot>');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
if (existsSync(out)) throw new Error('output directory already exists');
mkdirSync(out, {recursive: true, mode: 0o700});
const {synthesizeProductPreview} = await import(pathToFileURL(join(R, 'infra/product-preview/manifest.mjs')).href);
const changes = [];
const liveApp = read(join(liveDir, 'app.live.template.json'));
const publicGroup = liveApp.Resources.controlService.Properties.LoadBalancers.find(x => x.ContainerPort === 8080);
if (!publicGroup || typeof publicGroup.TargetGroupArn !== 'string') throw new Error('live control service has no public 8080 target group');
const binding = read(join(bindingsDir, 'app.binding.json'));
binding.controlTargetGroupArn = publicGroup.TargetGroupArn;
changes.push('app: controlTargetGroupArn bound to the live public 8080 target group (optional synthesizer input)');
const app = synthesizeProductPreview(binding);
const set = (template, id, key, value, note) => { template.Resources[id].Properties[key] = value; changes.push(note); };
for (const id of ['controlService', 'temporalWorkerService']) set(app, id, 'DesiredCount', 1, `app ${id}: DesiredCount 0 -> 1`);
// control: exactly one control task at any time (runbook section 8); stop then start, no rolling overlap.
set(app, 'controlService', 'DeploymentConfiguration', {MaximumPercent: 100, MinimumHealthyPercent: 0}, 'app controlService: DeploymentConfiguration max 100 / minHealthy 0');
// ECS refuses max <= 100 while AZ rebalancing is ENABLED (the live value); a single task has nothing to rebalance.
set(app, 'controlService', 'AvailabilityZoneRebalancing', 'DISABLED', 'app controlService: AvailabilityZoneRebalancing ENABLED -> DISABLED (required by max 100)');
app.Resources.controlService.DependsOn = ['runnerTask'];
changes.push('app controlService: DependsOn runnerTask');
writeFileSync(join(out, 'app.template.json'), JSON.stringify(app));
const model = read(join(bindingsDir, 'model.template.json'));
for (const id of ['ModelOwnerService', 'ModelProxyService']) set(model, id, 'DesiredCount', 1, `model ${id}: DesiredCount 0 -> 1`);
writeFileSync(join(out, 'model.template.json'), JSON.stringify(model));
writeFileSync(join(out, 'issuer.template.json'), JSON.stringify(read(join(bindingsDir, 'issuer.template.json'))));
writeFileSync(join(out, 'changes.txt'), changes.join('\n') + '\n');
console.log(changes.join('\n'));
