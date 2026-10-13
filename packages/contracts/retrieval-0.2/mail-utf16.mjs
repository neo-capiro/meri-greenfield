/** Complete Unicode scalars with existing UTF-16 positions and actual-end cursors. */
const high=n=>n>=0xd800&&n<=0xdbff;
const low=n=>n>=0xdc00&&n<=0xdfff;
const pair=(text,at)=>high(text.charCodeAt(at))&&low(text.charCodeAt(at+1));
const fail=()=>{throw Error('Mail UTF-16 boundary mismatch');};

export function createMailBodySection(text,bodyOffset,maxCharacters) {
 if(typeof text!=='string'||!text.isWellFormed()||!Number.isSafeInteger(bodyOffset)||bodyOffset<0||
    !Number.isSafeInteger(maxCharacters)||maxCharacters<1||maxCharacters>6000)fail();
 let start=Math.min(bodyOffset,text.length),end=Math.min(text.length,bodyOffset+maxCharacters);
 if(start>0&&pair(text,start-1))start--;
 if(end>start&&end<text.length&&pair(text,end-1))end--;
 // A one-unit request at an astral character must still advance by one scalar.
 if(end===start&&start<text.length)end=start+(pair(text,start)?2:1);
 return {start,endExclusive:end,totalCodeUnits:text.length,unit:'utf16-code-unit',
  text:text.slice(start,end),hasMore:end<text.length};
}

export function assertMailBodySection(section,bodyOffset,maxCharacters) {
 const {start,endExclusive:end,totalCodeUnits:total,text}=section;
 if(end<start||end-start>maxCharacters+1||text!==null&&(text.length!==end-start||!text.isWellFormed()))fail();
 if(total===null) {
  if(start!==bodyOffset||section.hasMore!==null||end-start>maxCharacters)fail();
  return;
 }
 const requestedStart=Math.min(bodyOffset,total),requestedEnd=Math.min(total,bodyOffset+maxCharacters);
 const startMatches=start===requestedStart||text!==null&&start===requestedStart-1&&pair(text,0);
 const endMatches=end===requestedEnd||text!==null&&end===requestedEnd-1&&end>start&&requestedEnd<total||
  text!==null&&maxCharacters===1&&end===requestedEnd+1&&end<=total&&pair(text,text.length-2);
 if(!startMatches||!endMatches||end>total||section.hasMore!==(end<total)||start<total&&end<=start)fail();
}
