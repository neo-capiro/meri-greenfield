"""Fixed local source-test entry. Not a sandbox or native Office admission."""
import base64,hashlib,importlib.util,json,os,pathlib,resource,sys,zipfile

def load(name):
    spec=importlib.util.spec_from_file_location('meri_artifact_'+name,pathlib.Path(__file__).with_name(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main(validate_assets=False):
    # Limits complement parent supervision; they do not qualify OS isolation.
    resource.setrlimit(resource.RLIMIT_CPU,(25,25));resource.setrlimit(resource.RLIMIT_FSIZE,(8388608,8388608))
    resource.setrlimit(resource.RLIMIT_NOFILE,(64,64))
    raw=sys.stdin.buffer.read(16777217)
    if len(raw)>16777216:raise ValueError('Input byte limit')
    data=json.loads(raw);request=data['request'];assets={}
    from PIL import Image
    for asset in data['assets']:
        image=base64.b64decode(asset['base64'],validate=True)
        if len(image)>2097152 or not image.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Only bounded PNG assets supported')
        import io
        with Image.open(io.BytesIO(image)) as parsed:
            if parsed.width>4096 or parsed.height>4096:raise ValueError('Image dimension limit')
            parsed.verify()
        with Image.open(io.BytesIO(image)) as parsed:parsed.load()
        assets[asset['id']]=image
    if validate_assets:
        print(json.dumps({'assets':[{'id':key,'sha256':hashlib.sha256(value).hexdigest(),'bytes':len(value)} for key,value in assets.items()]}));return
    form=request['format']
    if form not in ('docx','txt','xlsx','zip'):raise ValueError('Unsupported Python artifact format')
    path=pathlib.Path('artifact.'+form)
    if path.exists():raise ValueError('Output already exists')
    if form=='txt':path.write_bytes(request['content']['text'].encode('utf8'));details={'encoding':'UTF-8','whitespace':'unchanged'}
    elif form=='docx':details=load('office').word(request['content'],assets,path)
    elif form=='xlsx':
        base=data.get('base')
        if base:base={'request':base['request'],'bytes':base64.b64decode(base['base64'],validate=True)}
        details=load('office').excel(request['content'],assets,path,base)
    else:details=load('analysis').analyze(request['content'],path)
    result=path.read_bytes()
    if len(result)>data['maxBytes']:raise ValueError('Output byte limit')
    members=[]
    if form!='txt':
        with zipfile.ZipFile(path) as archive:
            if len(archive.infolist())>5000 or sum(v.file_size for v in archive.infolist())>33554432:raise ValueError('Archive expansion limit')
            if archive.testzip() is not None:raise ValueError('Archive CRC failure')
            members=archive.namelist()
    print(json.dumps({'sha256':hashlib.sha256(result).hexdigest(),'bytes':len(result),'format':form,'nativeOpened':False,'rendered':False,'recalculated':False,'members':members,'details':details},allow_nan=False))

if __name__=='__main__':
    if sys.argv[1:]==['--help']:
        print('Fixed artifact data entry: bounded JSON stdin, output artifact.<format> in owned cwd. Exit0 success;2 handled failure.');sys.exit(0)
    try:
        if sys.argv[1:] not in ([],['--validate-assets']):raise ValueError('Only fixed asset validation mode accepted')
        main(sys.argv[1:]==['--validate-assets'])
    except Exception as error:
        # Content, paths and input values are not copied into errors.
        print(json.dumps({'error':'ARTIFACT_GENERATION_FAILED','type':type(error).__name__}),file=sys.stderr);sys.exit(2)
