/** Test-only inert low-level cgroup-v2 port mirroring the real kernel semantics: interface pseudo-files remain in readdir,
 *  a child exposes only the controllers its parent delegated, and subtree_control reads plain controller names. */
export function makeInertHierarchyPort({parents=true,existingHost=false,controllers='cpu memory pids',
 mount='/sys/fs/cgroup',boot='00000000-0000-4000-8000-000000000008',supervisor='0::/system.slice/meri-native.service\n',pseudoFiles=true,
 ignoreRemove=false,plusReadback=false,uid=0,euid=0,occupied=false,occupiedPath=null}={}){
 const nodes=new Map();
 let sequence=0;
 const add=(path,enabled='')=>nodes.set(path,{uid,ino:++sequence,enabled,procs:''});
 add(mount,controllers);
 if(parents){add(`${mount}/meri`,controllers);add(`${mount}/meri/hosts`,controllers);}
 const parent=path=>path.slice(0,path.lastIndexOf('/'));
 const get=path=>{const node=nodes.get(path);if(!node)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});return node;};
 const errno=code=>Object.assign(Error(code),{code});
 const state={mount,boot,supervisor,ignoreRemove,plusReadback};
 const port={
  state,nodes,
  identity(){return {uid,euid};},
  statfs(){return {type:mount==='/sys/fs/cgroup'?0x63677270:0xEF53};},
  realpath(path){get(path);return path;},
  lstat(path){const node=get(path);return {uid:node.uid,dev:1,ino:node.ino,
   isDirectory:()=>!node.symlink,isSymbolicLink:()=>!!node.symlink};},
  mkdir(path){if(nodes.has(path))throw errno('EEXIST');get(parent(path));add(path);},
  readdir(path){get(path);
   const entries=Array.from(nodes.keys()).filter(p=>parent(p)===path).map(p=>p.slice(path.length+1));
   return [...(pseudoFiles?['cgroup.controllers','cgroup.subtree_control','cgroup.procs','cgroup.events']:[]),...entries];},
  rmdir(path){const node=get(path);
   if(node.procs.trim()||Array.from(nodes.keys()).some(p=>parent(p)===path))throw errno('EBUSY');
   if(!ignoreRemove)nodes.delete(path);},
  readFile(path){
   if(path==='/proc/self/mountinfo')
    return `31 22 0:28 / ${state.mount} rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw\n`;
   if(path==='/proc/sys/kernel/random/boot_id')return `${state.boot}\n`;
   if(/^\/proc\/\d+\/cgroup$/u.test(path))return state.supervisor;
   const directory=parent(path),name=path.slice(directory.length+1),node=get(directory);
   if(name==='cgroup.controllers')return `${directory===state.mount?controllers:get(parent(directory)).enabled}\n`;
   if(name==='cgroup.subtree_control')
    return `${state.plusReadback?node.enabled.split(' ').filter(Boolean).map(x=>`+${x}`).join(' '):node.enabled}\n`;
   if(name==='cgroup.procs')return node.procs;
   if(name==='cgroup.events')return 'populated 0\n';
   throw errno('ENOENT');
  },
  writeFile(path,value){
   const directory=parent(path),node=get(directory);
   if(!path.endsWith('/cgroup.subtree_control'))throw Error('Unexpected write');
   if(directory!==state.mount&&node.procs.trim())throw errno('EBUSY');
   const available=port.readFile(`${directory}/cgroup.controllers`).trim().split(/\s+/u);
   const tokens=String(value).split(/\s+/u);
   if(tokens.some(token=>!/^\+[a-z]+$/u.test(token)||!available.includes(token.slice(1))))throw errno('EINVAL');
   node.enabled=Array.from(new Set([...node.enabled.split(' ').filter(Boolean),
    ...tokens.map(token=>token.slice(1))])).join(' ');
  },
  readBootId(){return state.boot;},
 };
 if(existingHost)add(`${mount}/meri/hosts/00000000-0000-4000-8000-000000000007-3`,controllers);
 if(occupied){for(const node of nodes.values())node.procs='4242\n';}
 return port;
}
