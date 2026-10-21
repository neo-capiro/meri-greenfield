// @ts-check
/** One-use host stack: resource updates require a separately reviewed replacement stack. */
export function closedHostStackPolicy(){
 return Object.freeze({Statement:Object.freeze([Object.freeze({Effect:'Deny',Action:'Update:*',Principal:'*',Resource:'*'})])});
}
