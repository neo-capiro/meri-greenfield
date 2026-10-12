// Shared private selector grammar for stored federal status and bill-text reads.
// No clock, source lookup, provider, member resolution or authority decision.
const tokens=Object.freeze({hr:['h','r'],s:['s'],hjres:['h','j','res'],sjres:['s','j','res'],
  hconres:['h','con','res'],sconres:['s','con','res'],hres:['h','res'],sres:['s','res']});
const canonical=new RegExp(`^[0-9]{2,3}-(${Object.keys(tokens).join('|')})-[0-9]{1,5}$`);
const designations=Object.entries(tokens).map(([type,parts])=>
  [type,new RegExp(`^${parts.map(part=>`${part}\\.?`).join('\\s*')}\\s*([0-9]{1,5})$`,'i')]);

/** Resolve bounded caller-admitted syntax; the caller owns its text-size limit. */
export function resolveCongressionalBillId(selector,defaultCongress) {
  if ((selector!==null&&typeof selector!=='string') || !Number.isInteger(defaultCongress) ||
      defaultCongress<1 || defaultCongress>2147483647) throw new Error('Invalid congressional selector context');
  if(selector===null)return null;
  const text=selector.trim(),lower=text.toLowerCase();
  if(canonical.test(lower))return lower;
  const suffix=/\(([0-9]{2,3})(?:st|nd|rd|th)?\)\s*$/.exec(text);
  const congress=suffix?Number(suffix[1]):defaultCongress;
  const body=suffix?text.slice(0,suffix.index).trim():text;
  for(const [type,pattern] of designations){
    const match=pattern.exec(body);
    if(match){const number=Number(match[1]);return congress>0&&number>0?`${congress}-${type}-${number}`:null;}
  }
  return null;
}
