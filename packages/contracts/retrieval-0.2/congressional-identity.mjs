// Shared private selector grammar for stored federal status and bill-text reads.
// No clock, source lookup, provider, member resolution or authority decision.
const tokens=Object.freeze({hr:['h','r'],s:['s'],hjres:['h','j','res'],sjres:['s','j','res'],
  hconres:['h','con','res'],sconres:['s','con','res'],hres:['h','res'],sres:['s','res']});
const canonical=new RegExp(`^([0-9]{1,3})-(${Object.keys(tokens).join('|')})-([0-9]{1,5})$`);
const designationType=Object.values(tokens).map(parts=>parts.map(part=>`${part}\\.?`).join('\\s*')).join('|');
const designationPatterns=digits=>Object.entries(tokens).map(([type,parts])=>
  [type,new RegExp(`^${parts.map(part=>`${part}\\.?`).join('\\s*')}\\s*([0-9]{1,${digits}})$`,'i')]);
const designations=designationPatterns(5),searchDesignations=designationPatterns(16);

/** Resolve bounded caller-admitted syntax; the caller owns its text-size limit. */
export function resolveCongressionalBillId(selector,defaultCongress) {
  if ((selector!==null&&typeof selector!=='string') || !Number.isInteger(defaultCongress) ||
      defaultCongress<1 || defaultCongress>2147483647) throw new Error('Invalid congressional selector context');
  if(selector===null)return null;
  const text=selector.trim(),lower=text.toLowerCase();
  const exact=canonical.exec(lower);
  if(exact)return Number(exact[1])>0&&Number(exact[3])>0?lower:null;
  return designationId(text,defaultCongress,designations);
}
function designationId(text,defaultCongress,patterns){
  const suffix=/\(([0-9]{1,3})(?:st|nd|rd|th)?\)\s*$/.exec(text);
  const congress=suffix?Number(suffix[1]):defaultCongress;
  const body=suffix?text.slice(0,suffix.index).trim():text;
  for(const [type,pattern] of patterns){
    const match=pattern.exec(body);
    if(match){const number=Number(match[1]);return congress>0&&congress<=999&&number>0?`${congress}-${type}-${number}`:null;}
  }
  return null;
}

/** Search-only projection of Core's canonical selector: exact lookup, invalid literal, or topic. Other reads keep their five-digit grammar. */
export function inspectCongressionalBillSearch(selector,defaultCongress,explicitCongress){
  if((selector!==null&&typeof selector!=='string')||!Number.isInteger(defaultCongress)||defaultCongress<1||defaultCongress>2147483647)throw Error('Invalid congressional selector context');
  const text=selector?.trim()??'',lower=text.toLowerCase();if(!text)return {kind:'topic'};
  const literal=new RegExp(`^(?:[0-9]+-(?:${Object.keys(tokens).join('|')})-|(?:[0-9]+)?\\s*(?:${designationType})\\s*(?:[+-]?[0-9]|$))`,'i').test(text);
  if(literal&&text.length>240)return {kind:'invalid'};
  const canonicalSearch=new RegExp(`^([0-9]{1,3})-(${Object.keys(tokens).join('|')})-([0-9]{1,16})$`).exec(lower);
  let billId;
  if(canonicalSearch)billId=lower;
  else{
    const prefix=new RegExp(`^([0-9]{1,3})\\s*(?=(?:${designationType})\\s*[+-]?[0-9])`,'i').exec(text);
    const congress=prefix?Number(prefix[1]):explicitCongress??defaultCongress;
    billId=designationId(prefix?text.slice(prefix[0].length):text,congress,searchDesignations);
    if(billId&&prefix&&Number(billId.split('-')[0])!==congress)billId=null;
  }
  const [congress,,number]=billId?.split('-')??[];
  if(!billId||!Number.isSafeInteger(Number(number))||Number(number)<1||!Number.isSafeInteger(Number(congress))||Number(congress)<1||Number(congress)>999||explicitCongress!==undefined&&Number(congress)!==explicitCongress)return {kind:literal?'invalid':'topic'};
  return {kind:'exact',billId};
}
