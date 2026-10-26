/** Core's fixed 2000-unit part grid, with scalar-safe cuts at nominal or nominal-1. */
export function hearingFragmentLocationMatches({part,characterStart:start,characterEnd:end,totalCharacters:total},text){
 const first=part*2000,last=Math.min((part+1)*2000,total);
 if(![part,start,end,total,first].every(Number.isSafeInteger)||part<0||total<=6500||first>=total||start<0||end<=start||end>total||end-start>2001)return false;
 if(text!==undefined&&(typeof text!=='string'||text.length!==end-start||!text.isWellFormed()))return false;
 const startsWithPair=text===undefined||text.charCodeAt(0)>=0xd800&&text.charCodeAt(0)<=0xdbff&&text.charCodeAt(1)>=0xdc00&&text.charCodeAt(1)<=0xdfff;
 return (start===first||start===first-1&&startsWithPair)&&(end===last||last<total&&end===last-1);
}
