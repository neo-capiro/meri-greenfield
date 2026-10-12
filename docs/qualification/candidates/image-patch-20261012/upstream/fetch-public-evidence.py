"""Bounded public evidence reads only; fixed generated URL input, no retries."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
LIMIT = 512 * 1024
ALLOWED = {'security-tracker.debian.org', 'snapshot.debian.org', 'deb.debian.org',
           'security.debian.org', 'metadata.ftp-master.debian.org', 'packages.debian.org',
           'curl.se', 'www.gnutls.org', 'raw.githubusercontent.com', 'github.com',
           'gitlab.com', 'gitlab.freedesktop.org', 'www.debian.org', 'www.libexpat.org',
           'libexpat.github.io', 'www.zlib.net'}


def capture(row):
    url = row['url']
    if urllib.parse.urlsplit(url).scheme != 'https' or urllib.parse.urlsplit(url).hostname not in ALLOWED:
        raise ValueError('unapproved public endpoint')
    started = time.monotonic()
    result = dict(row, retrievedAt=datetime.now(timezone.utc).isoformat(), responseStatus=None)
    raw = b''
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Meri-source-evidence/1', 'Accept-Encoding': 'identity'})
        try:
            stream = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            stream = error
        with stream:
            result['responseStatus'] = stream.status
            result['finalUrl'] = stream.url
            result['contentType'] = stream.headers.get('Content-Type')
            result['httpDate'] = stream.headers.get('Date')
            raw = stream.read(LIMIT + 1)
        if len(raw) > LIMIT:
            raw = raw[:LIMIT]
            result['outcome'] = 'REFUSED_OVER_LIMIT_TRUNCATED_PREFIX'
        else:
            result['outcome'] = 'HTTP_RESPONSE_BYTES_ONLY' if result['responseStatus'] == 200 else 'HTTP_FAILURE_PRESERVED'
    except (OSError, urllib.error.URLError) as error:
        result['outcome'] = 'TRANSPORT_FAILURE'
        result['error'] = str(error)
    result['elapsedSeconds'] = round(time.monotonic() - started, 6)
    result['bytes'] = len(raw)
    result['sha256'] = hashlib.sha256(raw).hexdigest()
    result['body'] = 'raw/' + row['id'] + '.body.bin'
    (ROOT / result['body']).write_bytes(raw)
    return result


if __name__ == '__main__':
    rows = json.loads((ROOT / 'fetch-requests.json').read_text())
    (ROOT / 'raw').mkdir(exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(capture, row) for row in rows]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            (ROOT / 'fetch-results.json').write_text(json.dumps(sorted(results, key=lambda r: r['id']), indent=2) + '\n')
            print(result['id'], result['responseStatus'], result['outcome'], result['bytes'], flush=True)
