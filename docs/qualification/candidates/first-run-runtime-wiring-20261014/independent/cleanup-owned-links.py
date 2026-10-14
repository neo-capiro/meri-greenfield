"""Remove only dependency links created by root for this source-only worktree."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[5]
assert root==Path('/workspace/meri-first-run-wiring')
original=Path('/workspace/meri-first-session')
mapping=[('node_modules','node_modules',16),('apps/runtime/node_modules','apps/runtime/node_modules',105),('apps/worker/conversation/node_modules','apps/worker/conversation/node_modules',100),('packages/window-resolution/node_modules','packages/window-resolution/node_modules',3),('packages/ui-stream/node_modules','packages/ui-stream/node_modules',13),('apps/control/conversations/node_modules','apps/runtime/node_modules',1)]
links=[];scopes=[];directories=[]
for relative,source,count in mapping:
 owned=root/relative;borrowed=original/source
 assert owned.is_dir() and not owned.is_symlink() and borrowed.is_dir()
 entries=list(owned.iterdir());assert len(entries)==count
 for entry in entries:
  if entry.is_symlink():
   assert entry.resolve()==(borrowed/entry.name).resolve();links.append(entry)
  else:
   assert entry.name=='@capiro' and entry.is_dir()
   children=list(entry.iterdir());assert len(children)==1 and children[0].name=='meri-contracts' and children[0].is_symlink() and children[0].resolve()==root/'packages/contracts'
   links.append(children[0]);scopes.append(entry)
 directories.append(owned)
for link in links:link.unlink()
for scope in scopes:scope.rmdir()
for directory in directories:directory.rmdir()
assert all(not directory.exists() for directory in directories)
assert all((original/source).is_dir() for _,source,_ in mapping)
print(json.dumps({'scope':'ONLY_VERIFIED_ROOT_OWNED_LINKS_REMOVED','worktree':str(root),'linkCount':len(links),'ownedDependencyDirectoriesRemoved':len(directories),'originalDependencyTreesPreserved':True}))
