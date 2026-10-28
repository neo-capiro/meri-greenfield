/** Immutable publication pages. Only the tenant root CAS publishes a new tree.
 * Bounded fanout and verified subtree counts permit point/range reads without a tenant census. */
import {v,own,data,same,digest,storageMethod,fail} from './boundary.mjs';
export const ARTIFACT_PUBLICATION_PAGE_NAMESPACE='meri.artifact-publication-pages.1';
const MAX_ITEMS=32,MAX_BYTES=8388608,corrupt=()=>fail('ARTIFACT_PUBLICATION_CORRUPT');
const key=value=>{if(typeof value!=='string'||!value.length||value.length>256||!/^[\x21-\x7e]+$/u.test(value))corrupt();return value;};
const integer=value=>{if(!Number.isSafeInteger(value)||value<1)corrupt();return value;};
export function publicationPageReference(value){
 const r=data(own(value,['sha256','versionId','first','last','count','height']));digest(r.sha256);key(r.first);key(r.last);integer(r.count);
 if(r.first>r.last||!Number.isInteger(r.height)||r.height<0||r.height>32||typeof r.versionId!=='string'||!r.versionId||r.versionId==='null'||Buffer.byteLength(r.versionId)>1024)corrupt();return r;
}
export function verifyPublicationPage(value,tenantId){
 const p=data(own(value,['namespace','tenantId','height','items']));
 if(p.namespace!==ARTIFACT_PUBLICATION_PAGE_NAMESPACE||p.tenantId!==tenantId||!Number.isInteger(p.height)||p.height<0||p.height>32||!Array.isArray(p.items)||!p.items.length||p.items.length>MAX_ITEMS||Buffer.byteLength(JSON.stringify(p))>MAX_BYTES)corrupt();
 let last=null,count=0;
 for(const item of p.items){let first,end;
  if(p.height===0){own(item,['key','value']);first=end=key(item.key);count++;}
  else{const ref=publicationPageReference(item);if(ref.height!==p.height-1)corrupt();first=ref.first;end=ref.last;count+=ref.count;}
  if(last!==null&&first<=last)corrupt();last=end;
 }
 integer(count);return p;
}
function facts(page){const leaf=page.height===0;return {first:leaf?page.items[0].key:page.items[0].first,last:leaf?page.items.at(-1).key:page.items.at(-1).last,count:leaf?page.items.length:page.items.reduce((n,r)=>n+r.count,0),height:page.height};}
/** A fresh tree facade/cache belongs to one operation and its deadline, never to a caller's authority. */
export function createPublicationPageTree({pages,tenantId,life}){
 const read=storageMethod(pages,'read'),write=storageMethod(pages,'write'),cache=new Map();
 async function load(raw){const ref=publicationPageReference(raw),cacheKey=ref.sha256+':'+ref.versionId;life.check();let page=cache.get(cacheKey);
  if(!page){page=verifyPublicationPage(await read(life,ref),tenantId);if(v.hash(page)!==ref.sha256)corrupt();cache.set(cacheKey,page);}
  if(!same(facts(page),{first:ref.first,last:ref.last,count:ref.count,height:ref.height}))corrupt();return page;
 }
 async function save(height,items){const page=verifyPublicationPage({namespace:ARTIFACT_PUBLICATION_PAGE_NAMESPACE,tenantId,height,items},tenantId),sha256=v.hash(page),native=await write(life,page,sha256);
  const ref=publicationPageReference({sha256,versionId:native.versionId,...facts(page)});cache.set(sha256+':'+ref.versionId,page);return ref;
 }
 async function split(height,items){const candidate={namespace:ARTIFACT_PUBLICATION_PAGE_NAMESPACE,tenantId,height,items};
  if(items.length<=MAX_ITEMS&&Buffer.byteLength(JSON.stringify(candidate))<=MAX_BYTES)return [await save(height,items)];
  if(items.length<2)fail('ARTIFACT_PUBLICATION_LIMIT');const middle=Math.floor(items.length/2);
  return [...await split(height,items.slice(0,middle)),...await split(height,items.slice(middle))];
 }
 async function insert(ref,k,value){if(ref===null)return split(0,[{key:k,value}]);const page=await load(ref),items=[...page.items];
  if(page.height===0){const at=items.findIndex(item=>item.key>=k);if(at<0)items.push({key:k,value});else if(items[at].key===k)items[at]={key:k,value};else items.splice(at,0,{key:k,value});}
  else{let at=items.findIndex(item=>item.last>=k);if(at<0)at=items.length-1;items.splice(at,1,...await insert(items[at],k,value));}
  return split(page.height,items);
 }
 async function set(root,k,value){key(k);const refs=await insert(root,k,data(value));return refs.length===1?refs[0]:save(refs[0].height+1,refs);}
 async function get(root,k){key(k);let ref=root;while(ref!==null){if(k<ref.first||k>ref.last)return null;const page=await load(ref);if(page.height===0)return data(page.items.find(item=>item.key===k)?.value??null);ref=page.items.find(item=>item.first<=k&&item.last>=k)??null;}return null;}
 async function range(root,{prefix,offset=0,limit=100}){key(prefix);if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>101)fail('ARTIFACT_STORAGE_INPUT');
  const lower=prefix,upper=prefix+'~',entries=[];let skip=offset;
  async function visit(ref){if(ref===null||ref.last<lower||ref.first>upper||entries.length>limit)return;
   if(ref.first>=lower&&ref.last<=upper&&skip>=ref.count){skip-=ref.count;return;}
   const page=await load(ref);if(page.height===0){for(const item of page.items){if(!item.key.startsWith(prefix))continue;if(skip){skip--;continue;}entries.push(data(item));if(entries.length>limit)break;}}
   else for(const child of page.items){await visit(child);if(entries.length>limit)break;}
  }
  await visit(root);if(skip)fail('ARTIFACT_PUBLICATION_CURSOR');return {entries:entries.slice(0,limit),nextOffset:entries.length>limit?offset+limit:null};
 }
 /** Legacy upgrade builds the already bounded <=8MiB source once, not thousands of intermediate COW roots. */
 async function build(raw){const entries=raw.map(item=>({key:key(item.key),value:data(item.value)})).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);if(entries.some((e,i)=>i>0&&entries[i-1].key===e.key))corrupt();if(!entries.length)return null;
  let height=0,items=entries;
  do{const groups=[];for(let i=0;i<items.length;i+=MAX_ITEMS)groups.push(items.slice(i,i+MAX_ITEMS));const refs=[];
   // At most four native writes/readbacks in flight, all joined before leaving this lifetime.
   for(let i=0;i<groups.length;i+=4){const results=await Promise.allSettled(groups.slice(i,i+4).map(group=>split(height,group)));const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;for(const result of results)refs.push(...result.value);}
   if(refs.length===1)return refs[0];items=refs;height++;
  }while(height<=32);corrupt();
 }
 return Object.freeze({get,set,range,build});
}
