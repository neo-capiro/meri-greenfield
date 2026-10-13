"""Bounded by capture-reaped.py; offline checks of the integrated public package."""
import subprocess

commands = [
    ['npm', 'run', 'check', '--prefix', 'packages/contracts'],
    ['node', '--test', 'packages/contracts/test/action-application-independent.test.mjs'],
    ['packages/contracts/node_modules/.bin/tsc', '--noEmit', '--strict', '--skipLibCheck',
     '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
     'packages/contracts/test/action-application-independent-types.ts'],
]
for command in commands:
    subprocess.run(command, check=True)
