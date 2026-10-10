"""W02-17 host_evidence package (INCOMPLETE RUNTIME ASSEMBLY).

Extracted collector/classifier/poll/version/helper modules for the browser-host
observer. Source preparation only: this package is NOT packaged into the
worker/support image, has NO build and NO host evidence. Importing is inert -
no host files, signals, subprocesses, sockets or network are touched; only the
standard library and immutable regex compilation run.
"""
