"""Canonical worker archive membership; no source approval or resource allocation."""
import worker_context

ASSEMBLER = 'scripts/qualification/worker_context.py'
COLLECTOR = 'scripts/qualification/worker_image_collect.py'
PUBLISHER = 'scripts/qualification/worker_image_publish.py'
CLEANER = 'scripts/clear-qualification-docker-config.py'
MANIFEST_OWNER = 'scripts/qualification/worker_image_manifest.py'


def source_paths(publish=False):
    """All source/recipe records required before the input manifest is added."""
    paths = tuple(path for path, _ in worker_context.MEMBERS) + (
        ASSEMBLER, COLLECTOR, MANIFEST_OWNER, 'buildspec.json')
    if publish:
        paths += (PUBLISHER, CLEANER)
    if len(set(paths)) != len(paths):
        raise ValueError('duplicate canonical worker source path')
    return paths


def archive_paths(publish=False):
    return source_paths(publish) + ('worker-image-input.json',)


def require_source_membership(rows, publish=False):
    """Reject missing, extra and duplicate names independently of record order."""
    if type(rows) is not list or any(type(row) is not dict for row in rows):
        raise ValueError('exact source/recipe records')
    names = [row.get('path') for row in rows]
    if any(type(name) is not str for name in names):
        raise ValueError('source path')
    if len(names) != len(set(names)) or set(names) != set(source_paths(publish)):
        raise ValueError('canonical worker membership')
