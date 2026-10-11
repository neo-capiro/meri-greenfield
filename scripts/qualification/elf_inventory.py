"""Bounded Linux amd64 ELF and virtual-link DATA; never loads native code."""
import posixpath
import struct


class ElfRefusal(ValueError):
    pass


def inspect_elf(raw):
    if type(raw) is not bytes or not 64 <= len(raw) <= 128*1024**2:
        raise ElfRefusal('ELF byte limit/header')
    if raw[:7] != b'\x7fELF\x02\x01\x01':
        raise ElfRefusal('only ELF64 little-endian version1 supported')
    h = struct.unpack_from('<HHIQQQIHHHHHH', raw, 16)
    kind,machine,version,_,phoff,_,_,ehsize,phsize,phnum,_,_,_ = h
    if kind not in (2,3) or machine != 62 or version != 1 or ehsize != 64 or phsize != 56 or not 0 < phnum <= 512:
        raise ElfRefusal('unsupported ELF type/machine/program headers')
    def region(offset,size):
        if offset < 0 or size < 0 or offset > len(raw) or size > len(raw)-offset:
            raise ElfRefusal('ELF range outside file')
        return raw[offset:offset+size]
    if phoff < 64:raise ElfRefusal('program headers overlap ELF header')
    region(phoff,phnum*56)
    loads=[];dynamic=None;interpreter=None
    for i in range(phnum):
        t,flags,offset,va,_,size,mem,align=struct.unpack_from('<IIQQQQQQ',raw,phoff+i*56)
        region(offset,size)
        if t == 1:
            if mem < size or (align not in (0,1) and (align & (align-1))):
                raise ElfRefusal('invalid load segment')
            loads.append((va,size,offset))
        elif t == 2:
            if dynamic is not None or size > 65536 or size % 16:
                raise ElfRefusal('ambiguous/bounded dynamic segment')
            dynamic=(offset,size)
        elif t == 3:
            if interpreter is not None or not 2 <= size <= 4096:
                raise ElfRefusal('ambiguous/bounded interpreter')
            b=region(offset,size)
            if b[-1:]!=b'\0' or b'\0' in b[:-1]:raise ElfRefusal('interpreter terminator')
            try:interpreter=b[:-1].decode('ascii')
            except UnicodeDecodeError as exc:raise ElfRefusal('interpreter encoding') from exc
            if not interpreter.startswith('/') or '\\' in interpreter or any(ord(c)<32 or ord(c)==127 for c in interpreter) or any(x in ('','.', '..') for x in interpreter[1:].split('/')):
                raise ElfRefusal('interpreter path')
    result={'class':64,'endian':'little','machine':machine,'type':kind,'interpreter':interpreter,'needed':[],'soname':None,'rpath':None,'runpath':None}
    if dynamic is None:return result
    tags=[];terminated=False
    for off in range(dynamic[0],sum(dynamic),16):
        tag,value=struct.unpack_from('<qQ',raw,off)
        if tag == 0:terminated=True;break
        tags.append((tag,value))
    if not terminated:raise ElfRefusal('unterminated dynamic table')
    for tag in (5,10,14,15,29):
        if sum(t==tag for t,_ in tags)>1:raise ElfRefusal('duplicate dynamic singleton')
    strings=[x for x in tags if x[0] in (1,14,15,29)]
    if not strings:return result
    table=[v for t,v in tags if t==5];sizes=[v for t,v in tags if t==10]
    if len(table)!=1 or len(sizes)!=1 or not 0<sizes[0]<=1024**2 or len(strings)>256:
        raise ElfRefusal('dynamic string table identity/limit')
    locations=[offset+(table[0]-va) for va,size,offset in loads if va<=table[0] and table[0]-va<=size and sizes[0]<=size-(table[0]-va)]
    if len(locations)!=1:raise ElfRefusal('ambiguous/unmapped dynamic string table')
    body=region(locations[0],sizes[0])
    for tag,index in strings:
        if index>=len(body):raise ElfRefusal('dynamic string offset')
        end=body.find(b'\0',index,min(len(body),index+4097))
        if end<0 or end==index:raise ElfRefusal('dynamic string terminator/length')
        try:value=body[index:end].decode('ascii')
        except UnicodeDecodeError as exc:raise ElfRefusal('dynamic string encoding') from exc
        if any(ord(c)<32 or ord(c)==127 for c in value):raise ElfRefusal('dynamic string control')
        if tag in (1,14) and ('/' in value or '\\' in value):raise ElfRefusal('non-basename needed/soname')
        if tag==1:
            if value in result['needed']:raise ElfRefusal('duplicate needed')
            result['needed'].append(value)
        else:
            key={14:'soname',15:'rpath',29:'runpath'}[tag]
            if result[key] is not None:raise ElfRefusal('duplicate dynamic path/soname')
            result[key]=value
    return result


def resolve_virtual(path, entries):
    """Return only lexical image identity; no filesystem calls or link materialization."""
    if type(path) is not str or not path or path.startswith('/') or len(path)>4096 or any(c in path for c in ('\\','\x00',':')) or any(x in ('','.','..') for x in path.split('/')):
        return {'status':'HOLD','reason':'INVALID_VIRTUAL_PATH','chain':[]}
    seen=[]
    for _ in range(32):
        if path in seen:return {'status':'HOLD','reason':'LINK_CYCLE','chain':seen+[path]}
        seen.append(path);row=entries.get(path)
        if row is None:return {'status':'HOLD','reason':'TARGET_MISSING','chain':seen}
        if row['kind']=='file':return {'status':'REGULAR_VIRTUAL_TARGET','path':path,'chain':seen}
        if row['kind'] not in ('symlink','hardlink'):return {'status':'HOLD','reason':'TARGET_NOT_REGULAR','chain':seen}
        target=row.get('target')
        if type(target) is not str or not target or len(target)>4096 or '\\' in target or '\x00' in target or ':' in target:
            return {'status':'HOLD','reason':'UNSUPPORTED_LINK_TARGET','chain':seen}
        if row['kind']=='hardlink' and target.startswith('/'):
            return {'status':'HOLD','reason':'UNSUPPORTED_HARDLINK_ROOT','chain':seen}
        parts=[] if target.startswith('/') or row['kind']=='hardlink' else [p for p in posixpath.dirname(path).split('/') if p]
        for part in target.lstrip('/').split('/'):
            if part in ('','.'):continue
            if part=='..':
                if not parts:return {'status':'HOLD','reason':'LINK_ESCAPES_IMAGE','chain':seen}
                parts.pop()
            else:parts.append(part)
        path='/'.join(parts)
    return {'status':'HOLD','reason':'LINK_DEPTH','chain':seen}
