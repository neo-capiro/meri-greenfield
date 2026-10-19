/** Public verification pins for the existing Core retained-principal wire.
 * No secret, key generation, source enablement or network action belongs here. */
import {createPublicKey} from 'node:crypto';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOperationIds,retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';

export function compileRetainedReadAuthority(raw){
 const c=data(own(raw,['issuerId','keyId','publicKeyJwk','recipients']));
 if([c.issuerId,c.keyId].some(value=>typeof value!=='string'||! /^[\x21-\x7e]{1,256}$/u.test(value)))throw Error('READS_CONFIGURATION');
 const jwk=own(c.publicKeyJwk,['kty','crv','x']);
 if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||typeof jwk.x!=='string'||
   !/^[A-Za-z0-9_-]{43}$/u.test(jwk.x)||Buffer.from(jwk.x,'base64url').length!==32||
   Buffer.from(jwk.x,'base64url').toString('base64url')!==jwk.x||
   createPublicKey({key:jwk,format:'jwk'}).asymmetricKeyType!=='ed25519')throw Error('READS_CONFIGURATION');
 const recipients=own(c.recipients,retainedOperationIds);
 Object.values(recipients).forEach(retainedOrigin);
 if(recipients.get_research_portfolio!==recipients.get_research_portfolio_changes)throw Error('READS_CONFIGURATION');
 return Object.freeze({...c,publicKeyJwk:Object.freeze(jwk),recipients:Object.freeze(recipients)});
}
