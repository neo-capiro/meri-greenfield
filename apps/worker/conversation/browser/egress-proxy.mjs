/** Maps one request that Chromium sends to its `--proxy-server` (the browser host's egress control) to the egress
 * connection it opens: a CONNECT tunnel (https, wss, or ws over port 80) or an absolute-form plain-http request
 * (a WebSocket when it asks to upgrade). The proxy cannot see the request kind inside a tunnel, so a tunnel is
 * decided by its origin alone, which is the same rule every kind uses (`egress.mjs`). Pure: no I/O. */
const AUTHORITY=/^(\[[0-9A-Fa-f:.]{2,45}\]|[A-Za-z0-9.-]{1,253}):([0-9]{1,5})$/u;
const TUNNEL_SCHEME=Object.freeze({443:'https',80:'http'});
const header=(headers,name)=>{
 if(!headers||typeof headers!=='object')return undefined;
 const key=Object.keys(headers).find(k=>k.toLowerCase()===name);
 return key===undefined?undefined:String(headers[key]);
};
/** `{kind,url}` for `egressDecision`, or `{code}` when the request is not a forward-proxy request this control admits.
 * A tunnel to a port other than 80 or 443 is refused here (`web-ports-only`). */
export function proxyConnection({method,target,headers}={}){
 if(typeof method!=='string'||typeof target!=='string'||target.length>8192)return {code:'BROWSER_EGRESS_REQUEST'};
 if(method.toUpperCase()==='CONNECT'){
  const m=AUTHORITY.exec(target);if(!m)return {code:'BROWSER_EGRESS_REQUEST'};
  const scheme=TUNNEL_SCHEME[Number(m[2])];if(!scheme||m[2].startsWith('0'))return {code:'BROWSER_EGRESS_PORT'};
  return {kind:'tunnel',url:`${scheme}://${m[1]}/`};
 }
 // Chromium sends plain http through the proxy in absolute form; https always arrives as CONNECT.
 if(!/^http:\/\//iu.test(target))return {code:'BROWSER_EGRESS_REQUEST'};
 if(header(headers,'upgrade')?.toLowerCase()==='websocket')return {kind:'websocket',url:`ws://${target.slice('http://'.length)}`};
 return {kind:'fetch',url:target};
}
