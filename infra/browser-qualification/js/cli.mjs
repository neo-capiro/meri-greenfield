// W02-21 CLI entry behavior: exact argv validation, app tags, stack name
// and outdir. Exported by name for the composition entry; import is inert.
import { App, Tags } from 'aws-cdk-lib';
import { validateRunUUID, validateAssetsImage } from './config.mjs';
import { BrowserQualificationStack } from './stack.mjs';

function main() {
  if (process.argv.length !== 6 || process.argv[2] !== '--run-uuid' || process.argv[4] !== '--assets-image') {
    throw new Error('Usage: node infra/browser-qualification/app.mjs --run-uuid CANONICAL_UUID --assets-image SAME_REPO@sha256:HEX64');
  }
  const runUUID = validateRunUUID(process.argv[3]);
  const assetsImage = validateAssetsImage(process.argv[5]);
  const app = new App({ outdir: 'cdk.out/browser-qualification' });
  Tags.of(app).add('Project', 'meri-greenfield');
  Tags.of(app).add('Environment', 'qualification');
  Tags.of(app).add('Owner', 'Codex-integration');
  Tags.of(app).add('SourcesEnabled', 'false');
  new BrowserQualificationStack(app, 'MeriGreenfield-BrowserQualification', runUUID, assetsImage);
  app.synth();
}

// Cross-module access for the composition entry; not part of the public API.
export { main };
