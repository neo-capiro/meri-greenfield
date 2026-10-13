"""Reproduce npm lock from upstream installed package metadata and native pnpm integrities.
No application donor code, ambient config/credential reading, or network access.
"""
import json, pathlib, yaml
root=pathlib.Path(__file__).resolve().parents[2]
donor=pathlib.Path('/workspace/capirov2')
native=yaml.safe_load((donor/'pnpm-lock.yaml').read_text())['packages']
graph={}; first={}
def dependency(path,name):
 for parent in [path,*path.parents]:
  target=parent/'node_modules'/name
  if (target/'package.json').exists(): return target.resolve()
 raise RuntimeError('Installed upstream dependency absent: '+name)
def collect(path):
 path=path.resolve()
 if path in graph:return
 meta=json.loads((path/'package.json').read_text());graph[path]=(meta,{})
 first.setdefault(meta['name'],path)
 for name in {**meta.get('dependencies',{}),**meta.get('optionalDependencies',{})}:
  child=dependency(path,name);graph[path][1][name]=child;collect(child)
collect(donor/'node_modules/.pnpm/@aws-sdk+client-s3@3.1141.0/node_modules/@aws-sdk/client-s3')
runtime=set(graph)
collect(donor/'node_modules/.pnpm/pg@8.23.0/node_modules/pg')
meta=json.loads((root/'package.json').read_text());packages={'':{k:meta[k] for k in ['name','version','dependencies','devDependencies','engines']}}
seen=set()
def emit(path,location):
 if location in seen:return
 seen.add(location);info,children=graph[path];name,version=info['name'],info['version'];key=name+'@'+version
 integrity=native[key]['resolution']['integrity'];leaf=name.split('/')[-1]
 item={'version':version,'resolved':f'https://registry.npmjs.org/{name}/-/{leaf}-{version}.tgz','integrity':integrity,'license':info.get('license','UNDECLARED')}
 if path not in runtime:item['dev']=True
 for field in ['dependencies','engines','optionalDependencies','peerDependencies','peerDependenciesMeta','bin']:
  if field in info:item[field]=info[field]
 packages[location]=item
 for dep,child in children.items():emit(child,'node_modules/'+dep if first[dep]==child else location+'/node_modules/'+dep)
for name,path in first.items():emit(path,'node_modules/'+name)
lock={'name':meta['name'],'version':meta['version'],'lockfileVersion':3,'requires':True,'packages':packages}
(root/'package-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
print(json.dumps({'packages':len(packages)-1,'method':'Installed upstream package graph + pnpm native registry SHA512 integrities','network':False}))
