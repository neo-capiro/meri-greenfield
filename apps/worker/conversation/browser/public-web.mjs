/** Platform security limits for browser URLs and origins. No tenant, role or record can remove them.
 * Only http/https URLs whose host is a public DNS name or a globally routable IP literal pass; `about:blank` is the one
 * extra navigation target. Credentials in URLs, non-web schemes, private/loopback/link-local/unique-local/multicast/
 * reserved addresses and internal-only names are refused. Pure and synchronous: no DNS lookup is made, so a public
 * name that resolves to a private address (including DNS rebinding) can only be stopped by the browser host's egress
 * controls, which remain the binding boundary (D005). */
import {BlockList,isIPv4,isIPv6} from 'node:net';
const IPV4_NON_PUBLIC=Object.freeze([['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]);
/** IPv6 must sit in global unicast 2000::/3 and outside these special-purpose blocks. Everything outside 2000::/3
 * (::, ::1, IPv4-mapped ::ffff:0:0/96, NAT64 64:ff9b::/96, discard 100::/64, unique-local fc00::/7, link-local
 * fe80::/10, site-local fec0::/10, multicast ff00::/8) is refused by the first rule. */
const IPV6_NON_PUBLIC=Object.freeze([['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20],['5f00::',16]]);
const block=(entries,type)=>{const list=new BlockList();for(const [net,prefix] of entries)list.addSubnet(net,prefix,type);return list;};
const v4Denied=block(IPV4_NON_PUBLIC,'ipv4'),v6Denied=block(IPV6_NON_PUBLIC,'ipv6'),v6Global=block([['2000::',3]],'ipv6');
/** Special-use and internal-only name suffixes (RFC 6761/6762/7686/8375/9476 and common private namespaces). */
const NON_PUBLIC_NAME_SUFFIXES=Object.freeze(['localhost','local','localdomain','internal','intranet','private','corp','home','lan','arpa','test','invalid','onion','alt']);
const LABEL=/^(?!-)[a-z0-9-]{1,63}(?<!-)$/u,TLD=/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/u;
/** True only for a public DNS name or globally routable IP literal, as normalized by the WHATWG URL parser
 * (which already canonicalizes decimal, octal and hex IPv4 forms and lower-cases names). */
export function isPublicHost(hostname){
 if(typeof hostname!=='string'||!hostname||hostname.length>255)return false;
 if(hostname.startsWith('[')&&hostname.endsWith(']')){const ip=hostname.slice(1,-1);return isIPv6(ip)&&v6Global.check(ip,'ipv6')&&!v6Denied.check(ip,'ipv6');}
 if(isIPv4(hostname))return !v4Denied.check(hostname,'ipv4');
 const name=hostname.endsWith('.')?hostname.slice(0,-1):hostname,labels=name.split('.');
 if(labels.length<2||!labels.every(l=>LABEL.test(l))||!TLD.test(labels.at(-1)))return false;
 return !NON_PUBLIC_NAME_SUFFIXES.some(s=>name===s||name.endsWith(`.${s}`));
}
/** Classifies one URL against the platform limits; `origin` is normalized for list matching. `about:blank` passes only when `allowBlank` (navigation).
 * Result: `{ok:true,blank:true}`, `{ok:true,blank:false,origin,host}` or `{ok:false,code}`. */
export function classifyWebUrl(value,{allowBlank=false}={}){
 if(typeof value!=='string'||!value||value.length>8192)return {ok:false,code:'BROWSER_URL_MALFORMED'};
 if(allowBlank&&value==='about:blank')return {ok:true,blank:true};
 let url;try{url=new URL(value);}catch{return {ok:false,code:'BROWSER_URL_MALFORMED'};}
 if(url.protocol!=='http:'&&url.protocol!=='https:')return {ok:false,code:'BROWSER_URL_SCHEME'};
 if(url.username||url.password)return {ok:false,code:'BROWSER_URL_CREDENTIALS'};
 if(!isPublicHost(url.hostname))return {ok:false,code:'BROWSER_URL_NOT_PUBLIC'};
 // A fully qualified name with a trailing dot is the same site; normalize so it cannot slip past an origin list.
 const host=url.hostname.endsWith('.')?url.hostname.slice(0,-1):url.hostname;
 return {ok:true,blank:false,origin:`${url.protocol}//${host}${url.port?`:${url.port}`:''}`,host};
}
/** True when `value` is exactly a canonical public http/https origin (no path, query, fragment, credentials, default port). */
export function isPublicOrigin(value){const c=classifyWebUrl(value);return c.ok&&!c.blank&&c.origin===value;}
/** Hosts that receive explicit Playwright MCP `--blocked-origins` entries as defence in depth. Playwright matches each
 * entry as a route glob (exact origin, `scheme://host:*` any port, or a bare host on default ports); it cannot express
 * address ranges, does not follow redirects and is not a security boundary (upstream 0.0.83 README). */
const LOOPBACK_AND_METADATA_NAMES=Object.freeze(['localhost','127.0.0.1','0.0.0.0','169.254.169.254','169.254.170.2','metadata.google.internal']);
const IPV6_LITERALS=Object.freeze(['[::1]','[fd00:ec2::254]']);
export const PLATFORM_BLOCKED_ORIGINS=Object.freeze([...LOOPBACK_AND_METADATA_NAMES.flatMap(h=>[h,`http://${h}:*`,`https://${h}:*`]),...IPV6_LITERALS.flatMap(h=>[`http://${h}`,`https://${h}`])]);
