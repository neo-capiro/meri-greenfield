import {sourceFor,opFor} from './fixtures.mjs';
import {textSha256} from '../engine.mjs';
import {FEDERAL_USLM_XML_PARSER,deriveUslmScopes} from '../uslm-source.mjs';
export {opFor};
/** A small synthetic USLM bill: nested section/subsection identifiers, an entity, Unicode and a self-closing section. */
export const USLM_TEXT='<?xml version="1.0" encoding="UTF-8"?>\n<bill xmlns="http://xml.house.gov/schemas/uslm/1.0" identifier="/us/bill/119/hr/1">\n'+
 ' <section identifier="/us/bill/119/hr/1/s1"><num>1.</num><heading>Payments</heading>\n'+
 '  <subsection identifier="/us/bill/119/hr/1/s1/a"><num>(a)</num><content>Pay $100 😀 &amp; report.</content></subsection>\n'+
 '  <subsection identifier="/us/bill/119/hr/1/s1/b"><num>(b)</num><content>Pay $100.</content></subsection>\n'+
 ' </section>\n <section identifier="/us/bill/119/hr/1/s2"><num>2.</num><content>Review.</content></section>\n <section identifier="/us/bill/119/hr/1/s3"/>\n</bill>\n';
export const S1='us:bill:119:hr:1:s1',A='us:bill:119:hr:1:s1:a',B='us:bill:119:hr:1:s1:b',S2='us:bill:119:hr:1:s2',S3='us:bill:119:hr:1:s3';
export function uslmSource(text=USLM_TEXT){
 return {...sourceFor(),parserVersion:FEDERAL_USLM_XML_PARSER,text,sha256:textSha256(text),
  scopes:deriveUslmScopes(text).scopes.map(scope=>({...scope,ancestorPath:[...scope.ancestorPath]}))};
}
export const slice=(source,id)=>{const scope=source.scopes.find(s=>s.id===id);return source.text.slice(scope.start,scope.end);};
