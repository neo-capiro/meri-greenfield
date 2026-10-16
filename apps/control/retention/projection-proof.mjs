/** Exact restorable projection identity required by atomic watermark advancement. Internal adapter protocol, not a wire contract. */
import {own,data,hash,fail} from './boundary.mjs';
export const projectionSequence=row=>Math.max(Number.isSafeInteger(row?.ledgerSequence)?row.ledgerSequence:0,Number.isSafeInteger(row?.purge?.ledgerSequence)?row.purge.ledgerSequence:0);
export function advanceProof(value){
 const p=own(data(value),['key','projectionSha256','sequence','minimumSequence']);
 if(typeof p.key!=='string'||!p.key||!/^[a-f0-9]{64}$/u.test(p.projectionSha256??'')||!Number.isSafeInteger(p.sequence)||p.sequence<1||!Number.isSafeInteger(p.minimumSequence)||p.minimumSequence<0)fail('RETENTION_INVALID_REQUEST');return p;
}
export function assertExactProjection(row,proof){
 if(!row||hash(row)!==proof.projectionSha256||projectionSequence(row)!==proof.sequence)fail('RETENTION_PROJECTION_UNVERIFIED');
}
