#!/usr/bin/env bash
# One-off WSL space cleanup (decision O76/O82). Removes only regenerable test copies and Docker caches:
#   /opt: superseded frontend test trees (git checkouts + node_modules) from 2026-10-20.
#   Docker: stopped containers, unused images older than 12 h, build cache, unused volumes.
# Keeps: fe-ship-2abf9cdd (current frontend release), fe-stale-specs (in use), adj-b-transport, small outputs.
set -u
[ "$(docker ps -q | wc -l)" = 0 ] || { echo "containers are running; refusing"; exit 2; }
df -h / | tail -1
for d in fe-consol fe-release fe-base fe-ship-87d804bc fe-g-stream; do
  [ -d "/opt/$d" ] && { sudo -n rm -rf "/opt/$d" 2>/dev/null || rm -rf "/opt/$d"; echo "removed /opt/$d"; }
done
docker container prune -f | tail -1
docker image prune -a -f --filter "until=12h" | tail -1
docker builder prune -a -f | tail -1
docker volume prune -f | tail -1
docker system df
df -h / | tail -1
