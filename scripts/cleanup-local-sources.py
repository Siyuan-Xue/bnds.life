#!/usr/bin/env python3
"""Delete stable local inputs only against fresh server playback receipts."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path


def cleanup(directory, receipt, execute=False):
    stamp = datetime.datetime.fromisoformat(receipt['verifiedAt'].replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds()
    if not 0 <= age <= 86400 or receipt.get('policy') != 'metadata-only-originals':
        raise ValueError('Fresh metadata-only server receipts required (max 24 hours)')
    known = {r['sha256']: r for r in receipt['verified'] if r['status'] == 'published'}
    sizes = {r['size'] for r in known.values()}
    result = {'execute': execute, 'files': [], 'bytes': 0}
    def identity(s):
        return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    for path in sorted(Path(directory).iterdir()):
        if path.is_symlink() or not path.is_file():
            continue
        if path.suffix.lower() not in ('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.mts', '.m2ts', '.webm'):
            continue
        before = path.stat()
        if before.st_size not in sizes:
            continue
        with path.open('rb') as stream:
            opened = os.fstat(stream.fileno())
            if identity(before) != identity(opened):
                continue
            digest = hashlib.sha256()
            for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
                digest.update(chunk)
            sha = digest.hexdigest()
            if sha not in known or known[sha]['size'] != opened.st_size:
                continue
            if identity(opened) != identity(os.fstat(stream.fileno())) or identity(opened) != identity(path.lstat()):
                continue
            entry = {'file': str(path), 'sha256': sha, 'size': opened.st_size, 'videoId': known[sha]['id']}
            if execute:
                # Emit an audit record before removing the verified local input.
                print(json.dumps({'deleting': entry}), flush=True)
                path.unlink()
            result['files'].append(entry)
            result['bytes'] += opened.st_size
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--receipts', required=True)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    print(json.dumps(cleanup(args.directory, json.loads(Path(args.receipts).read_text()), args.execute)))
