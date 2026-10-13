"""Render bounded synthetic Commitments tracking PDFs with installed PyMuPDF for local visual review."""
import hashlib
import json
from pathlib import Path
import sys


def main():
    if sys.argv[1:] == ['--help']:
        print('Read bounded PDF stdin; render at most32 pages into owned cwd. Exit0 success/help;2 failure.')
        return 0
    if sys.argv[1:]:
        return 2
    raw = sys.stdin.buffer.read(8388609)
    if not raw.startswith(b'%PDF-') or len(raw) > 8388608:
        raise ValueError('PDF size/type')
    import fitz
    pages = []
    with fitz.open(stream=raw, filetype='pdf') as document:
        if document.is_encrypted or not 1 <= document.page_count <= 32:
            raise ValueError('PDF page limit')
        for index, page in enumerate(document):
            if page.rect.width > 1200 or page.rect.height > 1200:
                raise ValueError('PDF dimensions')
            name = f'page-{index + 1}.png'
            pixels = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
            data = pixels.tobytes('png')
            if len(data) > 2097152:
                raise ValueError('PNG size')
            with Path(name).open('xb') as output:
                output.write(data)
            pages.append({'page': index + 1, 'text': page.get_text(), 'png': name,
                          'width': pixels.width, 'height': pixels.height,
                          'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    print(json.dumps({'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'pages': pages,
                      'renderedLocally': True, 'nativeQualified': False}))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('TRACKING_PDF_INSPECTION_FAILED', file=sys.stderr)
        sys.exit(2)
