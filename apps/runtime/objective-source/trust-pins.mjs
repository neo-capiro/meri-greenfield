/** Reader v2 trust pins from Core's three signing public keys (D7-2: Core signs Objective reader v2 tokens with AWS KMS
 * Ed25519 keys; Meri holds no private key and makes no KMS call). Input is what `kms:GetPublicKey` returns for each purpose key:
 * the DER SubjectPublicKeyInfo bytes (base64 or bytes), `KeySpec` and `KeyUsage`. Output is exactly the `trust` record
 * `createObjectiveSourceReaderGate` pins: `{[purpose]:{issuer,publicKeys:{[kid]:{kty:'OKP',crv:'Ed25519',x}}}}`.
 *
 * Refuses: a missing or extra purpose, a non-Ed25519 or non-SIGN_VERIFY key, a key or issuer reused across purposes (the
 * contract forbids sharing key material between purposes), more than four keys per purpose (the gate's bound, for rotation)
 * and a kid outside the gate's pattern. The signer must produce PURE Ed25519 (RFC 8032) signatures over the JWS signing input;
 * the gate verifies with `crypto.verify(null, …)`, so a pre-hashed Ed25519ph signature can never verify. */
import {createPublicKey,createHash} from 'node:crypto';
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readerPurposes} from '../../../packages/contracts/objective-reader-2/schema.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_READER_V2_TRUST_CONFIGURATION'),{code:'OBJECTIVE_READER_V2_TRUST_CONFIGURATION'});
const KID=/^[A-Za-z0-9._-]{1,64}$/u,BASE64=/^[A-Za-z0-9+/]+={0,2}$/u;
function der(value){
 if(typeof value==='string'){if(!BASE64.test(value)||value.length>4096)throw fault();const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw fault();return bytes;}
 if(value instanceof Uint8Array&&!types.isProxy(value)&&value.byteLength>0&&value.byteLength<=4096)return Buffer.from(value);
 throw fault();
}
export function objectiveReaderTrustFromPublicKeys(raw){
 try{
  const purposes=Object.keys(readerPurposes),record=own(raw,purposes),issuers=new Set(),seen=new Set(),trust={};
  for(const purpose of purposes){
   const entry=own(record[purpose],['issuer','keys']);
   if(typeof entry.issuer!=='string'||entry.issuer.length<1||entry.issuer.length>256||entry.issuer.trim()!==entry.issuer||issuers.has(entry.issuer))throw fault();issuers.add(entry.issuer);
   if(!Array.isArray(entry.keys)||types.isProxy(entry.keys)||entry.keys.length<1||entry.keys.length>4)throw fault();
   const publicKeys={};
   for(const item of entry.keys){
    const k=own(item,['kid','publicKey','keySpec','keyUsage']);
    if(typeof k.kid!=='string'||!KID.test(k.kid)||Object.hasOwn(publicKeys,k.kid)||k.keySpec!=='ECC_NIST_EDWARDS25519'||k.keyUsage!=='SIGN_VERIFY')throw fault();
    const key=createPublicKey({key:der(k.publicKey),format:'der',type:'spki'});if(key.asymmetricKeyType!=='ed25519')throw fault();
    const fingerprint=createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');if(seen.has(fingerprint))throw fault();seen.add(fingerprint);
    const jwk=key.export({format:'jwk'});if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||typeof jwk.x!=='string')throw fault();
    publicKeys[k.kid]=Object.freeze({kty:'OKP',crv:'Ed25519',x:jwk.x});
   }
   trust[purpose]=Object.freeze({issuer:entry.issuer,publicKeys:Object.freeze(publicKeys)});
  }
  return Object.freeze(trust);
 }catch{throw fault();}
}
