/** Pure configuration reader for the browser host service process.
 *
 * No environment value is defaulted, minted or interpreted as authority: every required setting must be present and
 * well formed, otherwise it is reported by name. Reading configuration performs no I/O and no effect.
 */
const REQUIRED = Object.freeze([
  'MERI_HOST_SERVICE_WORKSPACE',
  'MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS',
  'MERI_HOST_SERVICE_VIEWER_BIND_PORT',
  'MERI_HOST_SERVICE_VIEWER_SERVER_NAME',
  'MERI_HOST_SERVICE_VIEWER_CERT_FILE',
  'MERI_HOST_SERVICE_VIEWER_KEY_FILE',
  'MERI_HOST_SERVICE_VIEWER_CLIENT_CA_FILE',
  'MERI_HOST_SERVICE_PEER_NAME',
  'MERI_HOST_SERVICE_PEER_FINGERPRINT',
]);
const ADDRESS = /^(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/u;
const NAME = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u;

/** @returns {{missing:string[],invalid:string[],config:object|null}} */
export function readBrowserHostServiceConfig(environment = {}) {
  const env = environment && typeof environment === 'object' ? environment : {};
  const missing = REQUIRED.filter(name => typeof env[name] !== 'string' || env[name].length === 0);
  const invalid = [];
  const text = name => (typeof env[name] === 'string' ? env[name] : '');
  if (!missing.includes('MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS') && !ADDRESS.test(text('MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS'))) invalid.push('MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS');
  if (!missing.includes('MERI_HOST_SERVICE_VIEWER_BIND_PORT')) {
    const port = text('MERI_HOST_SERVICE_VIEWER_BIND_PORT');
    if (!/^[1-9][0-9]{0,4}$/u.test(port) || Number(port) > 65535) invalid.push('MERI_HOST_SERVICE_VIEWER_BIND_PORT');
  }
  if (!missing.includes('MERI_HOST_SERVICE_VIEWER_SERVER_NAME') && !NAME.test(text('MERI_HOST_SERVICE_VIEWER_SERVER_NAME'))) invalid.push('MERI_HOST_SERVICE_VIEWER_SERVER_NAME');
  if (!missing.includes('MERI_HOST_SERVICE_PEER_NAME') && !NAME.test(text('MERI_HOST_SERVICE_PEER_NAME'))) invalid.push('MERI_HOST_SERVICE_PEER_NAME');
  if (!missing.includes('MERI_HOST_SERVICE_PEER_FINGERPRINT') && !/^[a-f0-9]{64}$/u.test(text('MERI_HOST_SERVICE_PEER_FINGERPRINT'))) invalid.push('MERI_HOST_SERVICE_PEER_FINGERPRINT');
  if (missing.length || invalid.length) return {missing, invalid, config: null};
  return {
    missing: [],
    invalid: [],
    config: Object.freeze({
      workspace: text('MERI_HOST_SERVICE_WORKSPACE'),
      viewer: Object.freeze({
        bind: Object.freeze({address: text('MERI_HOST_SERVICE_VIEWER_BIND_ADDRESS'), port: Number(text('MERI_HOST_SERVICE_VIEWER_BIND_PORT'))}),
        tls: Object.freeze({
          serverName: text('MERI_HOST_SERVICE_VIEWER_SERVER_NAME'),
          certFile: text('MERI_HOST_SERVICE_VIEWER_CERT_FILE'),
          keyFile: text('MERI_HOST_SERVICE_VIEWER_KEY_FILE'),
          clientCaFile: text('MERI_HOST_SERVICE_VIEWER_CLIENT_CA_FILE'),
        }),
        peer: Object.freeze({name: text('MERI_HOST_SERVICE_PEER_NAME'), fingerprintSha256: text('MERI_HOST_SERVICE_PEER_FINGERPRINT')}),
      }),
    }),
  };
}
