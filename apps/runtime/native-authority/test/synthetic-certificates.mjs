// Throwaway X.509 material for the composed TLS tests, in Node alone (no openssl at import, which the runtime image does not carry): an
// EC P-256 CA (basicConstraints CA:TRUE, keyCertSign/cRLSign) and a localhost server leaf it signs (SAN DNS:localhost, serverAuth,
// CA:FALSE), valid from an hour ago for two days. Test-only.
import {X509Certificate, createHash, generateKeyPairSync, randomBytes, sign} from 'node:crypto';

const length = n => { if (n < 0x80) return Buffer.from([n]); const bytes = []; for (let v = n; v > 0; v >>>= 8) bytes.unshift(v & 0xff); return Buffer.from([0x80 | bytes.length, ...bytes]); };
const tlv = (tag, ...parts) => { const value = Buffer.concat(parts); return Buffer.concat([Buffer.from([tag]), length(value.length), value]); };
const sequence = (...parts) => tlv(0x30, ...parts);
const oid = dotted => { const [a, b, ...rest] = dotted.split('.').map(Number), bytes = [40 * a + b];
  for (const n of rest) { const chunk = [n & 0x7f]; for (let v = n >>> 7; v > 0; v >>>= 7) chunk.unshift(0x80 | (v & 0x7f)); bytes.push(...chunk); }
  return tlv(0x06, Buffer.from(bytes)); };
const integer = bytes => tlv(0x02, bytes[0] & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes);
const bitString = bytes => tlv(0x03, Buffer.from([0]), bytes);
const time = date => tlv(0x17, Buffer.from(date.toISOString().replace(/[-:T]/gu, '').slice(2, 14) + 'Z'));
const name = commonName => sequence(tlv(0x31, sequence(oid('2.5.4.3'), tlv(0x0c, Buffer.from(commonName)))));
const extension = (id, critical, value) => sequence(oid(id), ...(critical ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, value));
const ECDSA_SHA256 = sequence(oid('1.2.840.10045.4.3.2'));
const pem = der => `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;
/** A positive 16-byte serial in minimal DER form (no leading zero byte). */
const serial = () => { const bytes = randomBytes(16); bytes[0] = (bytes[0] & 0x7f) | 0x01; return bytes; };
const keyId = spki => createHash('sha1').update(spki).digest();

function certificate({subject, issuer, spki, signingKey, issuerSpki, extensions}) {
  const now = Date.now();
  const tbs = sequence(tlv(0xa0, integer(Buffer.from([2]))), integer(serial()), ECDSA_SHA256, name(issuer),
    sequence(time(new Date(now - 3600000)), time(new Date(now + 2 * 86400000))), name(subject), spki,
    tlv(0xa3, sequence(extension('2.5.29.14', false, tlv(0x04, keyId(spki))), extension('2.5.29.35', false, sequence(tlv(0x80, keyId(issuerSpki)))), ...extensions)));
  return pem(sequence(tbs, ECDSA_SHA256, bitString(sign('sha256', tbs, signingKey))));
}

/** {ca, key, cert}: the CA certificate PEM and the localhost server's private key and certificate PEMs. */
export function syntheticServerCertificates() {
  const ca = generateKeyPairSync('ec', {namedCurve: 'prime256v1'}), server = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const caSpki = ca.publicKey.export({type: 'spki', format: 'der'}), serverSpki = server.publicKey.export({type: 'spki', format: 'der'});
  const caPem = certificate({subject: 'synthetic-control-ca', issuer: 'synthetic-control-ca', spki: caSpki, signingKey: ca.privateKey, issuerSpki: caSpki, extensions: [
    extension('2.5.29.19', true, sequence(tlv(0x01, Buffer.from([0xff])))), extension('2.5.29.15', true, tlv(0x03, Buffer.from([1, 0x06])))]});
  const cert = certificate({subject: 'localhost', issuer: 'synthetic-control-ca', spki: serverSpki, signingKey: ca.privateKey, issuerSpki: caSpki, extensions: [
    extension('2.5.29.19', false, sequence()), extension('2.5.29.37', false, sequence(oid('1.3.6.1.5.5.7.3.1'))), extension('2.5.29.17', false, sequence(tlv(0x82, Buffer.from('localhost'))))]});
  if (!new X509Certificate(cert).verify(new X509Certificate(caPem).publicKey)) throw Error('SYNTHETIC_CERTIFICATE_INVALID');
  return {ca: Buffer.from(caPem), key: Buffer.from(server.privateKey.export({type: 'pkcs8', format: 'pem'})), cert: Buffer.from(cert)};
}
