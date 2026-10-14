/** Resolve only the pinned SDK owner's native package; never search PATH or fallback. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inside(root, file) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw Error('Native package escapes image root');
}

export function nativePackageName(platform, architecture, header) {
  if (platform !== 'linux' || !['x64', 'arm64'].includes(architecture)) throw Error('Unsupported image platform');
  if (!header || typeof header !== 'object') throw Error('Linux libc observation missing');
  // This qualification's pinned Bookworm image requires positive glibc evidence.
  // Absence of glibc metadata cannot establish that an unknown host is musl.
  if (typeof header.glibcVersionRuntime !== 'string' || !header.glibcVersionRuntime) throw Error('Pinned image glibc observation missing');
  return {name: '@anthropic-ai/claude-agent-sdk-linux-' + architecture, libc: 'glibc'};
}

export function assertExecutableStat(stat) {
  if (!stat.isFile() || stat.size < 1 || stat.size > 512 * 1024 * 1024 || (stat.mode & 0o111) === 0 || (stat.mode & 0o6022) !== 0) throw Error('Unsafe native executable mode or size');
}

export function resolveNativeCli({root, sdkEntry, platform = process.platform, architecture = process.arch, header = process.report.getReport().header}) {
  root = fs.realpathSync(root);
  sdkEntry = fs.realpathSync(sdkEntry);
  inside(root, sdkEntry);
  const sdkRoot = path.dirname(sdkEntry);
  const sdk = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'package.json'), 'utf8'));
  if (sdk.name !== '@anthropic-ai/claude-agent-sdk' || sdk.version !== '0.3.295' || path.basename(sdkEntry) !== 'sdk.mjs') throw Error('SDK owner pin differs');
  const {name, libc} = nativePackageName(platform, architecture, header);
  if (sdk.optionalDependencies?.[name] !== sdk.version) throw Error('Native optional dependency pin differs');
  const require = createRequire(sdkEntry);
  const packagePath = fs.realpathSync(require.resolve(name + '/package.json'));
  inside(root, packagePath);
  const packageRoot = path.dirname(packagePath);
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.name !== name || pkg.version !== sdk.version || !pkg.os?.includes(platform) || !pkg.cpu?.includes(architecture) || !pkg.libc?.includes(libc)) throw Error('Native package target differs');
  const candidate = require.resolve(name + '/claude');
  if (fs.lstatSync(candidate).isSymbolicLink()) throw Error('Native executable link refused');
  const executable = fs.realpathSync(candidate);
  inside(packageRoot, executable);
  if (executable !== path.join(packageRoot, 'claude')) throw Error('Unexpected native executable');
  assertExecutableStat(fs.statSync(executable));
  return {sdkEntry, sdkVersion: sdk.version, package: name, packageVersion: pkg.version, packageRoot, libc, path: executable, sha256: hash(executable)};
}

export function probeNativeCli(binding, env) {
  // Docker read-only/network-none bounds apply outside this subprocess. No ambient credentials.
  const before = hash(binding.path);
  if (before !== binding.sha256) throw Error('Native executable changed before probe');
  const version = execFileSync(binding.path, ['--version'], {env, timeout: 15000, maxBuffer: 64 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  if (!/^2\.1\.295(?:\s|$)/.test(version)) throw Error('Native CLI version differs');
  if (hash(binding.path) !== before) throw Error('Native executable changed during probe');
  return {...binding, version};
}
