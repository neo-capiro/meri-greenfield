"""Render all pages of a bounded synthetic Relationship PDF with installed PyMuPDF."""
import hashlib
import json
from pathlib import Path
import sys

def main():
    if sys.argv[1:] == ['--help']:
        print('Read PDF stdin <=8MiB; render1–16 pages into owned cwd. Exit0 success/help;2 failure.')
        return 0
    if sys.argv[1:]:
        return 2
    raw = sys.stdin.buffer.read(8388609)
    if not raw.startswith(b'%PDF-') or len(raw) > 8388608:
        raise ValueError('PDF input bound')
    import fitz
    pages = []
    with fitz.open(stream=raw, filetype='pdf') as document:
        if document.is_encrypted or not 1 <= document.page_count <= 16:
            raise ValueError('Relationship PDF page bound')
        for index, page in enumerate(document):
            if page.rect.width > 1200 or page.rect.height > 1200:
                raise ValueError('Page dimensions')
            data = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False).tobytes('png')
            if len(data) > 2097152:
                raise ValueError('PNG bound')
            name = f'page-{index + 1}.png'
            with Path(name).open('xb') as output:
                output.write(data)
            pages.append({'page': index + 1, 'png': name, 'text': page.get_text(),
                          'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    print(json.dumps({'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'pages': pages,
                      'renderedLocally': True, 'nativeQualified': False}))
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('RELATIONSHIP_PDF_INSPECTION_FAILED', file=sys.stderr)
        sys.exit(2)
