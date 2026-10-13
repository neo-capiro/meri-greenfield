"""Render every page of one bounded synthetic PDF; no network or native qualification."""
import hashlib,json,sys
from pathlib import Path
raw=sys.stdin.buffer.read(8388609)
if len(raw)>8388608 or not raw.startswith(b'%PDF-'):raise ValueError('PDF bound')
import fitz
pages=[]
with fitz.open(stream=raw,filetype='pdf') as document:
 if document.is_encrypted or not 1<=document.page_count<=32:raise ValueError('32 page bound')
 for index,page in enumerate(document):
  if page.rect.width>1200 or page.rect.height>1200:raise ValueError('Dimensions')
  image=page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False).tobytes('png')
  if len(image)>2097152:raise ValueError('PNG bound')
  name=f'page-{index+1}.png';Path(name).write_bytes(image)
  pages.append({'page':index+1,'png':name,'sha256':hashlib.sha256(image).hexdigest(),'bytes':len(image),'text':page.get_text()})
print(json.dumps({'sha256':hashlib.sha256(raw).hexdigest(),'pages':pages,'localSyntheticOnly':True,'nativeQualified':False}))
