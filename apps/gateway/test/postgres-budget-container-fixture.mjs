// Read-only transport binding for the already prepared local synthetic fixture.
// Importing is inert; only inspectPreparedContainer invokes the local Docker CLI.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isIP } from 'node:net';

const fail = () => { throw new Error('BUDGET_NATIVE_TEST_ADMISSION_REQUIRED'); };
const descriptorKeys = ['id', 'image', 'serverHost', 'serverPort'];
export function validPreparedContainer(c) {
  const p = c.preparedContainer;
  return c.host === '127.0.0.1' && c.port === 55432 && c.password === null &&
    p && !Array.isArray(p) && Object.keys(p).length === descriptorKeys.length &&
    descriptorKeys.every(k => Object.hasOwn(p, k)) &&
    typeof p.id === 'string' && /^[0-9a-f]{64}$/.test(p.id) &&
    typeof p.image === 'string' && /^sha256:[0-9a-f]{64}$/.test(p.image) &&
    typeof p.serverHost === 'string' && isIP(p.serverHost) === 4 &&
    /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(p.serverHost) &&
    p.serverPort === 5432;
}
export function assertPreparedContainerInspection(c, r) {
  if (!validPreparedContainer(c) || !r || r.id !== c.preparedContainer.id ||
      r.image !== c.preparedContainer.image || r.name !== '/meri-native-postgres' ||
      r.running !== true || r.purpose !== 'meri-native-tests' ||
      r.portCount !== 1 || !Array.isArray(r.bindings) || r.bindings.length !== 1 ||
      r.bindings[0]?.HostIp !== c.host || r.bindings[0]?.HostPort !== String(c.port) ||
      r.networkCount !== 1 || r.serverHost !== c.preparedContainer.serverHost ||
      !Array.isArray(r.mounts) || r.mounts.length !== 1 ||
      r.mounts[0]?.Type !== 'volume' || r.mounts[0]?.Name !== 'meri-native-postgres-data' ||
      r.mounts[0]?.Destination !== '/var/lib/postgresql/data' || r.mounts[0]?.RW !== true) fail();
}
const inspectFormat = '{"id":{{json .Id}},"image":{{json .Image}},"name":{{json .Name}},"running":{{json .State.Running}},"purpose":{{json (index .Config.Labels "purpose")}},"portCount":{{len .NetworkSettings.Ports}},"bindings":{{json (index .NetworkSettings.Ports "5432/tcp")}},"networkCount":{{len .NetworkSettings.Networks}},"serverHost":{{with index .NetworkSettings.Networks "bridge"}}{{json .IPAddress}}{{else}}null{{end}},"mounts":[{{$sep := ""}}{{range .Mounts}}{{$sep}}{"Type":{{json .Type}},"Name":{{json .Name}},"Destination":{{json .Destination}},"RW":{{json .RW}}}{{$sep = ","}}{{end}}]}';
export async function inspectPreparedContainer(c) {
  if (!validPreparedContainer(c)) fail();
  let r;
  try {
    const { stdout } = await promisify(execFile)('/usr/local/bin/docker',
      ['--host', 'unix:///var/run/docker.sock', 'inspect', '--format', inspectFormat, 'meri-native-postgres'],
      { env: { PATH: '/usr/local/bin:/usr/bin:/bin' }, timeout: 5000, maxBuffer: 8192, encoding: 'utf8' });
    r = JSON.parse(stdout);
  } catch { fail(); } // Do not expose CLI stderr, arbitrary metadata or configuration.
  assertPreparedContainerInspection(c, r);
}
