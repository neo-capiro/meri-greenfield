/** Award identity for federal procurement rows: the full canonical key, never a PIID alone.
 *
 * A PIID is not unique across the federal market (the retained 31 October 2026 clone probe counted 219 ambiguous
 * PIIDs over 168373 PIIDs and 170041 distinct award_unique_id values), and numeric or short PIIDs are legitimate
 * identifiers that must never be quarantined. The Lane 6 correction review therefore requires that every award be
 * resolved by its FULL identity (PIID plus awarding agency/subtier, plus the parent IDV PIID and parent subtier when
 * the award is under an IDV, or a source-authoritative award id) and that a transaction key depend on that resolved
 * identity plus a validated source action (modification and transaction numbers), with zero, multiple, malformed and
 * mismatched-parent matches failing closed rather than falling back to the first PIID row.
 *
 * This module is the one owner of those rules inside Meri. The federal-market receiver uses it to refuse source pages
 * that collapse distinct awards onto one PIID, and the Money Flow reproduction (`money-flow.mjs`) keys every award and
 * logical action with it. It performs no I/O and holds no data. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const text=value=>typeof value==='string'&&value.trim()!==''?value.trim():null;
/** Collision-safe component encoding: each component is length-prefixed, so '1|2' and '1','2' never meet. */
const encode=parts=>parts.map(part=>part===null?'-':`${part.length}:${part}`).join('|');
/** A PIID is any non-empty printable string; digits-only and short values are accepted on purpose. */
export function piidText(value){
 const piid=text(value);
 if(piid===null||piid.length>64||!/^[\x21-\x7e]+$/u.test(piid))fail('AWARD_PIID_MALFORMED');
 return piid;
}
/** The full award identity of one source row.
 * @param {{piid:unknown,awardingSubtierCode:unknown,parentPiid?:unknown,parentSubtierCode?:unknown,awardUniqueId?:unknown}} row
 * @returns {{kind:'direct'|'under_idv',piid:string,awardingSubtierCode:string,parentPiid:string|null,parentSubtierCode:string|null,awardUniqueId:string|null,key:string}} */
export function awardIdentity(row){
 if(row===null||typeof row!=='object'||Array.isArray(row))fail('AWARD_ROW_MALFORMED');
 const piid=piidText(row.piid),awardingSubtierCode=text(row.awardingSubtierCode);
 if(awardingSubtierCode===null||!/^[0-9A-Z]{2,8}$/u.test(awardingSubtierCode))fail('AWARD_AGENCY_MISSING');
 const parentPiid=row.parentPiid===undefined||row.parentPiid===null?null:piidText(row.parentPiid);
 const parentSubtierCode=text(row.parentSubtierCode);
 // A parent PIID without its subtier (or the reverse) is an under-scoped parent, not a direct award.
 if((parentPiid===null)!==(parentSubtierCode===null))fail('AWARD_PARENT_PARTIAL');
 const awardUniqueId=text(row.awardUniqueId);
 if(awardUniqueId!==null&&!/^(CONT_AWD|CONT_IDV)_[\x21-\x7e]{1,255}$/u.test(awardUniqueId))fail('AWARD_UNIQUE_ID_MALFORMED');
 // A composite award_unique_id is parsed, not substring-matched: its PIID component must agree with the row.
 if(awardUniqueId!==null&&awardUniqueId.split('_')[2]!==piid)fail('AWARD_UNIQUE_ID_MISMATCH');
 const kind=parentPiid===null?'direct':'under_idv';
 return Object.freeze({kind,piid,awardingSubtierCode,parentPiid,parentSubtierCode,awardUniqueId,
  key:encode([kind,piid,awardingSubtierCode,parentPiid,parentSubtierCode])});
}
/** Resolve exactly one award among candidate rows for the identity a transaction claims. Row order never matters;
 * zero, several, or a claimed parent that no candidate carries each fail with their own code.
 * @param {ReadonlyArray<object>} candidates @param {object} claim */
export function resolveAward(candidates,claim){
 if(!Array.isArray(candidates))fail('AWARD_CANDIDATES_MALFORMED');
 const wanted=awardIdentity(claim),matches=[];
 for(const candidate of candidates)if(awardIdentity(candidate).key===wanted.key)matches.push(candidate);
 if(matches.length===0){
  // The claimed parent exists on no candidate sharing this PIID and agency: a mismatched parent, not a plain miss.
  const samePiid=candidates.filter(candidate=>{const identity=awardIdentity(candidate);return identity.piid===wanted.piid&&identity.awardingSubtierCode===wanted.awardingSubtierCode;});
  fail(samePiid.length&&wanted.kind==='under_idv'?'AWARD_PARENT_MISMATCH':'AWARD_NOT_FOUND');
 }
 if(matches.length>1)fail('AWARD_AMBIGUOUS');
 return Object.freeze({identity:wanted,award:matches[0]});
}
/** The collision-safe logical transaction key: resolved full award identity plus the validated source action.
 * Transaction number 0 and modification "0" are legitimate values and survive; a missing action component fails.
 * @param {ReturnType<typeof awardIdentity>} identity @param {{modificationNumber:unknown,transactionNumber:unknown}} action */
export function transactionKey(identity,action){
 if(action===null||typeof action!=='object')fail('ACTION_MALFORMED');
 const modification=text(action.modificationNumber);
 if(modification===null||modification.length>32||!/^[\x21-\x7e]+$/u.test(modification))fail('ACTION_MODIFICATION_MISSING');
 const transaction=action.transactionNumber;
 if(!Number.isSafeInteger(transaction)||transaction<0)fail('ACTION_TRANSACTION_MISSING');
 return encode([identity.key,modification,String(transaction)]);
}
/** The receiver rule for a federal-market contract-award page: rows are distinct by their source row `id`; a page is
 * refused only when two rows share an id, never because two rows share a PIID (`awardId`) and never because a PIID is
 * numeric or short. @param {ReadonlyArray<{id:string,awardId:string|null}>} items */
export function assertAwardRowsDistinct(items){
 if(!Array.isArray(items))fail('AWARD_ROWS_MALFORMED');
 const seen=new Set();
 for(const row of items){
  if(row===null||typeof row!=='object'||typeof row.id!=='string'||row.id==='')fail('AWARD_ROW_ID_MISSING');
  if(seen.has(row.id))fail('AWARD_ROW_ID_DUPLICATE');seen.add(row.id);
  if(row.awardId!==null&&row.awardId!==undefined)piidText(row.awardId);
 }
 return items;
}
