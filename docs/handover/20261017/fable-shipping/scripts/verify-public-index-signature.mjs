/** Read-only check of the exact retained public Wolfi index/key; no package execution. */
import {readFileSync, lstatSync} from 'node:fs';
import {createHash, verify} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

if (process.argv.length === 3 && process.argv[2] === '--verify') {
  try {
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const read = (relative, size, expected) => {
      const path = fileURLToPath(new URL(relative, import.meta.url));
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== size) throw Error();
      const bytes = readFileSync(path);
      if (bytes.length !== size || hash(bytes) !== expected) throw Error();
      return bytes;
    };
    const index = read('../runtime-package-inputs/x86_64/APKINDEX.tar.gz', 10635138,
      '01398efd4ae98d03bf5cb2c9c5fe397399bca61b81c8cb0cb36bd90e230137c6');
    const key = read('../runtime-package-inputs/public-signing-key.txt', 800,
      'f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc');
    if (!key.toString('ascii').startsWith('-----BEGIN PUBLIC KEY-----\n') || key.includes('PRIVATE')) throw Error();
    // This fixed index has a699-byte first gzip member: one tar signature entry.
    const header = gunzipSync(index.subarray(0, 699), {maxOutputLength: 1024});
    const name = header.subarray(0, 100).toString('ascii').split('\0')[0];
    const size = Number.parseInt(header.subarray(124, 136).toString('ascii').replaceAll('\0', '').trim(), 8);
    if (header.length !== 1024 || name !== '.SIGN.RSA256.wolfi-signing.rsa.pub' || size !== 512 ||
        !verify('RSA-SHA256', index.subarray(699), key, header.subarray(512, 1024))) throw Error();
    console.log(JSON.stringify({status: 'PUBLIC_INDEX_RSA_SHA256_VERIFIED', packagesExecuted: false}));
  } catch {
    console.error('PUBLIC_INDEX_SIGNATURE_CHECK_REFUSED');
    process.exitCode = 2;
  }
} else {
  console.log('Usage: node verify-public-index-signature.mjs --verify | --help. Exit0 success/help;2 refusal. No network or writes.');
  if (!(process.argv.length === 3 && process.argv[2] === '--help')) process.exitCode = 2;
}
